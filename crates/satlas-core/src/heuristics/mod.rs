//! Explainable privacy heuristics.
//!
//! Each heuristic is deterministic and traces back to observable chain data or
//! an explicit user label. Results carry a [`Certainty`].

mod change;
mod cluster;
mod reuse;
#[cfg(test)]
mod tests;

use std::collections::{HashMap, HashSet};

use miniscript::bitcoin::{OutPoint, Txid};
use serde::{Deserialize, Serialize};

use crate::chain::EsploraTx;
use crate::descriptor::{DerivedAddress, INTERNAL};
use crate::labels::{Certainty, Label, UserLabels};
use crate::wallet::{TxKind, WalletSnapshot};

pub use change::{ChangeSignal, ChangeSignalKind};
pub use cluster::Cluster;

/// Serialisable outpoint (`bitcoin::OutPoint` serialises awkwardly for JS).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CoinRef {
    pub txid: Txid,
    pub vout: u32,
}

impl From<OutPoint> for CoinRef {
    fn from(o: OutPoint) -> Self {
        Self { txid: o.txid, vout: o.vout }
    }
}

impl From<CoinRef> for OutPoint {
    fn from(c: CoinRef) -> Self {
        OutPoint::new(c.txid, c.vout)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OriginKind {
    /// Change returned from one of our own spends.
    Change,
    /// Received from an external party.
    Receive,
    /// Moved between our own addresses (every output was ours).
    SelfTransfer,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Origin {
    pub kind: OriginKind,
    pub certainty: Certainty,
    pub reason: String,
}

/// Everything the heuristics concluded about one unspent coin.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoinAnalysis {
    pub txid: Txid,
    pub vout: u32,
    /// Index into [`Analysis::clusters`].
    pub cluster_id: u32,
    pub origin: Origin,
    /// How many outputs (spent or not) this coin's address has received.
    pub address_use_count: u32,
    /// Effective labels: user labels first, then rule-derived ones.
    pub labels: Vec<Label>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Severity {
    Info,
    Warning,
    High,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum FindingKind {
    /// An address received more than once.
    AddressReuse,
    /// A past transaction spent inputs that were previously unlinked.
    ClusterMerge,
    /// An observer can probably tell which output of a spend was change.
    ChangeRevealed,
    /// Coins with different user labels already share a cluster.
    LabelsLinked,
}

/// A wallet-wide observation with a plain-English explanation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Finding {
    pub kind: FindingKind,
    pub severity: Severity,
    pub certainty: Certainty,
    pub title: String,
    pub explanation: String,
    pub txid: Option<Txid>,
    #[serde(default)]
    pub addresses: Vec<String>,
    #[serde(default)]
    pub coins: Vec<CoinRef>,
    #[serde(default)]
    pub labels: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Analysis {
    pub clusters: Vec<Cluster>,
    pub coins: Vec<CoinAnalysis>,
    pub findings: Vec<Finding>,
}

impl Analysis {
    pub fn coin(&self, op: &OutPoint) -> Option<&CoinAnalysis> {
        self.coins.iter().find(|c| c.txid == op.txid && c.vout == op.vout)
    }
}

/// Run every heuristic over the wallet.
///
/// `txs` must be the same deduplicated history `snapshot` was built from.
pub fn analyze(
    txs: &[EsploraTx],
    addresses: &[DerivedAddress],
    snapshot: &WalletSnapshot,
    user_labels: &UserLabels,
) -> Analysis {
    let ours: HashMap<_, _> = addresses.iter().map(|a| (&a.script_pubkey, a)).collect();
    let mut seen = HashSet::new();
    let mut txs: Vec<&EsploraTx> = txs.iter().filter(|t| seen.insert(t.txid)).collect();
    // Oldest first so cluster merges are attributed to the tx that caused them.
    txs.sort_by_key(|t| (t.status.block_height.unwrap_or(u32::MAX), t.txid));
    let by_id: HashMap<Txid, &EsploraTx> = txs.iter().map(|t| (t.txid, *t)).collect();
    let wallet_tx: HashMap<Txid, &crate::wallet::WalletTx> =
        snapshot.txs.iter().map(|t| (t.txid, t)).collect();

    let mut findings = Vec::new();

    // 1. Address reuse (observable fact).
    let use_count = reuse::count_address_uses(&txs, &ours);
    findings.extend(reuse::findings(&use_count, &snapshot.utxos));

    // 2. Common-input-ownership clustering, replayed chronologically.
    let clustering = cluster::build(&txs, &ours, &snapshot.utxos);
    findings.extend(clustering.merge_findings.iter().cloned());

    // 3. Per-coin origin and change detectability.
    let mut coins = Vec::with_capacity(snapshot.utxos.len());
    let mut change_findings: HashMap<Txid, Finding> = HashMap::new();
    for utxo in &snapshot.utxos {
        let op = utxo.outpoint();
        let tx = by_id[&utxo.txid];
        let wtx = wallet_tx[&utxo.txid];

        let origin = origin_of(utxo.chain, wtx.kind, wtx.our_outputs.len() == tx.vout.len());

        if wtx.kind == TxKind::Send && origin.kind == OriginKind::Change {
            if let Some(signal) = change::observer_signals(tx, utxo.vout, &ours, &use_count) {
                change_findings.entry(tx.txid).or_insert_with(|| change::finding(tx.txid, op, &signal));
            }
        }

        let cluster_id = clustering.cluster_of(&op);
        let labels = effective_labels(utxo, tx, &ours, user_labels, &wallet_tx);

        coins.push(CoinAnalysis {
            txid: utxo.txid,
            vout: utxo.vout,
            cluster_id,
            origin,
            address_use_count: *use_count.get(&utxo.script_pubkey).unwrap_or(&1),
            labels,
        });
    }
    findings.extend(change_findings.into_values());

    // 4. Distinct user labels already sharing a cluster.
    findings.extend(labels_linked(&clustering.clusters, &coins));

    findings.sort_by(|a, b| b.severity.cmp(&a.severity).then_with(|| a.title.cmp(&b.title)));

    Analysis { clusters: clustering.clusters, coins, findings }
}

fn origin_of(chain: u32, kind: TxKind, all_outputs_ours: bool) -> Origin {
    match kind {
        TxKind::Receive => Origin {
            kind: OriginKind::Receive,
            certainty: Certainty::Known,
            reason: "None of this transaction's inputs belong to this wallet, so the coin came from someone else.".into(),
        },
        TxKind::SelfTransfer => Origin {
            kind: OriginKind::SelfTransfer,
            certainty: Certainty::Known,
            reason: "Every input and output of this transaction belongs to this wallet.".into(),
        },
        TxKind::Send if chain == INTERNAL => Origin {
            kind: OriginKind::Change,
            certainty: Certainty::Known,
            reason: "This wallet spent in this transaction and the coin sits on the change (internal) chain of the descriptor.".into(),
        },
        TxKind::Send if all_outputs_ours => Origin {
            kind: OriginKind::SelfTransfer,
            certainty: Certainty::Known,
            reason: "All outputs returned to this wallet.".into(),
        },
        TxKind::Send => Origin {
            kind: OriginKind::Change,
            certainty: Certainty::Inferred,
            reason: "This wallet spent in this transaction and one output came back to a receive address. That is usually change, but could also be a payment to yourself.".into(),
        },
    }
}

/// User labels (Known) plus rule-propagated labels (Inferred).
fn effective_labels(
    utxo: &crate::wallet::Utxo,
    tx: &EsploraTx,
    ours: &HashMap<&miniscript::bitcoin::ScriptBuf, &DerivedAddress>,
    user: &UserLabels,
    wallet_tx: &HashMap<Txid, &crate::wallet::WalletTx>,
) -> Vec<Label> {
    let mut labels = Vec::new();
    let op = utxo.outpoint();

    if let Some(l) = user.output(&op) {
        labels.push(Label::user(l));
    }
    if let Some(l) = user.address(&utxo.address) {
        if !labels.iter().any(|x| x.text == l) {
            labels.push(Label::user(l));
        }
    }
    if let Some(l) = user.tx(&utxo.txid) {
        if !labels.iter().any(|x| x.text == l) {
            labels.push(Label::rule(l, "transaction label"));
        }
    }

    // Change inherits the label of the coins it came from, when unambiguous.
    let is_change = wallet_tx.get(&utxo.txid).is_some_and(|w| w.kind == TxKind::Send);
    if is_change && labels.is_empty() {
        let input_labels: HashSet<&str> = tx
            .vin
            .iter()
            .filter_map(|i| i.prevout.as_ref().filter(|p| ours.contains_key(&p.scriptpubkey)).map(|_| i))
            .filter_map(|i| {
                let prev = OutPoint::new(i.txid, i.vout);
                user.output(&prev).or_else(|| {
                    i.prevout.as_ref().and_then(|p| p.scriptpubkey_address.as_deref()).and_then(|a| user.address(a))
                })
            })
            .collect();
        if input_labels.len() == 1 {
            let l = input_labels.into_iter().next().unwrap();
            labels.push(Label::rule(l, "change from coins with this label"));
        }
    }

    labels
}

fn labels_linked(clusters: &[Cluster], coins: &[CoinAnalysis]) -> Vec<Finding> {
    let mut out = Vec::new();
    for cluster in clusters {
        let mut labels: Vec<&str> = coins
            .iter()
            .filter(|c| c.cluster_id == cluster.id)
            .flat_map(|c| c.labels.iter().filter(|l| l.certainty == Certainty::Known).map(|l| l.text.as_str()))
            .collect();
        labels.sort_unstable();
        labels.dedup();
        if labels.len() < 2 {
            continue;
        }
        let joined = labels.join(", ");
        out.push(Finding {
            kind: FindingKind::LabelsLinked,
            severity: Severity::Warning,
            certainty: Certainty::Inferred,
            title: format!("{joined} coins are already publicly linked"),
            explanation: format!(
                "Coins you labelled {joined} have been spent together in the past (or share an address), \
                 so a blockchain observer can already assume they belong to the same owner. \
                 Spending them together again does not reveal anything new."
            ),
            txid: None,
            addresses: cluster.addresses.clone(),
            coins: cluster.coins.clone(),
            labels: labels.into_iter().map(String::from).collect(),
        });
    }
    out
}
