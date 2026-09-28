/* tslint:disable */
/* eslint-disable */

/**
 * A parsed watch-only wallet. Holds no secrets; only derives addresses.
 */
export class Wallet {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Array of `{ address, scriptPubkey, chain, index }`.
     */
    addresses(chain: number, start: number, count: number): any;
    /**
     * `{ network, externalDescriptor, internalDescriptor }`
     */
    info(): any;
    /**
     * `script_type` is one of "legacy" | "nested-segwit" | "native-segwit" | "taproot"
     * and only matters for bare xpub/tpub input. `network` optionally forces
     * "bitcoin" | "signet" | "testnet" | "regtest" (test keys default to signet).
     */
    constructor(input: string, script_type: string, network?: string | null);
    readonly hasInternal: boolean;
    readonly network: string;
}

/**
 * Build the coin-level snapshot and run every privacy heuristic.
 *
 * `txs`: Esplora transaction objects; `addresses`: the derived addresses they
 * were fetched for; `labels`: `{ outputs: {"txid:vout": label}, addresses: {}, txs: {} }`.
 * Returns `{ snapshot, analysis }`.
 */
export function analyzeWallet(txs: any, addresses: any, labels: any): any;

/**
 * Serialise labels as BIP-329 JSONL.
 */
export function exportBip329(labels: any): string;

/**
 * Parse BIP-329 JSONL into a `UserLabels` object.
 */
export function importBip329(jsonl: string): any;

/**
 * Run every automatic strategy for side-by-side comparison. Returns `Simulation[]`.
 */
export function simulateAll(report: any, request: any): any;

/**
 * Simulate one spend. `report` is the object returned by `analyzeWallet`;
 * `request` is `{ amount, feeRate, strategy, manualInputs?, recipientScript? }`.
 * Returns a `Simulation`. Throws a readable message when unfundable.
 */
export function simulateSpend(report: any, request: any): any;

/**
 * Called once by the JS side on module load.
 */
export function start(): void;

/**
 * Sanity check that the Rust → WASM → JS pipeline works.
 */
export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wallet_free: (a: number, b: number) => void;
    readonly analyzeWallet: (a: number, b: number, c: number, d: number) => void;
    readonly exportBip329: (a: number, b: number) => void;
    readonly importBip329: (a: number, b: number, c: number) => void;
    readonly simulateAll: (a: number, b: number, c: number) => void;
    readonly simulateSpend: (a: number, b: number, c: number) => void;
    readonly start: () => void;
    readonly version: (a: number) => void;
    readonly wallet_addresses: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly wallet_hasInternal: (a: number) => number;
    readonly wallet_info: (a: number, b: number) => void;
    readonly wallet_network: (a: number, b: number) => void;
    readonly wallet_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly rustsecp256k1_v0_10_0_context_create: (a: number) => number;
    readonly rustsecp256k1_v0_10_0_context_destroy: (a: number) => void;
    readonly rustsecp256k1_v0_10_0_default_error_callback_fn: (a: number, b: number) => void;
    readonly rustsecp256k1_v0_10_0_default_illegal_callback_fn: (a: number, b: number) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number) => void;
    readonly __wbindgen_export4: (a: number, b: number, c: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
