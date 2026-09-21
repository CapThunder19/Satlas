//! Labels and the certainty model.
//!
//! Every conclusion Satlas presents carries a [`Certainty`] so heuristics are
//! never dressed up as facts.

use std::collections::HashMap;

use miniscript::bitcoin::{OutPoint, Txid};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Certainty {
    /// Insufficient information.
    Unknown,
    /// Follows from a heuristic that is usually, but not always, right.
    Inferred,
    /// Directly observable on-chain, or stated by the user.
    Known,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case", tag = "kind", content = "detail")]
pub enum LabelSource {
    /// The user labelled this coin / address / transaction.
    User,
    /// Propagated by a rule; the detail says which.
    Rule(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Label {
    pub text: String,
    pub certainty: Certainty,
    pub source: LabelSource,
}

impl Label {
    pub fn user(text: impl Into<String>) -> Self {
        Self { text: text.into(), certainty: Certainty::Known, source: LabelSource::User }
    }

    pub fn rule(text: impl Into<String>, rule: impl Into<String>) -> Self {
        Self { text: text.into(), certainty: Certainty::Inferred, source: LabelSource::Rule(rule.into()) }
    }
}

/// Labels the user has assigned, keyed the way BIP-329 keys them.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserLabels {
    /// Keyed by `"txid:vout"`.
    #[serde(default)]
    pub outputs: HashMap<String, String>,
    #[serde(default)]
    pub addresses: HashMap<String, String>,
    /// Keyed by txid hex.
    #[serde(default)]
    pub txs: HashMap<String, String>,
}

impl UserLabels {
    pub fn output(&self, op: &OutPoint) -> Option<&str> {
        self.outputs.get(&format!("{}:{}", op.txid, op.vout)).map(String::as_str)
    }

    pub fn address(&self, addr: &str) -> Option<&str> {
        self.addresses.get(addr).map(String::as_str)
    }

    pub fn tx(&self, txid: &Txid) -> Option<&str> {
        self.txs.get(&txid.to_string()).map(String::as_str)
    }

    pub fn is_empty(&self) -> bool {
        self.outputs.is_empty() && self.addresses.is_empty() && self.txs.is_empty()
    }
}
