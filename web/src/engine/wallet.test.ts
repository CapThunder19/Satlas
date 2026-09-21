import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import init, { Wallet, analyzeWallet, exportBip329, importBip329, simulateAll, simulateSpend, version } from "../wasm/pkg/satlas_wasm";
import type { Report, Simulation } from "./types";

// wasm-pack `--target web` expects to fetch() the .wasm; in Node we hand it the bytes.
beforeAll(async () => {
  const bytes = await readFile(new URL("../wasm/pkg/satlas_wasm_bg.wasm", import.meta.url));
  await init({ module_or_path: bytes });
});

const ZPUB =
  "zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs";

describe("wasm Wallet", () => {
  it("reports a version", () => {
    expect(version()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("derives BIP-84 addresses from a zpub", () => {
    const w = new Wallet(ZPUB, "legacy");
    expect(w.network).toBe("bitcoin");
    expect(w.hasInternal).toBe(true);
    const [a0, a1] = w.addresses(0, 0, 2);
    expect(a0).toMatchObject({ chain: 0, index: 0, address: "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu" });
    expect(a1.address).toBe("bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g");
    expect(a0.scriptPubkey).toMatch(/^0014[0-9a-f]{40}$/);
    const info = w.info();
    expect(info.externalDescriptor).toMatch(/^wpkh\(xpub.*\/0\/\*\)#/);
    expect(info.internalDescriptor).toMatch(/\/1\/\*\)#/);
    w.free();
  });

  it("throws a readable error on bad input", () => {
    expect(() => new Wallet("nonsense", "native-segwit")).toThrow(/not a valid descriptor/);
    expect(() => new Wallet(ZPUB, "bogus")).toThrow(/unknown script type/);
  });
});

describe("wasm analyzeWallet", () => {
  // Minimal synthetic history: one receive to address 0/0, labelled "Salary".
  const addr0 = "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu";
  const spk0 = "0014c0cebcd6c3d3ca8c75dc5ec62ebe55330ef910e2";
  const txid = "aa".repeat(32);
  const txs = [
    {
      txid,
      vin: [{ txid: "bb".repeat(32), vout: 0, prevout: { scriptpubkey: "0014" + "11".repeat(20), value: 150000 }, is_coinbase: false, sequence: 0 }],
      vout: [
        { scriptpubkey: spk0, scriptpubkey_address: addr0, value: 100000 },
        { scriptpubkey: "0014" + "22".repeat(20), value: 49000 },
      ],
      fee: 1000,
      status: { confirmed: true, block_height: 800000, block_time: 1700000000 },
    },
  ];
  const addresses = [{ address: addr0, scriptPubkey: spk0, chain: 0, index: 0 }];

  it("returns snapshot + analysis and applies user labels from a plain object", () => {
    const report = analyzeWallet(txs, addresses, { outputs: { [`${txid}:0`]: "Salary" }, addresses: {}, txs: {} }) as Report;
    expect(report.snapshot.balance).toBe(100000);
    expect(report.snapshot.utxos[0]).toMatchObject({ txid, vout: 0, chain: 0, index: 0, height: 800000 });
    expect(report.analysis.coins).toHaveLength(1);
    const coin = report.analysis.coins[0]!;
    expect(coin.origin).toMatchObject({ kind: "receive", certainty: "known" });
    expect(coin.labels).toEqual([{ text: "Salary", certainty: "known", source: { kind: "user" } }]);
    expect(report.analysis.clusters).toHaveLength(1);
    expect(report.analysis.findings).toEqual([]);
  });

  it("accepts undefined labels", () => {
    const report = analyzeWallet(txs, addresses, undefined) as Report;
    expect(report.analysis.coins[0]!.labels).toEqual([]);
  });

  it("rejects malformed transaction data with a readable error", () => {
    expect(() => analyzeWallet([{ nope: 1 }], addresses, undefined)).toThrow(/invalid transaction data/);
  });
});

describe("wasm simulate + bip329", () => {
  it("simulates a spend on the demo wallet and flags label mixing", async () => {
    const { DEMO_LABELS, DEMO_SCAN } = await import("../demo/wallet");
    const report = analyzeWallet(DEMO_SCAN.txs, DEMO_SCAN.addresses, DEMO_LABELS) as Report;
    // Smallest-first for 0.23 BTC walks 0.01 (reused addr) + 0.05 Donation + 0.20 Salary.
    const sim = simulateSpend(report, { amount: 23_000_000, feeRate: 5, strategy: "smallest-first" }) as Simulation;
    expect(sim.inputs.length).toBe(3);
    expect(sim.verdict).toBe("linking");
    expect(sim.linkages.map((l) => l.kind)).toContain("label-mixing");
    expect(sim.inputTotal).toBe(sim.amount + sim.fee + (sim.change ?? 0));

    const all = simulateAll(report, { amount: 30_000_000, feeRate: 5, strategy: "largest-first" }) as Simulation[];
    expect(all.length).toBe(5);
    expect(new Set(all.map((s) => s.strategy)).size).toBe(5);

    expect(() => simulateSpend(report, { amount: 10 ** 12, feeRate: 5, strategy: "largest-first" })).toThrow(/insufficient funds/);
  });

  it("round-trips labels through BIP-329", () => {
    const labels = { outputs: { [`${"cc".repeat(32)}:0`]: "Salary" }, addresses: { bc1qabc: "Cold" }, txs: {} };
    const jsonl = exportBip329(labels);
    expect(jsonl.trim().split("\n")).toHaveLength(2);
    expect(jsonl).toContain('"type":"output"');
    expect(importBip329(jsonl)).toEqual(labels);
    expect(() => importBip329("garbage")).toThrow(/line 1/);
  });
});
