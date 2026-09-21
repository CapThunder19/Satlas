import type { EsploraClient, EsploraTx } from "./esplora";
import type { DerivedAddress } from "../engine/types";
import type { Wallet } from "../engine/wallet";

export interface ScanProgress {
  chain: 0 | 1;
  /** Highest index checked so far on this chain. */
  index: number;
  /** Addresses with history found so far, across both chains. */
  used: number;
  txs: number;
}

export interface ScanOptions {
  /** BIP-44 gap limit: stop after this many consecutive unused addresses. */
  gap?: number;
  /** Addresses fetched concurrently. Keep modest for public APIs. */
  batch?: number;
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
 */
export async function scanWallet(
  wallet: Wallet,
  client: EsploraClient,
  { gap = 20, batch = 5, onProgress, signal }: ScanOptions = {},
): Promise<ScanResult> {
  const addresses: DerivedAddress[] = [];
  const txsById = new Map<string, EsploraTx>();
  const lastUsed = { external: -1, internal: -1 };
  let used = 0;

  const chains: (0 | 1)[] = wallet.hasInternal ? [0, 1] : [0];

  for (const chain of chains) {
    let index = 0;
    let unusedRun = 0;

    while (unusedRun < gap) {
      signal?.throwIfAborted();
      const derived = wallet.addresses(chain, index, batch);
      addresses.push(...derived);

      const results = await Promise.all(derived.map((a) => client.addressTxs(a.address)));

      for (let i = 0; i < derived.length; i++) {
        const txs = results[i]!;
        if (txs.length === 0) {
          unusedRun++;
        } else {
          unusedRun = 0;
          used++;
          const key = chain === 0 ? "external" : "internal";
          lastUsed[key] = Math.max(lastUsed[key], derived[i]!.index);
          for (const tx of txs) txsById.set(tx.txid, tx);
        }
        if (unusedRun >= gap) break;
      }

      index += batch;
      onProgress?.({ chain, index: index - 1, used, txs: txsById.size });
    }
  }

  return { addresses, txs: [...txsById.values()], lastUsed };
}
