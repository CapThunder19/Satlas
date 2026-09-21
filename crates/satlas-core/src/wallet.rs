//! Turns raw transaction history plus the set of wallet-owned scripts into a
//! coin-level view: which outputs we own, which are still unspent, and what
//! each transaction did from the wallet's point of view.

use std::collections::{HashMap, HashSet};

use miniscript::bitcoin::{OutPoint, ScriptBuf, Txid};
use serde::{Deserialize, Serialize};

use crate::chain::EsploraTx;
use crate::descriptor::{Chain, DerivedAddress};

/// An unspent output controlled by the wallet.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Utxo {
    pub txid: Txid,
    pub vout: u32,
    /// Satoshis.
    pub value: u64,
    pub address: String,
    pub script_pubkey: ScriptBuf,
    pub chain: Chain,
    pub index: u32,
    /// `None` while unconfirmed.
    pub height: Option<u32>,
    pub time: Option<u64>,
}

impl Utxo {
    pub fn outpoint(&self) -> OutPoint {
        OutPoint::new(self.txid, self.vout)
    }
}

/// What a transaction did from this wallet's perspective.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TxKind {
    /// No wallet inputs, at least one wallet output.
    Receive,
    /// Wallet inputs, at least one non-wallet output.
    Send,
    /// Wallet inputs and every output back to the wallet.
    SelfTransfer,
}

/// A transaction summarised relative to the wallet.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletTx {
    pub txid: Txid,
    pub kind: TxKind,
    pub height: Option<u32>,
    pub time: Option<u64>,
    pub fee: u64,
    /// Sum of wallet-owned inputs, sats.
    pub value_in: u64,
    /// Sum of wallet-owned outputs, sats.
    pub value_out: u64,
    /// `value_out - value_in`; negative when sending.
    pub net: i64,
    /// Indices into `vin` that the wallet owns.
    pub our_inputs: Vec<u32>,
    /// Indices into `vout` that the wallet owns.
    pub our_outputs: Vec<u32>,
    pub num_inputs: u32,
    pub num_outputs: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletSnapshot {
    pub utxos: Vec<Utxo>,
    pub txs: Vec<WalletTx>,
    /// Sum of all UTXOs, sats.
    pub balance: u64,
    /// Number of wallet addresses that appear on-chain.
    pub addresses_used: u32,
}

/// Build a snapshot from every transaction touching the wallet and the
/// addresses the wallet has derived (must cover all scripts in `txs`).
pub fn build(txs: &[EsploraTx], addresses: &[DerivedAddress]) -> WalletSnapshot {
    let ours: HashMap<&ScriptBuf, &DerivedAddress> =
        addresses.iter().map(|a| (&a.script_pubkey, a)).collect();

    // Dedupe: the same tx is returned once per wallet address it touches.
    let mut seen = HashSet::new();
    let txs: Vec<&EsploraTx> = txs.iter().filter(|t| seen.insert(t.txid)).collect();

    let spent: HashSet<OutPoint> = txs
        .iter()
        .flat_map(|t| t.vin.iter().map(|i| OutPoint::new(i.txid, i.vout)))
        .collect();

    let mut utxos = Vec::new();
    let mut summaries = Vec::with_capacity(txs.len());
    let mut used_scripts = HashSet::new();

    for tx in &txs {
        let mut our_inputs = Vec::new();
        let mut value_in = 0u64;
        for (i, vin) in tx.vin.iter().enumerate() {
            if let Some(prev) = &vin.prevout {
                if ours.contains_key(&prev.scriptpubkey) {
                    our_inputs.push(i as u32);
                    value_in += prev.value;
                }
            }
        }

        let mut our_outputs = Vec::new();
        let mut value_out = 0u64;
        for (n, vout) in tx.vout.iter().enumerate() {
            let Some(addr) = ours.get(&vout.scriptpubkey) else { continue };
            our_outputs.push(n as u32);
            value_out += vout.value;
            used_scripts.insert(&vout.scriptpubkey);

            let outpoint = OutPoint::new(tx.txid, n as u32);
            if !spent.contains(&outpoint) {
                utxos.push(Utxo {
                    txid: tx.txid,
                    vout: n as u32,
                    value: vout.value,
                    address: addr.address.clone(),
                    script_pubkey: vout.scriptpubkey.clone(),
                    chain: addr.chain,
                    index: addr.index,
                    height: tx.status.block_height,
                    time: tx.status.block_time,
                });
            }
        }

        if our_inputs.is_empty() && our_outputs.is_empty() {
            continue; // shouldn't happen for txs fetched by our address
        }

        let kind = if our_inputs.is_empty() {
            TxKind::Receive
        } else if our_outputs.len() == tx.vout.len() {
            TxKind::SelfTransfer
        } else {
            TxKind::Send
        };

        summaries.push(WalletTx {
            txid: tx.txid,
            kind,
            height: tx.status.block_height,
            time: tx.status.block_time,
            fee: tx.fee,
            value_in,
            value_out,
            net: value_out as i64 - value_in as i64,
            our_inputs,
            our_outputs,
            num_inputs: tx.vin.len() as u32,
            num_outputs: tx.vout.len() as u32,
        });
    }

    // Newest first; unconfirmed (None) sorts before everything.
    let newest_first = |h: Option<u32>| std::cmp::Reverse(h.map_or(u32::MAX, |h| h));
    utxos.sort_by_key(|u| (newest_first(u.height), u.txid, u.vout));
    summaries.sort_by_key(|t| (newest_first(t.height), t.txid));

    let balance = utxos.iter().map(|u| u.value).sum();

    WalletSnapshot { utxos, txs: summaries, balance, addresses_used: used_scripts.len() as u32 }
}

#[cfg(test)]
pub(crate) mod fixtures {
    //! Hand-built transaction fixtures shared by wallet and heuristics tests.
    use super::*;
    use crate::chain::{EsploraStatus, EsploraVin, EsploraVout};
    use miniscript::bitcoin::hashes::Hash;

    pub fn txid(n: u8) -> Txid {
        Txid::from_byte_array([n; 32])
    }

    /// A fake wallet script: OP_RETURN <chain> <index>, unique per path.
    pub fn script(chain: u32, index: u32) -> ScriptBuf {
        ScriptBuf::from_bytes(vec![0x6a, 0x02, chain as u8, index as u8])
    }

    pub fn foreign_script(n: u8) -> ScriptBuf {
        ScriptBuf::from_bytes(vec![0x6a, 0x01, n])
    }

    pub fn addr(chain: u32, index: u32) -> DerivedAddress {
        DerivedAddress {
            address: format!("addr-{chain}-{index}"),
            script_pubkey: script(chain, index),
            chain,
            index,
        }
    }

    pub fn out(script: ScriptBuf, value: u64) -> EsploraVout {
        EsploraVout { scriptpubkey: script, scriptpubkey_address: None, scriptpubkey_type: None, value }
    }

    pub fn inp(txid: Txid, vout: u32, prevout: EsploraVout) -> EsploraVin {
        EsploraVin { txid, vout, prevout: Some(prevout), is_coinbase: false, sequence: 0xffffffff }
    }

    pub fn tx(id: u8, height: u32, vin: Vec<EsploraVin>, vout: Vec<EsploraVout>) -> EsploraTx {
        let fee = vin.iter().filter_map(|i| i.prevout.as_ref()).map(|p| p.value).sum::<u64>()
            .saturating_sub(vout.iter().map(|o| o.value).sum());
        EsploraTx {
            txid: txid(id),
            version: 2,
            locktime: 0,
            vin,
            vout,
            size: 0,
            weight: 0,
            fee,
            status: EsploraStatus { confirmed: true, block_height: Some(height), block_time: Some(height as u64 * 600) },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::fixtures::*;
    use super::*;

    /// Scenario: receive 100k to 0/0, receive 50k to 0/1, then spend 0/0
    /// sending 60k out with 39k change to 1/0.
    fn scenario() -> (Vec<EsploraTx>, Vec<DerivedAddress>) {
        let addrs = vec![addr(0, 0), addr(0, 1), addr(0, 2), addr(1, 0)];
        let t1 = tx(1, 100, vec![inp(txid(9), 0, out(foreign_script(1), 200_000))], vec![out(script(0, 0), 100_000), out(foreign_script(1), 99_000)]);
        let t2 = tx(2, 101, vec![inp(txid(8), 0, out(foreign_script(2), 60_000))], vec![out(script(0, 1), 50_000)]);
        let t3 = tx(3, 102, vec![inp(txid(1), 0, out(script(0, 0), 100_000))], vec![out(foreign_script(3), 60_000), out(script(1, 0), 39_000)]);
        (vec![t1, t2, t3], addrs)
    }

    #[test]
    fn finds_unspent_outputs_and_balance() {
        let (txs, addrs) = scenario();
        let snap = build(&txs, &addrs);
        let mut coins: Vec<(u32, u32, u64)> = snap.utxos.iter().map(|u| (u.chain, u.index, u.value)).collect();
        coins.sort();
        assert_eq!(coins, vec![(0, 1, 50_000), (1, 0, 39_000)]);
        assert_eq!(snap.balance, 89_000);
        assert_eq!(snap.addresses_used, 3);
    }

    #[test]
    fn classifies_transactions() {
        let (txs, addrs) = scenario();
        let snap = build(&txs, &addrs);
        let by_id: HashMap<Txid, &WalletTx> = snap.txs.iter().map(|t| (t.txid, t)).collect();
        assert_eq!(by_id[&txid(1)].kind, TxKind::Receive);
        assert_eq!(by_id[&txid(1)].net, 100_000);
        assert_eq!(by_id[&txid(3)].kind, TxKind::Send);
        assert_eq!(by_id[&txid(3)].net, -61_000);
        assert_eq!(by_id[&txid(3)].fee, 1_000);
        assert_eq!(by_id[&txid(3)].our_outputs, vec![1]);
        // newest first
        assert_eq!(snap.txs[0].txid, txid(3));
    }

    #[test]
    fn dedupes_transactions_seen_via_multiple_addresses() {
        let (mut txs, addrs) = scenario();
        txs.push(txs[0].clone());
        let snap = build(&txs, &addrs);
        assert_eq!(snap.txs.len(), 3);
        assert_eq!(snap.balance, 89_000);
    }

    #[test]
    fn self_transfer_when_all_outputs_ours() {
        let addrs = vec![addr(0, 0), addr(1, 0)];
        let t1 = tx(1, 100, vec![inp(txid(9), 0, out(foreign_script(1), 10_000))], vec![out(script(0, 0), 10_000)]);
        let t2 = tx(2, 101, vec![inp(txid(1), 0, out(script(0, 0), 10_000))], vec![out(script(1, 0), 9_500)]);
        let snap = build(&[t1, t2], &addrs);
        assert_eq!(snap.txs[0].kind, TxKind::SelfTransfer);
        assert_eq!(snap.utxos.len(), 1);
    }
}
