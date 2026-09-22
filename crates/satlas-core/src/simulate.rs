//! Pre-spend privacy simulator.
//!
//! Given the analysed wallet and an intended payment, pick the inputs a
//! typical wallet would (or the ones the user chose), then explain what new
//! relationships that transaction would make public.

use std::collections::{BTreeSet, HashMap, HashSet};

use miniscript::bitcoin::{OutPoint, ScriptBuf};
use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};
use crate::fmt::btc;
use crate::heuristics::{Analysis, CoinAnalysis, CoinRef, Severity};
use crate::labels::Certainty;
use crate::wallet::{Utxo, WalletSnapshot};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Strategy {
    /// Spend the biggest coins first; the default in many wallets.
    LargestFirst,
    /// First-in-first-out by confirmation height.
    OldestFirst,
    /// Consolidate: smallest coins first.
    SmallestFirst,
    /// Prefer a subset that needs no change; else largest-first.
    ExactMatch,
    /// Only coins from a single cluster, minimising new links; else largest-first.
    PrivacyAware,
    /// The user picked the coins.
    Manual,
}

pub const ALL_STRATEGIES: [Strategy; 5] = [
    Strategy::LargestFirst,
    Strategy::OldestFirst,
    Strategy::SmallestFirst,
    Strategy::ExactMatch,
    Strategy::PrivacyAware,
];

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpendRequest {
    /// Satoshis to the recipient.
    pub amount: u64,
    /// sat/vB.
    pub fee_rate: f64,
    pub strategy: Strategy,
    /// Required when `strategy == Manual`; ignored otherwise.
    #[serde(default)]
    pub manual_inputs: Vec<CoinRef>,
    /// Recipient script type, for fee sizing. Defaults to p2wpkh.
    #[serde(default)]
    pub recipient_script: Option<ScriptBuf>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum LinkageKind {
    /// Inputs carry different user labels that were not publicly linked before.
    LabelMixing,
    /// Inputs come from clusters an observer had not connected.
    ClusterMerge,
    /// An input sits on a reused address, dragging its whole history along.
    ReusedAddressInput,
    /// An input has no label; you may be linking something you forgot about.
    UnlabelledInput,
    /// The change output will be obvious to an observer.
    ChangeRevealed,
    /// Change is tiny; it will be costly to spend and easy to spot.
    DustChange,
    /// Every input was already linked: this spend reveals nothing new.
    NothingNew,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Linkage {
    pub kind: LinkageKind,
    pub severity: Severity,
    pub certainty: Certainty,
    pub title: String,
    pub explanation: String,
    #[serde(default)]
    pub coins: Vec<CoinRef>,
    #[serde(default)]
    pub labels: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Verdict {
    /// Nothing new is revealed.
    Clean,
    /// Minor or inferred leakage.
    Caution,
    /// Creates a new, previously absent, public link.
    Linking,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Simulation {
    pub strategy: Strategy,
    pub inputs: Vec<CoinRef>,
    pub input_total: u64,
    pub amount: u64,
    pub fee: u64,
    pub vsize: u64,
    /// `None` when the inputs are consumed exactly (no change output).
    pub change: Option<u64>,
    pub verdict: Verdict,
    pub summary: String,
    pub linkages: Vec<Linkage>,
    /// Distinct clusters the inputs are drawn from.
    pub clusters_touched: Vec<u32>,
}

// ---- fee model -------------------------------------------------------------

const TX_OVERHEAD_VB: f64 = 10.5;
const DUST_SATS: u64 = 546;

fn input_vbytes(spk: &ScriptBuf) -> f64 {
    if spk.is_p2wpkh() {
        68.0
    } else if spk.is_p2tr() {
        57.5
    } else if spk.is_p2sh() {
        91.0 // assume p2sh-p2wpkh
    } else if spk.is_p2pkh() {
        148.0
    } else {
        104.5 // p2wsh 2-of-3-ish guess
    }
}

fn output_vbytes(spk: Option<&ScriptBuf>) -> f64 {
    match spk {
        Some(s) if s.is_p2tr() || s.is_p2wsh() => 43.0,
        Some(s) if s.is_p2pkh() => 34.0,
        Some(s) if s.is_p2sh() => 32.0,
        _ => 31.0,
    }
}

fn fee_for(inputs: &[&Utxo], n_outputs: usize, recipient: Option<&ScriptBuf>, change_spk: Option<&ScriptBuf>, rate: f64) -> (u64, u64) {
    let mut vb = TX_OVERHEAD_VB + inputs.iter().map(|u| input_vbytes(&u.script_pubkey)).sum::<f64>();
    vb += output_vbytes(recipient);
    if n_outputs == 2 {
        vb += output_vbytes(change_spk);
    }
    let vsize = vb.ceil() as u64;
    ((vsize as f64 * rate).ceil() as u64, vsize)
}

// ---- coin selection --------------------------------------------------------

struct Ctx<'a> {
    utxos: Vec<&'a Utxo>,
    coin: HashMap<OutPoint, &'a CoinAnalysis>,
}

impl<'a> Ctx<'a> {
    fn new(snapshot: &'a WalletSnapshot, analysis: &'a Analysis) -> Self {
        let coin = analysis.coins.iter().map(|c| (OutPoint::new(c.txid, c.vout), c)).collect();
        Self { utxos: snapshot.utxos.iter().collect(), coin }
    }

    fn info(&self, u: &Utxo) -> &'a CoinAnalysis {
        self.coin[&u.outpoint()]
    }
}

/// Accumulate coins in the given order until amount + fee is covered.
fn accumulate<'a>(order: &[&'a Utxo], req: &SpendRequest) -> Option<Vec<&'a Utxo>> {
    let mut chosen: Vec<&Utxo> = Vec::new();
    let mut total = 0u64;
    for u in order {
        chosen.push(u);
        total += u.value;
        let (fee, _) = fee_for(&chosen, 2, req.recipient_script.as_ref(), None, req.fee_rate);
        if total >= req.amount + fee {
            return Some(chosen);
        }
    }
    None
}

fn select<'a>(ctx: &Ctx<'a>, req: &SpendRequest) -> Result<Vec<&'a Utxo>> {
    let mut order = ctx.utxos.clone();
    let available: u64 = order.iter().map(|u| u.value).sum();
    let fail = || {
        let (min_fee, _) = fee_for(&[], 1, req.recipient_script.as_ref(), None, req.fee_rate);
        Error::InsufficientFunds { needed: req.amount + min_fee, available }
    };

    match req.strategy {
        Strategy::Manual => {
            let want: HashSet<OutPoint> = req.manual_inputs.iter().map(|c| OutPoint::from(*c)).collect();
            let chosen: Vec<&Utxo> = order.iter().copied().filter(|u| want.contains(&u.outpoint())).collect();
            if chosen.len() != want.len() {
                return Err(Error::Transaction("a selected coin is not in the wallet".into()));
            }
            let total: u64 = chosen.iter().map(|u| u.value).sum();
            // Sufficient if it can fund at least a no-change transaction.
            let (fee, _) = fee_for(&chosen, 1, req.recipient_script.as_ref(), None, req.fee_rate);
            if total < req.amount + fee {
                return Err(Error::InsufficientFunds { needed: req.amount + fee, available: total });
            }
            Ok(chosen)
        }
        Strategy::LargestFirst => {
            order.sort_by_key(|u| std::cmp::Reverse(u.value));
            accumulate(&order, req).ok_or_else(fail)
        }
        Strategy::SmallestFirst => {
            order.sort_by_key(|u| u.value);
            accumulate(&order, req).ok_or_else(fail)
        }
        Strategy::OldestFirst => {
            order.sort_by_key(|u| (u.height.unwrap_or(u32::MAX), u.txid, u.vout));
            accumulate(&order, req).ok_or_else(fail)
        }
        Strategy::ExactMatch => {
            if let Some(exact) = exact_match(&order, req) {
                return Ok(exact);
            }
            order.sort_by_key(|u| std::cmp::Reverse(u.value));
            accumulate(&order, req).ok_or_else(fail)
        }
        Strategy::PrivacyAware => {
            // Try each cluster on its own, smallest sufficient first; prefer
            // clusters whose coins share one label.
            let mut by_cluster: HashMap<u32, Vec<&Utxo>> = HashMap::new();
            for u in &order {
                by_cluster.entry(ctx.info(u).cluster_id).or_default().push(u);
            }
            let mut candidates: Vec<Vec<&Utxo>> = Vec::new();
            for (_, mut coins) in by_cluster {
                coins.sort_by_key(|u| std::cmp::Reverse(u.value));
                if let Some(sel) = accumulate(&coins, req) {
                    candidates.push(sel);
                }
            }
            candidates.sort_by_key(|sel| {
                let labels: BTreeSet<&str> = sel
                    .iter()
                    .flat_map(|u| ctx.info(u).labels.iter().filter(|l| l.certainty == Certainty::Known).map(|l| l.text.as_str()))
                    .collect();
                let reused = sel.iter().filter(|u| ctx.info(u).address_use_count > 1).count();
                let total: u64 = sel.iter().map(|u| u.value).sum();
                (labels.len().max(1), reused, sel.len(), total)
            });
            if let Some(best) = candidates.into_iter().next() {
                return Ok(best);
            }
            order.sort_by_key(|u| std::cmp::Reverse(u.value));
            accumulate(&order, req).ok_or_else(fail)
        }
    }
}

/// Small exhaustive search for a subset whose value lands within a tight
/// window above amount+fee, so no change output is needed. Bounded for speed.
fn exact_match<'a>(utxos: &[&'a Utxo], req: &SpendRequest) -> Option<Vec<&'a Utxo>> {
    const MAX_COINS: usize = 16;
    let pool: Vec<&Utxo> = utxos.iter().copied().take(MAX_COINS).collect();
    let n = pool.len();
    let mut best: Option<(u64, Vec<&Utxo>)> = None;
    for mask in 1u32..(1u32 << n) {
        let sel: Vec<&Utxo> = (0..n).filter(|i| mask & (1 << i) != 0).map(|i| pool[i]).collect();
        let total: u64 = sel.iter().map(|u| u.value).sum();
        let (fee, _) = fee_for(&sel, 1, req.recipient_script.as_ref(), None, req.fee_rate);
        let need = req.amount + fee;
        if total >= need && total - need <= DUST_SATS {
            let waste = total - need;
            if best.as_ref().is_none_or(|(w, _)| waste < *w) {
                best = Some((waste, sel));
            }
        }
    }
    best.map(|(_, s)| s)
}

// ---- analysis of the chosen inputs -----------------------------------------

pub fn simulate(snapshot: &WalletSnapshot, analysis: &Analysis, req: &SpendRequest) -> Result<Simulation> {
    if req.amount == 0 {
        return Err(Error::Transaction("amount must be greater than zero".into()));
    }
    let ctx = Ctx::new(snapshot, analysis);
    let inputs = select(&ctx, req)?;
    Ok(describe(&ctx, req, inputs))
}

/// Run every automatic strategy so the UI can compare them side by side.
/// Strategies that cannot fund the payment are omitted.
pub fn simulate_all(snapshot: &WalletSnapshot, analysis: &Analysis, req: &SpendRequest) -> Vec<Simulation> {
    ALL_STRATEGIES
        .iter()
        .filter_map(|&strategy| simulate(snapshot, analysis, &SpendRequest { strategy, ..req.clone() }).ok())
        .collect()
}

fn describe(ctx: &Ctx, req: &SpendRequest, inputs: Vec<&Utxo>) -> Simulation {
    let input_total: u64 = inputs.iter().map(|u| u.value).sum();
    let change_spk = inputs.first().map(|u| &u.script_pubkey);

    // Decide whether a change output is worth creating.
    let (fee_no_change, vsize_no_change) = fee_for(&inputs, 1, req.recipient_script.as_ref(), None, req.fee_rate);
    let (fee_change, vsize_change) = fee_for(&inputs, 2, req.recipient_script.as_ref(), change_spk, req.fee_rate);
    let leftover = input_total.saturating_sub(req.amount + fee_change);
    let (fee, vsize, change) = if leftover > DUST_SATS {
        (fee_change, vsize_change, Some(leftover))
    } else {
        (input_total - req.amount, vsize_no_change, None) // leftover absorbed into fee
    };
    let _ = fee_no_change;

    let infos: Vec<&CoinAnalysis> = inputs.iter().map(|u| ctx.info(u)).collect();
    let refs: Vec<CoinRef> = inputs.iter().map(|u| u.outpoint().into()).collect();
    let mut linkages = Vec::new();

    // Clusters touched.
    let clusters: BTreeSet<u32> = infos.iter().map(|c| c.cluster_id).collect();
    let clusters_touched: Vec<u32> = clusters.iter().copied().collect();

    // Known labels per cluster, to tell "new" mixing from "already linked".
    let known_labels = |c: &CoinAnalysis| -> BTreeSet<String> {
        c.labels.iter().filter(|l| l.certainty == Certainty::Known).map(|l| l.text.clone()).collect()
    };
    let all_labels: BTreeSet<String> = infos.iter().flat_map(|c| known_labels(c)).collect();

    if clusters.len() > 1 {
        // Labels split across clusters = new information for an observer.
        let mut per_cluster: Vec<(u32, BTreeSet<String>, Vec<CoinRef>)> = clusters
            .iter()
            .map(|&id| {
                let members: Vec<&&CoinAnalysis> = infos.iter().filter(|c| c.cluster_id == id).collect();
                (
                    id,
                    members.iter().flat_map(|c| known_labels(c)).collect(),
                    members.iter().map(|c| CoinRef { txid: c.txid, vout: c.vout }).collect(),
                )
            })
            .collect();
        per_cluster.sort_by_key(|(id, _, _)| *id);

        let labelled_groups: Vec<&(u32, BTreeSet<String>, Vec<CoinRef>)> =
            per_cluster.iter().filter(|(_, l, _)| !l.is_empty()).collect();
        let distinct: BTreeSet<&String> = labelled_groups.iter().flat_map(|(_, l, _)| l.iter()).collect();

        if labelled_groups.len() >= 2 && distinct.len() >= 2 {
            let names: Vec<String> = distinct.iter().map(|s| s.to_string()).collect();
            linkages.push(Linkage {
                kind: LinkageKind::LabelMixing,
                severity: Severity::High,
                certainty: Certainty::Inferred,
                title: format!("Links your {} coins together", join_names(&names)),
                explanation: format!(
                    "This transaction would spend coins you labelled {} as inputs of one transaction. \
                     Until now those coins had never appeared together on-chain. Because Bitcoin transactions \
                     are public, anyone who knows the source of one of them (an employer, an exchange, a \
                     donation recipient) can now infer that the others belong to the same person.",
                    join_names(&names)
                ),
                coins: refs.clone(),
                labels: names,
            });
        }

        let group_desc: Vec<String> = per_cluster
            .iter()
            .map(|(id, l, coins)| {
                let label = if l.is_empty() { "unlabelled".to_string() } else { l.iter().cloned().collect::<Vec<_>>().join("/") };
                format!("group {} ({} coin{}, {label})", id + 1, coins.len(), if coins.len() == 1 { "" } else { "s" })
            })
            .collect();
        linkages.push(Linkage {
            kind: LinkageKind::ClusterMerge,
            severity: if linkages.is_empty() { Severity::Warning } else { Severity::Info },
            certainty: Certainty::Inferred,
            title: format!("Merges {} separately-known groups of coins", clusters.len()),
            explanation: format!(
                "The inputs come from {}. An observer applying the common-input-ownership heuristic would \
                 conclude all of these addresses, and every coin that later touches them, share one owner.",
                join_names(&group_desc)
            ),
            coins: refs.clone(),
            labels: Vec::new(),
        });
    }

    // Reused addresses among inputs.
    let reused: Vec<&&Utxo> = inputs.iter().filter(|u| ctx.info(u).address_use_count > 1).collect();
    if !reused.is_empty() {
        linkages.push(Linkage {
            kind: LinkageKind::ReusedAddressInput,
            severity: Severity::Warning,
            certainty: Certainty::Known,
            title: format!(
                "{} input{} on a reused address",
                reused.len(),
                if reused.len() == 1 { " sits" } else { "s sit" }
            ),
            explanation: {
                // Several inputs may sit on the same reused address; name it once.
                let mut addrs: Vec<String> = reused.iter().map(|u| u.address.clone()).collect();
                addrs.sort();
                addrs.dedup();
                format!(
                    "{} received more than one payment. Spending from {} ties every one of those payments, \
                     and everyone who sent them, to this transaction.",
                    join_names(&addrs),
                    if addrs.len() == 1 { "it" } else { "them" }
                )
            },
            coins: reused.iter().map(|u| u.outpoint().into()).collect(),
            labels: Vec::new(),
        });
    }

    // Unlabelled inputs.
    let unlabelled: Vec<CoinRef> = infos
        .iter()
        .filter(|c| c.labels.is_empty())
        .map(|c| CoinRef { txid: c.txid, vout: c.vout })
        .collect();
    if !unlabelled.is_empty() && !all_labels.is_empty() {
        linkages.push(Linkage {
            kind: LinkageKind::UnlabelledInput,
            severity: Severity::Info,
            certainty: Certainty::Unknown,
            title: format!("{} input{} unlabelled", unlabelled.len(), if unlabelled.len() == 1 { " is" } else { "s are" }),
            explanation: "Satlas cannot tell where these coins came from, so it cannot tell whether spending them \
                          alongside your labelled coins reveals something. Label them to get a complete picture."
                .into(),
            coins: unlabelled,
            labels: Vec::new(),
        });
    }

    // Change analysis.
    if let Some(chg) = change {
        let mut reasons = Vec::new();
        if req.amount >= 10_000 && req.amount % 10_000 == 0 && chg % 10_000 != 0 {
            reasons.push(format!("the payment is a round {} while the change is not", btc(req.amount)));
        }
        if let Some(r) = req.recipient_script.as_ref() {
            let in_kind = script_kind(&inputs[0].script_pubkey);
            if inputs.iter().all(|u| script_kind(&u.script_pubkey) == in_kind) && script_kind(r) != in_kind {
                reasons.push(format!("the recipient uses a {} address while your inputs and change are {in_kind}", script_kind(r)));
            }
        }
        if !reasons.is_empty() {
            linkages.push(Linkage {
                kind: LinkageKind::ChangeRevealed,
                severity: Severity::Info,
                certainty: Certainty::Inferred,
                title: "Your change output will be easy to identify".into(),
                explanation: format!(
                    "An observer can probably tell which output is change because {}. The change coin \
                     ({}) will then be publicly tied to every input of this spend.",
                    join_names(&reasons),
                    btc(chg)
                ),
                coins: Vec::new(),
                labels: Vec::new(),
            });
        }
        if chg < 5_000 {
            linkages.push(Linkage {
                kind: LinkageKind::DustChange,
                severity: Severity::Info,
                certainty: Certainty::Known,
                title: format!("Tiny change output ({chg} sats)"),
                explanation: "Very small change is easy to spot and may cost more in fees to spend later than it is worth. \
                              Consider adjusting the amount or adding it to the fee."
                    .into(),
                coins: Vec::new(),
                labels: Vec::new(),
            });
        }
    }

    if linkages.iter().all(|l| l.severity == Severity::Info) && clusters.len() == 1 {
        linkages.insert(
            0,
            Linkage {
                kind: LinkageKind::NothingNew,
                severity: Severity::Info,
                certainty: Certainty::Inferred,
                title: "No new links created".into(),
                explanation: if inputs.len() == 1 {
                    "A single input reveals nothing beyond what was already known about that coin.".into()
                } else {
                    "Every input already belongs to the same publicly-linkable group, so spending them together \
                     tells an observer nothing they could not already infer."
                        .into()
                },
                coins: Vec::new(),
                labels: Vec::new(),
            },
        );
    }

    let worst = linkages.iter().map(|l| l.severity).max().unwrap_or(Severity::Info);
    let verdict = match worst {
        Severity::High => Verdict::Linking,
        Severity::Warning => Verdict::Caution,
        Severity::Info => Verdict::Clean,
    };

    let summary = match verdict {
        Verdict::Clean => format!(
            "Spends {} coin{} from one group. Nothing new is revealed.",
            inputs.len(),
            if inputs.len() == 1 { "" } else { "s" }
        ),
        Verdict::Caution => format!(
            "Spends {} coin{} across {} group{}. Some history is exposed, but no labelled coins are newly linked.",
            inputs.len(),
            if inputs.len() == 1 { "" } else { "s" },
            clusters.len(),
            if clusters.len() == 1 { "" } else { "s" }
        ),
        Verdict::Linking => format!(
            "Spends {} coins across {} groups and publicly links your {} coins for the first time.",
            inputs.len(),
            clusters.len(),
            join_names(&all_labels.iter().cloned().collect::<Vec<_>>())
        ),
    };

    Simulation {
        strategy: req.strategy,
        inputs: refs,
        input_total,
        amount: req.amount,
        fee,
        vsize,
        change,
        verdict,
        summary,
        linkages,
        clusters_touched,
    }
}

fn script_kind(s: &ScriptBuf) -> &'static str {
    if s.is_p2wpkh() {
        "native segwit"
    } else if s.is_p2tr() {
        "taproot"
    } else if s.is_p2sh() {
        "wrapped segwit"
    } else if s.is_p2pkh() {
        "legacy"
    } else {
        "script"
    }
}

fn join_names(names: &[String]) -> String {
    match names {
        [] => String::new(),
        [a] => a.clone(),
        [a, b] => format!("{a} and {b}"),
        [rest @ .., last] => format!("{} and {last}", rest.join(", ")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::heuristics::analyze;
    use crate::labels::UserLabels;
    use crate::wallet::fixtures::*;
    use crate::wallet::build;

    /// Salary 1_000_000 @0/0, Donation 500_000 @0/1, Exchange 200_000 @0/2 (all unspent, separate).
    fn wallet() -> (WalletSnapshot, Analysis) {
        let addrs = vec![addr(0, 0), addr(0, 1), addr(0, 2), addr(1, 0)];
        let txs = vec![
            tx(1, 100, vec![inp(txid(91), 0, out(foreign_script(1), 1_100_000))], vec![out(script(0, 0), 1_000_000)]),
            tx(2, 101, vec![inp(txid(92), 0, out(foreign_script(2), 600_000))], vec![out(script(0, 1), 500_000)]),
            tx(3, 102, vec![inp(txid(93), 0, out(foreign_script(3), 300_000))], vec![out(script(0, 2), 200_000)]),
        ];
        let mut l = UserLabels::default();
        l.outputs.insert(format!("{}:0", txid(1)), "Salary".into());
        l.outputs.insert(format!("{}:0", txid(2)), "Donation".into());
        l.outputs.insert(format!("{}:0", txid(3)), "Exchange".into());
        let snap = build(&txs, &addrs);
        let a = analyze(&txs, &addrs, &snap, &l);
        (snap, a)
    }

    fn req(amount: u64, strategy: Strategy) -> SpendRequest {
        SpendRequest { amount, fee_rate: 10.0, strategy, manual_inputs: vec![], recipient_script: None }
    }

    #[test]
    fn single_input_is_clean() {
        let (s, a) = wallet();
        let sim = simulate(&s, &a, &req(150_000, Strategy::LargestFirst)).unwrap();
        assert_eq!(sim.inputs.len(), 1);
        assert_eq!(sim.verdict, Verdict::Clean);
        assert!(sim.change.is_some());
        assert_eq!(sim.input_total, 1_000_000);
        assert_eq!(sim.input_total, sim.amount + sim.fee + sim.change.unwrap());
        assert_eq!(sim.linkages[0].kind, LinkageKind::NothingNew);
    }

    #[test]
    fn mixing_labels_is_flagged_as_linking() {
        let (s, a) = wallet();
        // 1_200_000 needs Salary + Donation under largest-first.
        let sim = simulate(&s, &a, &req(1_200_000, Strategy::LargestFirst)).unwrap();
        assert_eq!(sim.inputs.len(), 2);
        assert_eq!(sim.verdict, Verdict::Linking);
        let mix = sim.linkages.iter().find(|l| l.kind == LinkageKind::LabelMixing).unwrap();
        assert_eq!(mix.labels, vec!["Donation", "Salary"]);
        assert!(mix.title.contains("Donation and Salary"));
        assert!(sim.summary.contains("links your Donation and Salary coins"));
        assert_eq!(sim.clusters_touched.len(), 2);
    }

    #[test]
    fn strategies_pick_different_coins() {
        let (s, a) = wallet();
        let largest = simulate(&s, &a, &req(150_000, Strategy::LargestFirst)).unwrap();
        let smallest = simulate(&s, &a, &req(150_000, Strategy::SmallestFirst)).unwrap();
        let oldest = simulate(&s, &a, &req(150_000, Strategy::OldestFirst)).unwrap();
        assert_eq!(largest.inputs[0].txid, txid(1));
        assert_eq!(smallest.inputs[0].txid, txid(3));
        assert_eq!(oldest.inputs[0].txid, txid(1));
    }

    #[test]
    fn exact_match_avoids_change() {
        let (s, a) = wallet();
        // Exchange coin 200_000 minus the 1-in-1-out fee for that coin.
        let exchange = s.utxos.iter().find(|u| u.txid == txid(3)).unwrap();
        let (fee, _) = fee_for(&[exchange], 1, None, None, 10.0);
        let sim = simulate(&s, &a, &req(200_000 - fee, Strategy::ExactMatch)).unwrap();
        assert_eq!(sim.inputs.len(), 1);
        assert_eq!(sim.inputs[0].txid, txid(3));
        assert!(sim.change.is_none());
        assert_eq!(sim.fee, fee);
    }

    #[test]
    fn privacy_aware_prefers_single_cluster() {
        let (s, a) = wallet();
        let sim = simulate(&s, &a, &req(150_000, Strategy::PrivacyAware)).unwrap();
        assert_eq!(sim.clusters_touched.len(), 1);
        assert_eq!(sim.verdict, Verdict::Clean);
    }

    #[test]
    fn manual_selection_and_errors() {
        let (s, a) = wallet();
        let mut r = req(100_000, Strategy::Manual);
        r.manual_inputs = vec![CoinRef { txid: txid(2), vout: 0 }, CoinRef { txid: txid(3), vout: 0 }];
        let sim = simulate(&s, &a, &r).unwrap();
        assert_eq!(sim.verdict, Verdict::Linking);

        r.manual_inputs = vec![CoinRef { txid: txid(3), vout: 0 }];
        r.amount = 500_000;
        assert!(matches!(simulate(&s, &a, &r), Err(Error::InsufficientFunds { .. })));

        assert!(matches!(simulate(&s, &a, &req(5_000_000, Strategy::LargestFirst)), Err(Error::InsufficientFunds { .. })));
        assert!(simulate(&s, &a, &req(0, Strategy::LargestFirst)).is_err());
    }

    #[test]
    fn round_amount_reveals_change() {
        let (s, a) = wallet();
        let sim = simulate(&s, &a, &req(500_000, Strategy::LargestFirst)).unwrap();
        assert!(sim.linkages.iter().any(|l| l.kind == LinkageKind::ChangeRevealed));
    }

    #[test]
    fn simulate_all_returns_fundable_strategies() {
        let (s, a) = wallet();
        let all = simulate_all(&s, &a, &req(150_000, Strategy::LargestFirst));
        assert_eq!(all.len(), ALL_STRATEGIES.len());
        let all = simulate_all(&s, &a, &req(1_650_000, Strategy::LargestFirst));
        // Needs all three coins under every strategy; all still fundable.
        assert!(all.iter().all(|s| s.inputs.len() == 3));
        assert!(all.iter().all(|s| s.verdict == Verdict::Linking));
    }
}
