// Hand-written types mirroring the serde structs in satlas-core.
// wasm-bindgen returns `any` for serde_wasm_bindgen values, so we narrow here.

export type ScriptType = "legacy" | "nested-segwit" | "native-segwit" | "taproot";

export type Network = "bitcoin" | "testnet" | "signet" | "regtest";

export interface WalletInfo {
  network: Network;
  externalDescriptor: string;
  internalDescriptor: string | null;
}

export interface DerivedAddress {
  address: string;
  /** hex-encoded scriptPubKey */
  scriptPubkey: string;
  /** 0 = receive, 1 = change */
  chain: number;
  index: number;
}

export interface Utxo {
  txid: string;
  vout: number;
  /** satoshis */
  value: number;
  address: string;
  scriptPubkey: string;
  chain: number;
  index: number;
  height: number | null;
  time: number | null;
}

export type TxKind = "receive" | "send" | "self-transfer";

export interface WalletTx {
  txid: string;
  kind: TxKind;
  height: number | null;
  time: number | null;
  fee: number;
  valueIn: number;
  valueOut: number;
  net: number;
  ourInputs: number[];
  ourOutputs: number[];
  numInputs: number;
  numOutputs: number;
}

export interface WalletSnapshot {
  utxos: Utxo[];
  txs: WalletTx[];
  balance: number;
  addressesUsed: number;
}

// ---- heuristics ----

export type Certainty = "known" | "inferred" | "unknown";

export type LabelSource = { kind: "user" } | { kind: "rule"; detail: string };

export interface Label {
  text: string;
  certainty: Certainty;
  source: LabelSource;
}

/** Input to the engine: labels the user assigned, keyed BIP-329 style. */
export interface UserLabels {
  /** "txid:vout" -> label */
  outputs: Record<string, string>;
  addresses: Record<string, string>;
  txs: Record<string, string>;
}

export interface CoinRef {
  txid: string;
  vout: number;
}

export type OriginKind = "change" | "receive" | "self-transfer" | "unknown";

export interface Origin {
  kind: OriginKind;
  certainty: Certainty;
  reason: string;
}

export interface CoinAnalysis {
  txid: string;
  vout: number;
  clusterId: number;
  origin: Origin;
  addressUseCount: number;
  labels: Label[];
}

export interface Cluster {
  id: number;
  addresses: string[];
  coins: CoinRef[];
  value: number;
  linkingTxids: string[];
}

export type Severity = "info" | "warning" | "high";

export type FindingKind = "address-reuse" | "cluster-merge" | "change-revealed" | "labels-linked";

export interface Finding {
  kind: FindingKind;
  severity: Severity;
  certainty: Certainty;
  title: string;
  explanation: string;
  txid: string | null;
  addresses: string[];
  coins: CoinRef[];
  labels: string[];
}

export interface Analysis {
  clusters: Cluster[];
  coins: CoinAnalysis[];
  findings: Finding[];
}

export interface Report {
  snapshot: WalletSnapshot;
  analysis: Analysis;
}

export const coinKey = (c: CoinRef | { txid: string; vout: number }) => `${c.txid}:${c.vout}`;
