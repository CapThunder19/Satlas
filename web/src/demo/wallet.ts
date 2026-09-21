// Synthetic wallet history for demos and screenshots. No network involved.
// Mirrors the "Alice" story from the README: Salary, Donation and Exchange
// coins, one reused address, one revealing spend, one cluster-merging spend.

import type { EsploraTx } from "../api/esplora";
import type { DerivedAddress, UserLabels } from "../engine/types";
import type { ScanResult } from "../api/scan";

const hex = (seed: number, bytes: number) => {
  // Deterministic pseudo-random hex so txids/scripts look real but are stable.
  let x = seed * 2654435761 + 12345;
  let out = "";
  for (let i = 0; i < bytes; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    out += ((x >> 16) & 0xff).toString(16).padStart(2, "0");
  }
  return out;
};

const txid = (n: number) => hex(1000 + n, 32);
const p2wpkh = (n: number) => "0014" + hex(2000 + n, 20);
const p2tr = (n: number) => "5120" + hex(3000 + n, 32);

// Fake but plausible-looking signet addresses; only shown, never derived from.
const addr = (chain: number, index: number) => ({
  address: `tb1q${hex(4000 + chain * 100 + index, 19)}`.slice(0, 42),
  scriptPubkey: p2wpkh(chain * 100 + index),
  chain,
  index,
});

export const DEMO_ADDRESSES: DerivedAddress[] = [
  addr(0, 0),
  addr(0, 1),
  addr(0, 2),
  addr(0, 3),
  addr(0, 4),
  addr(1, 0),
  addr(1, 1),
  addr(1, 2),
  addr(1, 3),
];

const A = (chain: number, index: number) => DEMO_ADDRESSES.find((a) => a.chain === chain && a.index === index)!;

const BTC = 100_000_000;
const NOW = Math.floor(Date.now() / 1000);
const TIP = 210_000;

function tx(
  n: number,
  daysAgo: number,
  vin: { txid: string; vout: number; spk: string; value: number }[],
  vout: { spk: string; value: number; address?: string }[],
): EsploraTx {
  const inSum = vin.reduce((s, i) => s + i.value, 0);
  const outSum = vout.reduce((s, o) => s + o.value, 0);
  return {
    txid: txid(n),
    version: 2,
    locktime: 0,
    vin: vin.map((i) => ({
      txid: i.txid,
      vout: i.vout,
      prevout: { scriptpubkey: i.spk, value: i.value },
      is_coinbase: false,
      sequence: 0xfffffffd,
    })),
    vout: vout.map((o) => ({ scriptpubkey: o.spk, scriptpubkey_address: o.address, value: o.value })),
    size: 200,
    weight: 800,
    fee: inSum - outSum,
    status: { confirmed: true, block_height: TIP - daysAgo * 144, block_time: NOW - daysAgo * 86400 },
  };
}

const foreign = (n: number) => p2wpkh(9000 + n);

// t1  Salary       0.20 -> 0/0                                   (40 days ago)
// t2  Donation     0.05 -> 0/1                                   (30 days ago)
// t3  Exchange     0.80 -> 0/2                                   (25 days ago)
// t4  Freelance    0.02 -> 0/3                                   (20 days ago)
// t5  spend 0/2: pay 0.30 (round, taproot) + change 0.4999 -> 1/0 (15 days ago)  [change revealed]
// t6  spend 0/3: pay 0.0123 + change 0.0076 -> 1/1              (12 days ago)
// t7  spend 1/0 + 1/1: pay 0.25 (round) + change 0.257412 -> 1/2          (8 days ago)   [merges Exchange & Freelance groups]
// t8  reuse: 0.01 -> 0/0 again                                   (3 days ago)   [address reuse]
export const DEMO_TXS: EsploraTx[] = [
  tx(1, 40, [{ txid: txid(91), vout: 0, spk: foreign(1), value: 0.25 * BTC }], [
    { spk: A(0, 0).scriptPubkey, value: 0.2 * BTC, address: A(0, 0).address },
    { spk: foreign(11), value: 0.04998 * BTC },
  ]),
  tx(2, 30, [{ txid: txid(92), vout: 1, spk: foreign(2), value: 0.06 * BTC }], [
    { spk: A(0, 1).scriptPubkey, value: 0.05 * BTC, address: A(0, 1).address },
    { spk: foreign(12), value: 0.00998 * BTC },
  ]),
  tx(3, 25, [{ txid: txid(93), vout: 0, spk: foreign(3), value: 1.0 * BTC }], [
    { spk: A(0, 2).scriptPubkey, value: 0.8 * BTC, address: A(0, 2).address },
    { spk: foreign(13), value: 0.19998 * BTC },
  ]),
  tx(4, 20, [{ txid: txid(94), vout: 0, spk: foreign(4), value: 0.03 * BTC }], [
    { spk: A(0, 3).scriptPubkey, value: 0.02 * BTC, address: A(0, 3).address },
    { spk: foreign(14), value: 0.00998 * BTC },
  ]),
  tx(5, 15, [{ txid: txid(3), vout: 0, spk: A(0, 2).scriptPubkey, value: 0.8 * BTC }], [
    { spk: p2tr(1), value: 0.3 * BTC },
    { spk: A(1, 0).scriptPubkey, value: 0.4999 * BTC, address: A(1, 0).address },
  ]),
  tx(6, 12, [{ txid: txid(4), vout: 0, spk: A(0, 3).scriptPubkey, value: 0.02 * BTC }], [
    { spk: foreign(16), value: 0.0123 * BTC },
    { spk: A(1, 1).scriptPubkey, value: 0.0076 * BTC, address: A(1, 1).address },
  ]),
  tx(
    7,
    8,
    [
      { txid: txid(5), vout: 1, spk: A(1, 0).scriptPubkey, value: 0.4999 * BTC },
      { txid: txid(6), vout: 1, spk: A(1, 1).scriptPubkey, value: 0.0076 * BTC },
    ],
    [
      { spk: foreign(17), value: 0.25 * BTC },
      { spk: A(1, 2).scriptPubkey, value: 0.257412 * BTC, address: A(1, 2).address },
    ],
  ),
  tx(8, 3, [{ txid: txid(98), vout: 0, spk: foreign(8), value: 0.012 * BTC }], [
    { spk: A(0, 0).scriptPubkey, value: 0.01 * BTC, address: A(0, 0).address },
    { spk: foreign(18), value: 0.00198 * BTC },
  ]),
].map((t) => ({ ...t, vout: t.vout.map((o) => ({ ...o, value: Math.round(o.value) })), vin: t.vin.map((i) => ({ ...i, prevout: i.prevout && { ...i.prevout, value: Math.round(i.prevout.value) } })) }));

export const DEMO_SCAN: ScanResult = {
  addresses: DEMO_ADDRESSES,
  txs: DEMO_TXS,
  lastUsed: { external: 3, internal: 2 },
};

export const DEMO_TIP_HEIGHT = TIP;

export const DEMO_LABELS: UserLabels = {
  outputs: {
    [`${txid(1)}:0`]: "Salary",
    [`${txid(2)}:0`]: "Donation",
    [`${txid(3)}:0`]: "Exchange",
    [`${txid(4)}:0`]: "Freelance",
  },
  addresses: {},
  txs: {},
};
