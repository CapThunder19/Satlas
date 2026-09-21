//! Change detection from the *observer's* side.
//!
//! We already know which output is ours. The question this module answers is
//! whether a stranger looking at the transaction could tell too, which is what
//! decides if the change coin inherits the spend's linkability.

use std::collections::HashMap;

use miniscript::bitcoin::{OutPoint, ScriptBuf, Txid};
use serde::{Deserialize, Serialize};

use super::{Finding, FindingKind, Severity};
use crate::chain::EsploraTx;
use crate::descriptor::DerivedAddress;
use crate::labels::Certainty;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ChangeSignalKind {
    /// The other output is a round number of sats; people pay round amounts, change is never round.
    RoundPayment,
    /// Only one output matches the script type of the inputs.
    ScriptTypeMismatch,
    /// Change went to an address that had already been used.
    ReusedAddress,
    /// One output is smaller than the smallest input; a payment that small
    /// would not have needed that input, so it must be change.
    UnnecessaryInput,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeSignal {
    pub kinds: Vec<ChangeSignalKind>,
    pub explanation: String,
}

fn script_kind(s: &ScriptBuf) -> &'static str {
    if s.is_p2wpkh() {
        "p2wpkh"
    } else if s.is_p2tr() {
        "p2tr"
    } else if s.is_p2wsh() {
        "p2wsh"
    } else if s.is_p2sh() {
        "p2sh"
    } else if s.is_p2pkh() {
        "p2pkh"
    } else {
        "other"
    }
}

fn is_round(sats: u64) -> bool {
    sats >= 10_000 && sats % 10_000 == 0
}

/// For a two-output spend where `change_vout` is ours, list the signals an
/// observer could use to pick out the change. `None` when nothing gives it away.
pub(super) fn observer_signals(
    tx: &EsploraTx,
    change_vout: u32,
    ours: &HashMap<&ScriptBuf, &DerivedAddress>,
    use_count: &HashMap<&ScriptBuf, u32>,
) -> Option<ChangeSignal> {
    // Only the classic 1-payment + 1-change shape is analysed; batched or
    // multi-recipient spends need different reasoning.
    if tx.vout.len() != 2 {
        return None;
    }
    let change = &tx.vout[change_vout as usize];
    let payment = &tx.vout[1 - change_vout as usize];
    if ours.contains_key(&payment.scriptpubkey) {
        return None; // self-transfer, not a payment
    }

    let mut kinds = Vec::new();
    let mut reasons = Vec::new();

    if is_round(payment.value) && !is_round(change.value) {
        kinds.push(ChangeSignalKind::RoundPayment);
        reasons.push(format!(
            "the other output is a round {} sat, which looks like an intended payment, leaving {} sat as change",
            payment.value, change.value
        ));
    }

    let input_kinds: Vec<&str> =
        tx.vin.iter().filter_map(|i| i.prevout.as_ref()).map(|p| script_kind(&p.scriptpubkey)).collect();
    if !input_kinds.is_empty() && input_kinds.iter().all(|k| *k == input_kinds[0]) {
        let ik = input_kinds[0];
        if script_kind(&change.scriptpubkey) == ik && script_kind(&payment.scriptpubkey) != ik {
            kinds.push(ChangeSignalKind::ScriptTypeMismatch);
            reasons.push(format!(
                "the inputs and the change output are all {ik} while the payment output is {}",
                script_kind(&payment.scriptpubkey)
            ));
        }
    }

    if use_count.get(&change.scriptpubkey).copied().unwrap_or(0) > 1 {
        kinds.push(ChangeSignalKind::ReusedAddress);
        reasons.push("the change went to an address that had been used before".to_string());
    }

    let min_input = tx.vin.iter().filter_map(|i| i.prevout.as_ref()).map(|p| p.value).min();
    if let Some(min_in) = min_input {
        if tx.vin.len() > 1 && change.value < min_in && payment.value >= min_in {
            kinds.push(ChangeSignalKind::UnnecessaryInput);
            reasons.push(format!(
                "if {} sat were the payment, the smallest input ({} sat) would not have been needed",
                change.value, min_in
            ));
        }
    }

    if kinds.is_empty() {
        return None;
    }
    let mut explanation = reasons.join("; ");
    if let Some(c) = explanation.get_mut(0..1) {
        c.make_ascii_uppercase();
    }
    explanation.push('.');
    Some(ChangeSignal { kinds, explanation })
}

pub(super) fn finding(txid: Txid, change: OutPoint, signal: &ChangeSignal) -> Finding {
    Finding {
        kind: FindingKind::ChangeRevealed,
        severity: Severity::Info,
        certainty: Certainty::Inferred,
        title: "Change output is identifiable".into(),
        explanation: format!(
            "In transaction {txid}, an observer can probably tell which output is your change: {} \
             That means the change coin is publicly linked to the inputs you spent.",
            signal.explanation
        ),
        txid: Some(txid),
        addresses: Vec::new(),
        coins: vec![change.into()],
        labels: Vec::new(),
    }
}
