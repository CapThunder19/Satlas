//! Address reuse: an address that receives more than once ties every payment
//! to it together, and lets an observer watch for future activity.

use std::collections::HashMap;

use miniscript::bitcoin::ScriptBuf;

use super::{Finding, FindingKind, Severity};
use crate::chain::EsploraTx;
use crate::descriptor::DerivedAddress;
use crate::labels::Certainty;
use crate::wallet::Utxo;

/// How many outputs each wallet script has ever received.
pub(super) fn count_address_uses<'a>(
    txs: &[&'a EsploraTx],
    ours: &HashMap<&ScriptBuf, &DerivedAddress>,
) -> HashMap<&'a ScriptBuf, u32> {
    let mut counts = HashMap::new();
    for tx in txs {
        for o in &tx.vout {
            if ours.contains_key(&o.scriptpubkey) {
                *counts.entry(&o.scriptpubkey).or_insert(0) += 1;
            }
        }
    }
    counts
}

pub(super) fn findings(use_count: &HashMap<&ScriptBuf, u32>, utxos: &[Utxo]) -> Vec<Finding> {
    let mut out = Vec::new();
    let mut reused: Vec<(&ScriptBuf, u32)> =
        use_count.iter().filter(|(_, &n)| n > 1).map(|(s, &n)| (*s, n)).collect();
    reused.sort_by_key(|(_, n)| std::cmp::Reverse(*n));

    for (script, n) in reused {
        let coins: Vec<_> = utxos.iter().filter(|u| &u.script_pubkey == script).collect();
        let address = coins
            .first()
            .map(|u| u.address.clone())
            .unwrap_or_else(|| script.to_hex_string());
        let unspent = coins.len();
        out.push(Finding {
            kind: FindingKind::AddressReuse,
            severity: if unspent > 0 { Severity::Warning } else { Severity::Info },
            certainty: Certainty::Known,
            title: format!("Address used {n} times"),
            explanation: format!(
                "{address} has received {n} separate payments{}. Everyone who paid this address, and anyone \
                 watching it, can see all of them and link them to one recipient. Spending any of these coins \
                 links their entire history to that spend.",
                if unspent > 0 {
                    format!(", {unspent} of which {} still unspent", if unspent == 1 { "is" } else { "are" })
                } else {
                    String::new()
                }
            ),
            txid: None,
            addresses: vec![address],
            coins: coins.iter().map(|u| u.outpoint().into()).collect(),
            labels: Vec::new(),
        });
    }
    out
}
