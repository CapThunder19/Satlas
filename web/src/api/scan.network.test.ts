// Opt-in integration test against the public mempool.space API.
// Run with: SATLAS_NETWORK_TESTS=1 pnpm test
import { describe, expect, it } from "vitest";
import { EsploraClient } from "./esplora";
import { scanWallet } from "./scan";
import { Wallet, analyzeWallet } from "../engine/wallet";

const enabled = !!process.env.SATLAS_NETWORK_TESTS;

// BIP-84 public test vector wallet; has years of mainnet dust history across
// many addresses, so it exercises the gap-limit walk, pagination and rate limits.
const ZPUB =
  "zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs";

describe.skipIf(!enabled)("live scan against mempool.space", () => {
  it("runs the full import -> scan -> analyse pipeline on a real wallet", async () => {
    const wallet = await Wallet.parse(ZPUB);
    const client = process.env.SATLAS_ESPLORA
      ? new EsploraClient(process.env.SATLAS_ESPLORA)
      : EsploraClient.forNetwork(wallet.network);
    const t0 = Date.now();
    let last = { used: 0, txs: 0 };
    const scan = await scanWallet(wallet, client, {
      gap: 20,
      onProgress: (p) => (last = { used: p.used, txs: p.txs }),
    });
    const ms = Date.now() - t0;

    const { snapshot, analysis } = await analyzeWallet(scan.txs, scan.addresses, { outputs: {}, addresses: {}, txs: {} });
    console.log(
      `scan: ${client.requests} requests in ${ms} ms, ${scan.addresses.length} addresses derived, ` +
        `${last.used} used (last receive #${scan.lastUsed.external}, change #${scan.lastUsed.internal}), ` +
        `${scan.txs.length} txs -> ${snapshot.utxos.length} utxos, balance ${snapshot.balance} sat, ` +
        `${analysis.clusters.length} clusters, ${analysis.findings.length} findings`,
    );

    expect(scan.txs.length).toBeGreaterThan(50);
    expect(scan.lastUsed.external).toBeGreaterThan(0);
    expect(snapshot.txs.length).toBe(scan.txs.length);
    expect(analysis.coins.length).toBe(snapshot.utxos.length);
    // Every UTXO must map to a derived address of the right chain.
    const byAddr = new Map(scan.addresses.map((a) => [a.address, a]));
    for (const u of snapshot.utxos) {
      expect(byAddr.get(u.address)).toMatchObject({ chain: u.chain, index: u.index });
    }
    wallet.free();
  }, 180_000);
});
