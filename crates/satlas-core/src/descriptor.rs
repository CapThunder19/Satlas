//! Watch-only wallet import: turns user input (a descriptor, or a bare
//! xpub/ypub/zpub/tpub/upub/vpub) into a pair of receive/change descriptors
//! and derives addresses from them.

use std::str::FromStr;

use miniscript::bitcoin::{base58, Address, Network, ScriptBuf};
use miniscript::descriptor::DescriptorPublicKey;
use miniscript::{Descriptor, ForEachKey};
use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};

/// BIP-32 chain index: 0 = external (receive), 1 = internal (change).
pub type Chain = u32;
pub const EXTERNAL: Chain = 0;
pub const INTERNAL: Chain = 1;

/// A parsed watch-only wallet: one descriptor per chain.
#[derive(Debug, Clone)]
pub struct WalletDescriptor {
    pub network: Network,
    pub external: Descriptor<DescriptorPublicKey>,
    /// `None` when the user gave a single-path descriptor with no change branch.
    pub internal: Option<Descriptor<DescriptorPublicKey>>,
}

/// A derived address plus enough metadata to map it back to the wallet.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DerivedAddress {
    pub address: String,
    pub script_pubkey: ScriptBuf,
    pub chain: Chain,
    pub index: u32,
}

/// Script type to wrap a bare extended key in when the key prefix does not
/// already imply one (i.e. plain `xpub`/`tpub`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum ScriptType {
    /// BIP-44 `pkh(...)`
    Legacy,
    /// BIP-49 `sh(wpkh(...))`
    NestedSegwit,
    /// BIP-84 `wpkh(...)`
    #[default]
    NativeSegwit,
    /// BIP-86 `tr(...)`
    Taproot,
}

impl WalletDescriptor {
    /// Parse anything a user might paste: an output descriptor (with or without
    /// checksum, single- or multi-path) or a bare SLIP-132 extended public key.
    ///
    /// `script_type` is only used for bare `xpub`/`tpub` keys, whose prefix
    /// does not imply a script type.
    pub fn parse(input: &str, script_type: ScriptType) -> Result<Self> {
        let input = input.trim();
        if input.is_empty() {
            return Err(Error::Descriptor("empty input".into()));
        }
        if input.contains("prv") {
            return Err(Error::Descriptor(
                "private keys are not accepted; Satlas is watch-only. Paste an xpub or a public descriptor".into(),
            ));
        }

        let (descriptor_str, network) = if looks_like_extended_key(input) {
            wrap_extended_key(input, script_type)?
        } else {
            (input.to_string(), None)
        };

        let desc = Descriptor::<DescriptorPublicKey>::from_str(&descriptor_str)
            .map_err(|e| Error::Descriptor(e.to_string()))?;

        let network = network.unwrap_or_else(|| infer_network(&desc));

        let (external, internal) = if desc.is_multipath() {
            let mut paths = desc
                .into_single_descriptors()
                .map_err(|e| Error::Descriptor(e.to_string()))?;
            if paths.len() != 2 {
                return Err(Error::Descriptor(format!(
                    "expected a 2-path descriptor like <0;1>, found {} paths",
                    paths.len()
                )));
            }
            let internal = paths.pop().unwrap();
            let external = paths.pop().unwrap();
            (external, Some(internal))
        } else {
            (desc, None)
        };

        if !external.has_wildcard() {
            return Err(Error::Descriptor(
                "descriptor has no wildcard (/*); Satlas needs a ranged descriptor to discover addresses".into(),
            ));
        }

        Ok(Self { network, external, internal })
    }

    fn descriptor_for(&self, chain: Chain) -> Result<&Descriptor<DescriptorPublicKey>> {
        match chain {
            EXTERNAL => Ok(&self.external),
            INTERNAL => self
                .internal
                .as_ref()
                .ok_or_else(|| Error::Descriptor("wallet has no change (internal) descriptor".into())),
            other => Err(Error::Descriptor(format!("unsupported chain index {other}"))),
        }
    }

    pub fn has_internal(&self) -> bool {
        self.internal.is_some()
    }

    /// Derive the address at `chain/index`.
    pub fn address_at(&self, chain: Chain, index: u32) -> Result<DerivedAddress> {
        let desc = self.descriptor_for(chain)?;
        let definite = desc
            .at_derivation_index(index)
            .map_err(|e| Error::Descriptor(e.to_string()))?;
        let address: Address = definite
            .address(self.network)
            .map_err(|e| Error::Descriptor(e.to_string()))?;
        Ok(DerivedAddress {
            script_pubkey: address.script_pubkey(),
            address: address.to_string(),
            chain,
            index,
        })
    }

    /// Derive `count` consecutive addresses starting at `start` on `chain`.
    pub fn addresses(&self, chain: Chain, start: u32, count: u32) -> Result<Vec<DerivedAddress>> {
        (start..start.saturating_add(count))
            .map(|i| self.address_at(chain, i))
            .collect()
    }

    /// Canonical string form of each chain descriptor (with checksum).
    pub fn to_strings(&self) -> (String, Option<String>) {
        (
            self.external.to_string(),
            self.internal.as_ref().map(|d| d.to_string()),
        )
    }
}

fn looks_like_extended_key(s: &str) -> bool {
    // Descriptors always contain '('; bare keys never do. Allow an optional
    // origin prefix like [fp/84h/0h/0h] before the key.
    !s.contains('(')
}

/// SLIP-132 version bytes -> (canonical xpub/tpub bytes, implied script type, network).
fn slip132(prefix: &[u8; 4]) -> Option<([u8; 4], Option<ScriptType>, Network)> {
    const XPUB: [u8; 4] = [0x04, 0x88, 0xB2, 0x1E];
    const YPUB: [u8; 4] = [0x04, 0x9D, 0x7C, 0xB2];
    const ZPUB: [u8; 4] = [0x04, 0xB2, 0x47, 0x46];
    const TPUB: [u8; 4] = [0x04, 0x35, 0x87, 0xCF];
    const UPUB: [u8; 4] = [0x04, 0x4A, 0x52, 0x62];
    const VPUB: [u8; 4] = [0x04, 0x5F, 0x1C, 0xF6];
    Some(match *prefix {
        XPUB => (XPUB, None, Network::Bitcoin),
        YPUB => (XPUB, Some(ScriptType::NestedSegwit), Network::Bitcoin),
        ZPUB => (XPUB, Some(ScriptType::NativeSegwit), Network::Bitcoin),
        TPUB => (TPUB, None, Network::Signet),
        UPUB => (TPUB, Some(ScriptType::NestedSegwit), Network::Signet),
        VPUB => (TPUB, Some(ScriptType::NativeSegwit), Network::Signet),
        _ => return None,
    })
}

/// Turn `[origin]xpub...` or `zpub...` into a full `<0;1>/*` descriptor string,
/// normalising SLIP-132 prefixes to xpub/tpub as miniscript requires.
fn wrap_extended_key(input: &str, fallback: ScriptType) -> Result<(String, Option<Network>)> {
    let (origin, key) = match input.rfind(']') {
        Some(i) => (&input[..=i], &input[i + 1..]),
        None => ("", input),
    };
    // Strip any trailing derivation the user may have appended.
    let key = key.split('/').next().unwrap_or(key);

    let mut bytes = base58::decode_check(key)
        .map_err(|_| Error::Descriptor("not a valid descriptor or extended public key".into()))?;
    if bytes.len() != 78 {
        return Err(Error::Descriptor("extended key has wrong length".into()));
    }
    let prefix: [u8; 4] = bytes[..4].try_into().unwrap();
    let (canonical, implied, network) = slip132(&prefix)
        .ok_or_else(|| Error::Descriptor("unrecognised extended key prefix".into()))?;
    bytes[..4].copy_from_slice(&canonical);
    let key = base58::encode_check(&bytes);

    let script_type = implied.unwrap_or(fallback);
    let inner = format!("{origin}{key}/<0;1>/*");
    let desc = match script_type {
        ScriptType::Legacy => format!("pkh({inner})"),
        ScriptType::NestedSegwit => format!("sh(wpkh({inner}))"),
        ScriptType::NativeSegwit => format!("wpkh({inner})"),
        ScriptType::Taproot => format!("tr({inner})"),
    };
    Ok((desc, Some(network)))
}

/// Testnet keys (tpub) are shared by testnet3/testnet4/signet/regtest; we pick
/// Signet since that is the demo network. The UI can override.
fn infer_network(desc: &Descriptor<DescriptorPublicKey>) -> Network {
    let mut testnet = false;
    desc.for_each_key(|k| {
        if let DescriptorPublicKey::XPub(x) = k {
            testnet |= x.xkey.network == miniscript::bitcoin::NetworkKind::Test;
        }
        true
    });
    if testnet {
        Network::Signet
    } else {
        Network::Bitcoin
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // BIP-84 test vector (mnemonic "abandon abandon ... about").
    const BIP84_ZPUB: &str = "zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs";
    const BIP84_XPUB: &str = "xpub6CatWdiZiodmUeTDp8LT5or8nmbKNcuyvz7WyksVFkKB4RHwCD3XyuvPEbvqAQY3rAPshWcMLoP2fMFMKHPJ4ZeZXYVUhLv1VMrjPC7PW6V";
    const BIP84_ADDR0: &str = "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu";
    const BIP84_ADDR1: &str = "bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g";
    const BIP84_CHANGE0: &str = "bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el";

    #[test]
    fn zpub_derives_bip84_vectors() {
        let w = WalletDescriptor::parse(BIP84_ZPUB, ScriptType::Legacy).unwrap();
        assert_eq!(w.network, Network::Bitcoin);
        assert!(w.has_internal());
        assert_eq!(w.address_at(EXTERNAL, 0).unwrap().address, BIP84_ADDR0);
        assert_eq!(w.address_at(EXTERNAL, 1).unwrap().address, BIP84_ADDR1);
        assert_eq!(w.address_at(INTERNAL, 0).unwrap().address, BIP84_CHANGE0);
    }

    #[test]
    fn xpub_uses_fallback_script_type() {
        let w = WalletDescriptor::parse(BIP84_XPUB, ScriptType::NativeSegwit).unwrap();
        assert_eq!(w.address_at(EXTERNAL, 0).unwrap().address, BIP84_ADDR0);
    }

    #[test]
    fn multipath_descriptor_with_origin() {
        let d = format!("wpkh([73c5da0a/84h/0h/0h]{BIP84_XPUB}/<0;1>/*)");
        let w = WalletDescriptor::parse(&d, ScriptType::default()).unwrap();
        assert_eq!(w.address_at(EXTERNAL, 0).unwrap().address, BIP84_ADDR0);
        assert_eq!(w.address_at(INTERNAL, 0).unwrap().address, BIP84_CHANGE0);
        let (ext, int) = w.to_strings();
        assert!(ext.contains("/0/*)#"), "checksum appended: {ext}");
        assert!(int.unwrap().contains("/1/*)#"));
    }

    #[test]
    fn single_path_descriptor_has_no_internal() {
        let d = format!("wpkh({BIP84_XPUB}/0/*)");
        let w = WalletDescriptor::parse(&d, ScriptType::default()).unwrap();
        assert!(!w.has_internal());
        assert!(w.address_at(INTERNAL, 0).is_err());
        assert_eq!(w.addresses(EXTERNAL, 0, 2).unwrap().len(), 2);
    }

    #[test]
    fn testnet_key_infers_signet() {
        let tpub = "tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba";
        let w = WalletDescriptor::parse(tpub, ScriptType::NativeSegwit).unwrap();
        assert_eq!(w.network, Network::Signet);
        assert!(w.address_at(EXTERNAL, 0).unwrap().address.starts_with("tb1q"));
    }

    #[test]
    fn rejects_private_keys_and_garbage() {
        assert!(WalletDescriptor::parse("xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi", ScriptType::default()).is_err());
        assert!(WalletDescriptor::parse("hello", ScriptType::default()).is_err());
        assert!(WalletDescriptor::parse("", ScriptType::default()).is_err());
        // no wildcard
        assert!(WalletDescriptor::parse(&format!("wpkh({BIP84_XPUB}/0/5)"), ScriptType::default()).is_err());
    }
}
