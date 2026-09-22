import type { EsploraClient, EsploraTx } from "./esplora";
import type { DerivedAddress } from "../engine/types";
import type { Wallet } from "../engine/wallet";

export interface ScanProgress {
  /** Addresses checked so far, both chains. */
  checked: number;
  /** Addresses with history found so far. */
  used: number;
  txs: number;
}

export interface ScanOptions {
  /** BIP-44 gap limit: stop after this many consecutive unused addresses. */
  gap?: number;
  /** Requests in flight per chain. */
  concurrency?: number;
  onProgress?: (p: ScanProgress) => void;
  signal?: AbortSignal;
}

export interface ScanResult {
  /** Every address derived during the scan (used or not). */
  addresses: DerivedAddress[];
  /** All transactions touching the wallet, deduped by txid. */
  txs: EsploraTx[];
  /** Highest used index per chain, or -1 if none. */
  lastUsed: { external: number; internal: number };
}

/**
 * Discover wallet history with a gap-limit scan over both chains.
 * Derivation happens in wasm; fetching happens here.
 *
 * Each chain runs a small worker pool over a sliding window of indices. A
 * worker stops when every index up to `highestUsed + gap` has been checked.
 */
export async function scanWallet(
  wallet: Wallet,
  client: EsploraClient,
  { gap = 20, concurrency = 4, onProgress, signal }: ScanOptions = {},
): Promise<ScanResult> {
  const addresses: DerivedAddress[] = [];
  const txsById = new Map<string, EsploraTx>();
  const lastUsed = { external: -1, internal: -1 };
  let checked = 0;
  let used = 0;

  const report = () => onProgress?.({ checked, used, txs: txsById.size });

  async function scanChain(chain: 0 | 1) {
    const key = chain === 0 ? "external" : "internal";
    let next = 0; // next index to hand out
    const done = new Set<number>();
    // Derive in chunks so we do not call into wasm once per address.
    const derived: DerivedAddress[] = [];
    const ensureDerived = (i: number) => {
      while (derived.length <= i) {
        const chunk = wallet.addresses(chain, derived.length, 50);
        derived.push(...chunk);
        addresses.push(...chunk);
      }
      return derived[i]!;
    };
    // The window closes once `gap` consecutive indices past the highest used are all done.
    const limit = () => lastUsed[key] + gap; // inclusive highest index we must check
    const finished = () => {
      for (let i = lastUsed[key] + 1; i <= limit(); i++) if (!done.has(i)) return false;
      return true;
    };

    async function worker() {
      while (!finished()) {
        signal?.throwIfAborted();
        if (next > limit()) {
          // Nothing more to hand out until an in-flight request extends the window.
          await new Promise((r) => setTimeout(r, 25));
          continue;
        }
        const i = next++;
        const a = ensureDerived(i);
        const txs = await client.addressTxs(a.address);
        done.add(i);
        checked++;
        if (txs.length > 0) {
          used++;
          lastUsed[key] = Math.max(lastUsed[key], i);
          for (const tx of txs) txsById.set(tx.txid, tx);
        }
        report();
      }
    }

    await Promise.all(Array.from({ length: concurrency }, worker));
  }

  const chains: (0 | 1)[] = wallet.hasInternal ? [0, 1] : [0];
  await Promise.all(chains.map(scanChain));

  // Keep only addresses the caller might see (up to the last one checked per chain).
  return { addresses, txs: [...txsById.values()], lastUsed };
}
