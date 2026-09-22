//! Common-input-ownership heuristic (CIOH).
//!
//! An observer assumes all inputs of a transaction share an owner. We replay
//! the wallet's history oldest-first, unioning the addresses spent together,
//! and note which transaction first linked previously separate groups.
//! Change outputs we can identify (internal chain) join their inputs' group,
//! because a competent observer applies change heuristics too.

use std::collections::{BTreeSet, HashMap};

use miniscript::bitcoin::{OutPoint, ScriptBuf, Txid};
use serde::{Deserialize, Serialize};

use super::{CoinRef, Finding, FindingKind, Severity};
use crate::chain::EsploraTx;
use crate::descriptor::{DerivedAddress, INTERNAL};
use crate::labels::Certainty;
use crate::wallet::Utxo;

/// A set of wallet addresses an observer can link to one owner.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Cluster {
    pub id: u32,
    pub addresses: Vec<String>,
    /// Unspent coins currently in this cluster.
    pub coins: Vec<CoinRef>,
    /// Sum of those coins, sats.
    pub value: u64,
    /// Transactions whose inputs bound this cluster together.
    pub linking_txids: Vec<Txid>,
}

pub(super) struct Clustering {
    pub clusters: Vec<Cluster>,
    pub merge_findings: Vec<Finding>,
    coin_cluster: HashMap<OutPoint, u32>,
}

impl Clustering {
    pub fn cluster_of(&self, op: &OutPoint) -> u32 {
        self.coin_cluster[op]
    }
}

struct UnionFind {
    parent: Vec<usize>,
}

impl UnionFind {
    fn new(n: usize) -> Self {
        Self { parent: (0..n).collect() }
    }
    fn find(&mut self, i: usize) -> usize {
        if self.parent[i] != i {
            let root = self.find(self.parent[i]);
            self.parent[i] = root;
        }
        self.parent[i]
    }
    fn union(&mut self, a: usize, b: usize) -> bool {
        let (ra, rb) = (self.find(a), self.find(b));
        if ra == rb {
            return false;
        }
        self.parent[rb] = ra;
        true
    }
}

pub(super) fn build(
    txs: &[&EsploraTx],
    ours: &HashMap<&ScriptBuf, &DerivedAddress>,
    utxos: &[Utxo],
) -> Clustering {
    // Index every wallet script that ever appears.
    let mut scripts: Vec<&ScriptBuf> = ours.keys().copied().collect();
    scripts.sort_by_key(|s| (ours[*s].chain, ours[*s].index));
    let idx: HashMap<&ScriptBuf, usize> = scripts.iter().enumerate().map(|(i, s)| (*s, i)).collect();
    let mut uf = UnionFind::new(scripts.len());
    let mut linking: HashMap<usize, BTreeSet<Txid>> = HashMap::new();
    let mut merge_findings = Vec::new();

    for tx in txs {
        let inputs: Vec<usize> = tx
            .vin
            .iter()
            .filter_map(|i| i.prevout.as_ref())
            .filter_map(|p| idx.get(&p.scriptpubkey).copied())
            .collect();
        if inputs.is_empty() {
            continue;
        }

        // Which existing groups do these inputs come from, before this tx?
        let mut groups: BTreeSet<usize> = inputs.iter().map(|&i| uf.find(i)).collect();
        let change: Vec<usize> = tx
            .vout
            .iter()
            .filter_map(|o| idx.get(&o.scriptpubkey).copied())
            .filter(|&i| ours[scripts[i]].chain == INTERNAL)
            .collect();
        // A change output that lands on an already-clustered address also merges.
        for &c in &change {
            let r = uf.find(c);
            if linking.contains_key(&r) || groups.contains(&r) {
                groups.insert(r);
            }
        }

        // Only report when at least two groups had prior linking history;
        // absorbing a never-before-seen address is routine, not news.
        let established = groups.iter().filter(|g| linking.contains_key(g)).count();
        let merged_addresses: Vec<Vec<String>> = if established >= 2 {
            let mut by_group: HashMap<usize, Vec<String>> = groups.iter().map(|&g| (g, Vec::new())).collect();
            for i in 0..scripts.len() {
                let r = uf.find(i);
                if let Some(v) = by_group.get_mut(&r) {
                    v.push(ours[scripts[i]].address.clone());
                }
            }
            groups.iter().map(|g| by_group.remove(g).unwrap_or_default()).collect()
        } else {
            Vec::new()
        };

        let first = inputs[0];
        for &i in inputs.iter().chain(change.iter()) {
            uf.union(first, i);
        }
        let root = uf.find(first);
        linking.entry(root).or_default().insert(tx.txid);
        // Carry over linking txids from absorbed groups.
        for g in groups {
            if g != root {
                if let Some(set) = linking.remove(&g) {
                    linking.entry(root).or_default().extend(set);
                }
            }
        }

        if merged_addresses.len() > 1 {
            let n_inputs = inputs.len();
            let sizes: Vec<String> = merged_addresses
                .iter()
                .map(|g| format!("{} address{}", g.len(), if g.len() == 1 { "" } else { "es" }))
                .collect();
            merge_findings.push(Finding {
                kind: FindingKind::ClusterMerge,
                severity: Severity::Info,
                certainty: Certainty::Inferred,
                title: format!("Past spend linked {} previously separate groups", merged_addresses.len()),
                explanation: format!(
                    "Transaction {} spent {n_inputs} inputs drawn from {} groups of addresses ({}) that had never \
                     appeared together before. Under the common-input-ownership heuristic, an observer now \
                     assumes all of them belong to the same owner.",
                    tx.txid,
                    merged_addresses.len(),
                    sizes.join(" and "),
                ),
                txid: Some(tx.txid),
                addresses: merged_addresses.into_iter().flatten().collect(),
                coins: Vec::new(),
                labels: Vec::new(),
            });
        }
    }

    // Materialise clusters, numbering them in order of first appearance among UTXOs
    // so unused addresses do not produce empty clusters.
    let mut members: HashMap<usize, Vec<usize>> = HashMap::new();
    for i in 0..scripts.len() {
        members.entry(uf.find(i)).or_default().push(i);
    }
    let mut root_to_id: HashMap<usize, u32> = HashMap::new();
    let mut clusters: Vec<Cluster> = Vec::new();
    let mut coin_cluster = HashMap::new();

    for u in utxos {
        let root = uf.find(idx[&u.script_pubkey]);
        let id = *root_to_id.entry(root).or_insert_with(|| {
            let id = clusters.len() as u32;
            let addresses: Vec<String> =
                members[&root].iter().map(|&i| ours[scripts[i]].address.clone()).collect();
            clusters.push(Cluster {
                id,
                addresses,
                coins: Vec::new(),
                value: 0,
                linking_txids: linking.get(&root).map(|s| s.iter().copied().collect()).unwrap_or_default(),
            });
            id
        });
        let c = &mut clusters[id as usize];
        c.coins.push(u.outpoint().into());
        c.value += u.value;
        coin_cluster.insert(u.outpoint(), id);
    }

    // Trim cluster address lists to addresses that actually appeared on-chain
    // (scripts never used are not linkable to anything).
    let used: std::collections::HashSet<&ScriptBuf> = txs
        .iter()
        .flat_map(|t| {
            t.vout
                .iter()
                .map(|o| &o.scriptpubkey)
                .chain(t.vin.iter().filter_map(|i| i.prevout.as_ref()).map(|p| &p.scriptpubkey))
        })
        .collect();
    let used_addrs: std::collections::HashSet<&str> =
        used.iter().filter_map(|s| ours.get(*s)).map(|a| a.address.as_str()).collect();
    for c in &mut clusters {
        c.addresses.retain(|a| used_addrs.contains(a.as_str()));
    }

    Clustering { clusters, merge_findings, coin_cluster }
}
