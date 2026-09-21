//! On-chain data as returned by Esplora-compatible APIs (`/address/:addr/txs`).
//!
//! These structs deserialize directly from the Esplora JSON. Only the fields
//! Satlas needs are modelled; unknown fields are ignored.

use miniscript::bitcoin::{ScriptBuf, Txid};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EsploraTx {
    pub txid: Txid,
    #[serde(default)]
    pub version: i32,
    #[serde(default)]
    pub locktime: u32,
    pub vin: Vec<EsploraVin>,
    pub vout: Vec<EsploraVout>,
    #[serde(default)]
    pub size: u64,
    #[serde(default)]
    pub weight: u64,
    #[serde(default)]
    pub fee: u64,
    pub status: EsploraStatus,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EsploraVin {
    pub txid: Txid,
    pub vout: u32,
    /// Absent for coinbase inputs.
    #[serde(default)]
    pub prevout: Option<EsploraVout>,
    #[serde(default)]
    pub is_coinbase: bool,
    #[serde(default)]
    pub sequence: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EsploraVout {
    pub scriptpubkey: ScriptBuf,
    #[serde(default)]
    pub scriptpubkey_address: Option<String>,
    #[serde(default)]
    pub scriptpubkey_type: Option<String>,
    /// Satoshis.
    pub value: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct EsploraStatus {
    pub confirmed: bool,
    #[serde(default)]
    pub block_height: Option<u32>,
    #[serde(default)]
    pub block_time: Option<u64>,
}
