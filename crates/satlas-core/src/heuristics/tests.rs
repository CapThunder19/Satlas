use std::collections::HashMap;

use super::*;
use crate::wallet::fixtures::*;
use crate::wallet::{build, Utxo};

/// Realistic history:
///  t1 (h100): receive 1_000_000 to 0/0            ("Salary")
///  t2 (h101): receive 500_000 to 0/1              ("Donation")
///  t3 (h102): receive 200_000 to 0/2              ("Exchange")
///  t4 (h103): receive 300_000 to 0/0 again        (address reuse!)
///  t5 (h104): spend 0/0 (first coin) -> pay 700_000 (round) + change 299_000 to 1/0
///  t6 (h105): spend 0/1 -> pay 123_456 + change 376_000 to 1/1
///  t7 (h106): spend 1/0 + 1/1 together -> pay 600_000 + change 74_000 to 1/2
///             (merges the Salary cluster with the Donation cluster)
fn history() -> (Vec<crate::chain::EsploraTx>, Vec<crate::descriptor::DerivedAddress>) {
    let addrs = vec![addr(0, 0), addr(0, 1), addr(0, 2), addr(0, 3), addr(1, 0), addr(1, 1), addr(1, 2), addr(1, 3)];
    let t1 = tx(1, 100, vec![inp(txid(91), 0, out(foreign_script(1), 1_100_000))], vec![out(script(0, 0), 1_000_000), out(foreign_script(1), 99_000)]);
    let t2 = tx(2, 101, vec![inp(txid(92), 0, out(foreign_script(2), 600_000))], vec![out(script(0, 1), 500_000), out(foreign_script(2), 99_000)]);
    let t3 = tx(3, 102, vec![inp(txid(93), 0, out(foreign_script(3), 300_000))], vec![out(script(0, 2), 200_000), out(foreign_script(3), 99_000)]);
    let t4 = tx(4, 103, vec![inp(txid(94), 0, out(foreign_script(4), 400_000))], vec![out(script(0, 0), 300_000), out(foreign_script(4), 99_000)]);
    let t5 = tx(5, 104, vec![inp(txid(1), 0, out(script(0, 0), 1_000_000))], vec![out(foreign_script(5), 700_000), out(script(1, 0), 299_000)]);
    let t6 = tx(6, 105, vec![inp(txid(2), 0, out(script(0, 1), 500_000))], vec![out(foreign_script(6), 123_456), out(script(1, 1), 376_000)]);
    let t7 = tx(
        7,
        106,
        vec![inp(txid(5), 1, out(script(1, 0), 299_000)), inp(txid(6), 1, out(script(1, 1), 376_000))],
        vec![out(foreign_script(7), 600_000), out(script(1, 2), 74_000)],
    );
    (vec![t1, t2, t3, t4, t5, t6, t7], addrs)
}

fn labels() -> UserLabels {
    let mut l = UserLabels::default();
    l.outputs.insert(format!("{}:0", txid(1)), "Salary".into());
    l.outputs.insert(format!("{}:0", txid(2)), "Donation".into());
    l.outputs.insert(format!("{}:0", txid(3)), "Exchange".into());
    l
}

fn run() -> (Analysis, WalletSnapshot) {
    let (txs, addrs) = history();
    let snap = build(&txs, &addrs);
    let a = analyze(&txs, &addrs, &snap, &labels());
    (a, snap)
}

fn coin<'a>(a: &'a Analysis, id: u8, vout: u32) -> &'a CoinAnalysis {
    a.coin(&OutPoint::new(txid(id), vout)).expect("coin analysed")
}

#[test]
fn every_utxo_is_analysed() {
    let (a, snap) = run();
    assert_eq!(a.coins.len(), snap.utxos.len());
    assert_eq!(snap.utxos.len(), 3); // 0/2 exchange, 0/0 second receive, 1/2 final change
}

#[test]
fn origins_and_certainty() {
    let (a, _) = run();
    let ex = coin(&a, 3, 0);
    assert_eq!(ex.origin.kind, OriginKind::Receive);
    assert_eq!(ex.origin.certainty, Certainty::Known);

    let change = coin(&a, 7, 1);
    assert_eq!(change.origin.kind, OriginKind::Change);
    assert_eq!(change.origin.certainty, Certainty::Known); // internal chain
}

#[test]
fn clusters_follow_common_input_ownership() {
    let (a, _) = run();
    let exchange = coin(&a, 3, 0).cluster_id;
    let reused = coin(&a, 4, 0).cluster_id;
    let change = coin(&a, 7, 1).cluster_id;
    // Exchange coin was never spent with anything: alone.
    assert_ne!(exchange, change);
    // 0/0 was spent in t5, whose change 1/0 was spent with 1/1 in t7 -> same cluster as final change.
    assert_eq!(reused, change);
    let c = &a.clusters[change as usize];
    let mut addrs = c.addresses.clone();
    addrs.sort();
    assert_eq!(addrs, vec!["addr-0-0", "addr-0-1", "addr-1-0", "addr-1-1", "addr-1-2"]);
    assert!(c.linking_txids.contains(&txid(7)));
    assert_eq!(a.clusters.len(), 2);
}

#[test]
fn address_reuse_is_reported_as_known() {
    let (a, _) = run();
    let f = a.findings.iter().find(|f| f.kind == FindingKind::AddressReuse).expect("reuse finding");
    assert_eq!(f.certainty, Certainty::Known);
    assert_eq!(f.severity, Severity::Warning); // one output still unspent
    assert_eq!(f.addresses, vec!["addr-0-0"]);
    assert!(f.title.contains("2 times"));
    assert_eq!(coin(&a, 4, 0).address_use_count, 2);
}

#[test]
fn cluster_merge_attributed_to_the_right_tx() {
    let (a, _) = run();
    let merges: Vec<_> = a.findings.iter().filter(|f| f.kind == FindingKind::ClusterMerge).collect();
    assert_eq!(merges.len(), 1, "{merges:#?}");
    assert_eq!(merges[0].txid, Some(txid(7)));
    assert_eq!(merges[0].certainty, Certainty::Inferred);
}

#[test]
fn round_payment_reveals_change() {
    let (a, _) = run();
    let revealed: Vec<_> = a.findings.iter().filter(|f| f.kind == FindingKind::ChangeRevealed).collect();
    // t7 pays a round 600_000 with change 74_000: revealed. t5/t6 change was spent, so not a UTXO.
    assert_eq!(revealed.len(), 1);
    assert_eq!(revealed[0].txid, Some(txid(7)));
    assert!(revealed[0].explanation.contains("round 0.006 BTC"), "{}", revealed[0].explanation);
}

#[test]
fn user_labels_are_known_and_change_inherits_unambiguous_label() {
    let (txs, addrs) = history();
    // Add a fresh spend of the Exchange coin so its change exists as a UTXO.
    let mut txs = txs;
    txs.push(tx(8, 107, vec![inp(txid(3), 0, out(script(0, 2), 200_000))], vec![out(foreign_script(8), 150_001), out(script(1, 3), 49_000)]));
    let snap = build(&txs, &addrs);
    let a = analyze(&txs, &addrs, &snap, &labels());

    let change = coin(&a, 8, 1);
    assert_eq!(change.labels.len(), 1);
    assert_eq!(change.labels[0].text, "Exchange");
    assert_eq!(change.labels[0].certainty, Certainty::Inferred);

    // t7 spent Salary-change + Donation-change: ambiguous, so no inherited label.
    // (Its inputs are change outputs without direct labels either.)
    assert!(coin(&a, 7, 1).labels.is_empty());
}

#[test]
fn labels_linked_when_labelled_coins_share_cluster() {
    let (txs, addrs) = history();
    let snap = build(&txs, &addrs);
    let mut l = labels();
    // Label the two change coins that were merged in t7 directly.
    l.outputs.insert(format!("{}:1", txid(5)), "Salary".into());
    l.outputs.insert(format!("{}:1", txid(6)), "Donation".into());
    // And the reused-address coin, which shares the cluster.
    l.outputs.insert(format!("{}:0", txid(4)), "Salary".into());
    l.outputs.insert(format!("{}:1", txid(7)), "Donation".into());
    let a = analyze(&txs, &addrs, &snap, &l);
    let f = a.findings.iter().find(|f| f.kind == FindingKind::LabelsLinked).expect("labels linked");
    assert_eq!(f.labels, vec!["Donation", "Salary"]);
}

#[test]
fn snapshot_utxos_match_coin_refs() {
    let (a, snap) = run();
    let ops: HashMap<OutPoint, &Utxo> = snap.utxos.iter().map(|u| (u.outpoint(), u)).collect();
    for c in &a.clusters {
        for r in &c.coins {
            assert!(ops.contains_key(&OutPoint::from(*r)));
        }
        assert_eq!(c.value, c.coins.iter().map(|r| ops[&OutPoint::from(*r)].value).sum::<u64>());
    }
}
