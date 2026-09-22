import { describe, expect, it } from "vitest";
import { EsploraClient } from "./esplora";
import { scanWallet } from "./scan";
import { Wallet } from "../engine/wallet";

const ZPUB =
  "zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs";

/** Fake Esplora: `used` maps address -> number of fake txs to return. */
function fakeFetch(used: Map<string, number>, opts: { failFirst?: Set<string>; delayMs?: number } = {}) {
  const seen = new Set<string>();
  const calls: string[] = [];
  const fetchFn: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    const m = /\/address\/([^/]+)(\/txs(?:\/chain\/(\w+))?)?$/.exec(url);
    if (!m) return new Response("0", { status: 200 });
    const addr = m[1]!;
    if (opts.failFirst?.has(addr) && !seen.has(addr)) {
      seen.add(addr);
      return new Response("slow down", { status: 429, headers: { "retry-after": "0" } });
    }
    const n = used.get(addr) ?? 0;
    if (!m[2]) {
      // stats endpoint
      return new Response(JSON.stringify({ chain_stats: { tx_count: n }, mempool_stats: { tx_count: 0 } }), { status: 200 });
    }
    if (m[3]) return new Response("[]", { status: 200 }); // no second page in this fake
    const txs = Array.from({ length: n }, (_, i) => ({
      txid: (Buffer.from(addr).toString("hex") + i.toString(16)).padStart(64, "0").slice(-64),
      vin: [{ txid: "0".repeat(64), vout: 0, prevout: { scriptpubkey: "0014" + "11".repeat(20), value: 10_000 } }],
      vout: [{ scriptpubkey: "0014" + "22".repeat(20), value: 9_000 }],
      status: { confirmed: true, block_height: 100, block_time: 1_700_000_000 },
    }));
    return new Response(JSON.stringify(txs), { status: 200, headers: { "content-type": "application/json" } });
  };
  return { fetchFn, calls };
}

describe("scanWallet", () => {
  it("stops after the gap limit on each chain and finds every used address", async () => {
    const w = await Wallet.parse(ZPUB);
    const ext = w.addresses(0, 0, 60);
    const int = w.addresses(1, 0, 60);
    // Receive: used at 0, 3, 30 (a 26-gap that a gap of 20 must NOT cross). Change: used at 5.
    const used = new Map([
      [ext[0]!.address, 2],
      [ext[3]!.address, 1],
      [ext[30]!.address, 1],
      [int[5]!.address, 1],
    ]);
    const { fetchFn, calls } = fakeFetch(used);
    const client = new EsploraClient("https://fake/api", { fetchFn, concurrency: 8 });

    const res = await scanWallet(w, client, { gap: 20, concurrency: 4 });

    expect(res.lastUsed).toEqual({ external: 3, internal: 5 });
    // Exactly indices 0..23 on receive (3 + 20) and 0..25 on change (5 + 20) were checked.
    const checked = (chain: 0 | 1) =>
      new Set(calls.map((u) => /\/address\/([^/]+)/.exec(u)?.[1]).filter((a) => (chain === 0 ? ext : int).some((x) => x.address === a)));
    expect(checked(0).size).toBe(24);
    expect(checked(1).size).toBe(26);
    expect(res.txs.length).toBe(4); // 2 + 1 + 1, distinct txids
    w.free();
  });

  it("retries a 429 and still completes", async () => {
    const w = await Wallet.parse(ZPUB);
    const ext = w.addresses(0, 0, 5);
    const used = new Map([[ext[1]!.address, 1]]);
    const { fetchFn } = fakeFetch(used, { failFirst: new Set([ext[1]!.address]) });
    const client = new EsploraClient("https://fake/api", { fetchFn, retries: 3 });
    const res = await scanWallet(w, client, { gap: 3, concurrency: 2 });
    expect(res.lastUsed.external).toBe(1);
    expect(res.txs.length).toBe(1);
    w.free();
  });

  it("aborts promptly", async () => {
    const w = await Wallet.parse(ZPUB);
    const { fetchFn } = fakeFetch(new Map(), { delayMs: 50 });
    const ac = new AbortController();
    const client = new EsploraClient("https://fake/api", { fetchFn, signal: ac.signal });
    const p = scanWallet(w, client, { gap: 50, signal: ac.signal });
    setTimeout(() => ac.abort(), 60);
    await expect(p).rejects.toThrow();
    w.free();
  });
});
