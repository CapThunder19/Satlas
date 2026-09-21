use satlas_core::chain::EsploraTx;
use satlas_core::descriptor::{DerivedAddress, ScriptType, WalletDescriptor};
use satlas_core::bip329;
use satlas_core::heuristics::{self, Analysis};
use satlas_core::simulate::{self, SpendRequest};
use satlas_core::labels::UserLabels;
use satlas_core::wallet::{self, WalletSnapshot};
use serde::Serialize;
use wasm_bindgen::prelude::*;

/// Called once by the JS side on module load.
#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

/// Sanity check that the Rust → WASM → JS pipeline works.
#[wasm_bindgen]
pub fn version() -> String {
    satlas_core::VERSION.to_string()
}

fn js_err(e: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&e.to_string())
}

fn to_js<T: Serialize>(v: &T) -> Result<JsValue, JsValue> {
    // Plain objects instead of Map, and null instead of undefined for None,
    // so the output matches the hand-written TypeScript types.
    let ser = serde_wasm_bindgen::Serializer::new()
        .serialize_maps_as_objects(true)
        .serialize_missing_as_null(true);
    v.serialize(&ser).map_err(js_err)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WalletInfo {
    network: String,
    external_descriptor: String,
    internal_descriptor: Option<String>,
}

/// A parsed watch-only wallet. Holds no secrets; only derives addresses.
#[wasm_bindgen]
pub struct Wallet {
    inner: WalletDescriptor,
}

#[wasm_bindgen]
impl Wallet {
    /// `script_type` is one of "legacy" | "nested-segwit" | "native-segwit" | "taproot"
    /// and only matters for bare xpub/tpub input.
    #[wasm_bindgen(constructor)]
    pub fn new(input: &str, script_type: &str) -> Result<Wallet, JsValue> {
        let script_type: ScriptType =
            serde_json::from_value(serde_json::Value::String(script_type.to_string()))
                .map_err(|_| js_err(format!("unknown script type {script_type:?}")))?;
        let inner = WalletDescriptor::parse(input, script_type).map_err(js_err)?;
        Ok(Wallet { inner })
    }

    /// `{ network, externalDescriptor, internalDescriptor }`
    pub fn info(&self) -> Result<JsValue, JsValue> {
        let (external_descriptor, internal_descriptor) = self.inner.to_strings();
        to_js(&WalletInfo {
            network: self.inner.network.to_string(),
            external_descriptor,
            internal_descriptor,
        })
    }

    #[wasm_bindgen(getter)]
    pub fn network(&self) -> String {
        self.inner.network.to_string()
    }

    #[wasm_bindgen(getter, js_name = hasInternal)]
    pub fn has_internal(&self) -> bool {
        self.inner.has_internal()
    }

    /// Array of `{ address, scriptPubkey, chain, index }`.
    pub fn addresses(&self, chain: u32, start: u32, count: u32) -> Result<JsValue, JsValue> {
        let addrs = self.inner.addresses(chain, start, count).map_err(js_err)?;
        to_js(&addrs)
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Report {
    snapshot: WalletSnapshot,
    analysis: Analysis,
}

/// Build the coin-level snapshot and run every privacy heuristic.
///
/// `txs`: Esplora transaction objects; `addresses`: the derived addresses they
/// were fetched for; `labels`: `{ outputs: {"txid:vout": label}, addresses: {}, txs: {} }`.
/// Returns `{ snapshot, analysis }`.
#[wasm_bindgen(js_name = analyzeWallet)]
pub fn analyze_wallet(txs: JsValue, addresses: JsValue, labels: JsValue) -> Result<JsValue, JsValue> {
    let txs: Vec<EsploraTx> = serde_wasm_bindgen::from_value(txs)
        .map_err(|e| js_err(format!("invalid transaction data: {e}")))?;
    let addresses: Vec<DerivedAddress> = serde_wasm_bindgen::from_value(addresses)
        .map_err(|e| js_err(format!("invalid address data: {e}")))?;
    let labels: UserLabels = if labels.is_undefined() || labels.is_null() {
        UserLabels::default()
    } else {
        serde_wasm_bindgen::from_value(labels).map_err(|e| js_err(format!("invalid labels: {e}")))?
    };
    let snapshot = wallet::build(&txs, &addresses);
    let analysis = heuristics::analyze(&txs, &addresses, &snapshot, &labels);
    to_js(&Report { snapshot, analysis })
}

/// Simulate one spend. `report` is the object returned by `analyzeWallet`;
/// `request` is `{ amount, feeRate, strategy, manualInputs?, recipientScript? }`.
/// Returns a `Simulation`. Throws a readable message when unfundable.
#[wasm_bindgen(js_name = simulateSpend)]
pub fn simulate_spend(report: JsValue, request: JsValue) -> Result<JsValue, JsValue> {
    let report: ReportIn = serde_wasm_bindgen::from_value(report)
        .map_err(|e| js_err(format!("invalid report: {e}")))?;
    let request: SpendRequest = serde_wasm_bindgen::from_value(request)
        .map_err(|e| js_err(format!("invalid request: {e}")))?;
    let sim = simulate::simulate(&report.snapshot, &report.analysis, &request).map_err(js_err)?;
    to_js(&sim)
}

/// Run every automatic strategy for side-by-side comparison. Returns `Simulation[]`.
#[wasm_bindgen(js_name = simulateAll)]
pub fn simulate_all(report: JsValue, request: JsValue) -> Result<JsValue, JsValue> {
    let report: ReportIn = serde_wasm_bindgen::from_value(report)
        .map_err(|e| js_err(format!("invalid report: {e}")))?;
    let request: SpendRequest = serde_wasm_bindgen::from_value(request)
        .map_err(|e| js_err(format!("invalid request: {e}")))?;
    to_js(&simulate::simulate_all(&report.snapshot, &report.analysis, &request))
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReportIn {
    snapshot: WalletSnapshot,
    analysis: Analysis,
}

/// Serialise labels as BIP-329 JSONL.
#[wasm_bindgen(js_name = exportBip329)]
pub fn export_bip329(labels: JsValue) -> Result<String, JsValue> {
    let labels: UserLabels = serde_wasm_bindgen::from_value(labels)
        .map_err(|e| js_err(format!("invalid labels: {e}")))?;
    Ok(bip329::export(&labels))
}

/// Parse BIP-329 JSONL into a `UserLabels` object.
#[wasm_bindgen(js_name = importBip329)]
pub fn import_bip329(jsonl: &str) -> Result<JsValue, JsValue> {
    let labels = bip329::import(jsonl).map_err(js_err)?;
    to_js(&labels)
}
