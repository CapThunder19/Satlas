//! BIP-329 wallet label import/export (JSON Lines).
//!
//! Each line is `{"type": "tx"|"addr"|"pubkey"|"input"|"output"|"xpub",
//! "ref": "...", "label": "..."}` plus optional fields we preserve but ignore.

use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};
use crate::labels::UserLabels;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RecordType {
    Tx,
    Addr,
    Pubkey,
    Input,
    Output,
    Xpub,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Record {
    #[serde(rename = "type")]
    pub kind: RecordType,
    #[serde(rename = "ref")]
    pub reference: String,
    #[serde(default)]
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub spendable: Option<bool>,
}

/// Serialise labels as BIP-329 JSONL, one record per line, sorted for stable diffs.
pub fn export(labels: &UserLabels) -> String {
    let mut records: Vec<Record> = Vec::new();
    for (r, l) in &labels.outputs {
        records.push(Record { kind: RecordType::Output, reference: r.clone(), label: l.clone(), origin: None, spendable: None });
    }
    for (r, l) in &labels.addresses {
        records.push(Record { kind: RecordType::Addr, reference: r.clone(), label: l.clone(), origin: None, spendable: None });
    }
    for (r, l) in &labels.txs {
        records.push(Record { kind: RecordType::Tx, reference: r.clone(), label: l.clone(), origin: None, spendable: None });
    }
    records.sort_by(|a, b| (type_order(&a.kind), &a.reference).cmp(&(type_order(&b.kind), &b.reference)));

    let mut out = String::new();
    for r in records {
        // Record only contains strings/bools; serialisation cannot fail.
        out.push_str(&serde_json::to_string(&r).expect("bip329 record serialises"));
        out.push('\n');
    }
    out
}

fn type_order(k: &RecordType) -> u8 {
    match k {
        RecordType::Tx => 0,
        RecordType::Addr => 1,
        RecordType::Output => 2,
        RecordType::Input => 3,
        RecordType::Pubkey => 4,
        RecordType::Xpub => 5,
    }
}

/// Parse BIP-329 JSONL. Blank lines are skipped; a malformed line is an error
/// naming its line number. Record types Satlas does not use (`pubkey`,
/// `input`, `xpub`) are accepted and dropped. Empty labels remove nothing;
/// they are simply skipped.
pub fn import(jsonl: &str) -> Result<UserLabels> {
    let mut labels = UserLabels::default();
    for (n, line) in jsonl.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let rec: Record = serde_json::from_str(line)
            .map_err(|e| Error::Label(format!("line {}: {e}", n + 1)))?;
        if rec.label.is_empty() {
            continue;
        }
        match rec.kind {
            RecordType::Output => {
                validate_outpoint(&rec.reference).map_err(|e| Error::Label(format!("line {}: {e}", n + 1)))?;
                labels.outputs.insert(rec.reference, rec.label);
            }
            RecordType::Addr => {
                labels.addresses.insert(rec.reference, rec.label);
            }
            RecordType::Tx => {
                labels.txs.insert(rec.reference, rec.label);
            }
            RecordType::Input | RecordType::Pubkey | RecordType::Xpub => {}
        }
    }
    Ok(labels)
}

fn validate_outpoint(s: &str) -> std::result::Result<(), String> {
    let (txid, vout) = s.split_once(':').ok_or("output ref must be txid:vout")?;
    if txid.len() != 64 || !txid.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("txid must be 64 hex characters".into());
    }
    vout.parse::<u32>().map_err(|_| "vout must be a number".to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const TXID: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    #[test]
    fn round_trips() {
        let mut l = UserLabels::default();
        l.outputs.insert(format!("{TXID}:1"), "Salary".into());
        l.outputs.insert(format!("{TXID}:0"), "Donation".into());
        l.addresses.insert("bc1qexample".into(), "Cold storage".into());
        l.txs.insert(TXID.into(), "Payroll".into());

        let jsonl = export(&l);
        assert_eq!(jsonl.lines().count(), 4);
        // Sorted: tx, addr, then outputs by ref.
        assert!(jsonl.starts_with(r#"{"type":"tx""#));
        assert!(jsonl.contains(&format!(r#"{{"type":"output","ref":"{TXID}:0","label":"Donation"}}"#)));

        let back = import(&jsonl).unwrap();
        assert_eq!(back, l);
    }

    #[test]
    fn import_tolerates_foreign_records_and_blank_lines() {
        let input = format!(
            "\n{{\"type\":\"xpub\",\"ref\":\"xpub6...\",\"label\":\"My wallet\"}}\n\
             {{\"type\":\"output\",\"ref\":\"{TXID}:3\",\"label\":\"Gift\",\"spendable\":false}}\n\n\
             {{\"type\":\"input\",\"ref\":\"{TXID}:0\",\"label\":\"ignored\"}}\n\
             {{\"type\":\"addr\",\"ref\":\"bc1q...\",\"label\":\"\"}}\n"
        );
        let l = import(&input).unwrap();
        assert_eq!(l.outputs.len(), 1);
        assert_eq!(l.outputs[&format!("{TXID}:3")], "Gift");
        assert!(l.addresses.is_empty());
    }

    #[test]
    fn import_reports_line_numbers() {
        let err = import("{\"type\":\"output\",\"ref\":\"nope\",\"label\":\"x\"}").unwrap_err();
        assert!(err.to_string().contains("line 1"), "{err}");
        let err = import("{\"type\":\"tx\",\"ref\":\"a\",\"label\":\"x\"}\nnot json").unwrap_err();
        assert!(err.to_string().contains("line 2"), "{err}");
    }
}
