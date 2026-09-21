// Opt-in integration test against the public mempool.space API.
// Run with: SATLAS_NETWORK_TESTS=1 pnpm test
import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import init, { Wallet as WasmWallet, analyzeWallet } from "../wasm/pkg/satlas_wasm";
import { EsploraClient } from "./esplora";
import type { DerivedAddress, Report } from "../engine/types";
import type { EsploraTx } from "./esplora";

const enabled = !!process.env.SATLAS_NETWORK_TESTS;

// BIP-84 public test vector wallet; has years of mainnet dust history.
const ZPUB =
  "zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs";

beforeAll(async () => {
  const bytes = await readFile(new URL("../wasm/pkg/satlas_wasm_bg.wasm", import.meta.url));
  await init({ module_or_path: bytes });
});

describe.skipIf(!enabled)("scan against mempool.space", () => {
  it("discovers history for the BIP-84 test wallet", async () => {
    const wasm = new WasmWallet(ZPUB, "native-segwit");
    const client = EsploraClient.forNetwork("bitcoin");

    // Minimal inline scan (avoids importing the facade, which needs the browser loader).
    const addresses = wasm.addresses(0, 0, 3) as DerivedAddress[];
    const txsById = new Map<string, EsploraTx>();
    for (const a of addresses) {
      for (const tx of await client.addressTxs(a.address)) txsById.set(tx.txid, tx);
    }
    const txs = [...txsById.values()];
    expect(txs.length).toBeGreaterThan(0);

    const { snapshot: snap, analysis } = analyzeWallet(txs, addresses, { outputs: {}, addresses: {}, txs: {} }) as Report;
    expect(analysis.coins.length).toBe(snap.utxos.length);
    console.log(
      `addr0 history: ${txs.length} txs, ${snap.utxos.length} utxos, balance ${snap.balance} sat, ` +
        `kinds: ${JSON.stringify(Object.fromEntries(snap.txs.reduce((m, t) => m.set(t.kind, (m.get(t.kind) ?? 0) + 1), new Map<string, number>())))}`,
    );
    expect(snap.txs.length).toBe(txs.length);
    expect(snap.addressesUsed).toBeGreaterThan(0);
    for (const u of snap.utxos) {
      expect(u.address).toMatch(/^bc1q/);
      expect(u.value).toBeGreaterThan(0);
    }
    wasm.free();
  }, 60_000);
});
