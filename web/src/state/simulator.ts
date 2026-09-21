import { create } from "zustand";
import { simulateAll, simulateSpend } from "../engine/wallet";
import type { CoinRef, Report, Simulation, Strategy } from "../engine/types";
import { coinKey } from "../engine/types";

interface SimulatorState {
  /** Amount as typed, in BTC. */
  amountBtc: string;
  feeRate: number;
  strategy: Strategy;
  /** Manual selection, by "txid:vout". */
  manual: Set<string>;

  result: Simulation | null;
  comparison: Simulation[];
  error: string | null;
  running: boolean;

  setAmount: (v: string) => void;
  setFeeRate: (v: number) => void;
  setStrategy: (s: Strategy) => void;
  toggleManual: (ref: CoinRef) => void;
  clearManual: () => void;
  run: (report: Report) => Promise<void>;
  reset: () => void;
}

export const parseBtc = (s: string): number | null => {
  const t = s.trim();
  if (!/^\d*\.?\d*$/.test(t) || t === "" || t === ".") return null;
  const [whole = "0", frac = ""] = t.split(".");
  if (frac.length > 8) return null;
  return Number(whole) * 1e8 + Number((frac + "00000000").slice(0, 8));
};

export const useSimulator = create<SimulatorState>((set, get) => ({
  amountBtc: "",
  feeRate: 10,
  strategy: "largest-first",
  manual: new Set(),
  result: null,
  comparison: [],
  error: null,
  running: false,

  setAmount: (amountBtc) => set({ amountBtc }),
  setFeeRate: (feeRate) => set({ feeRate }),
  setStrategy: (strategy) => set({ strategy }),
  toggleManual: (ref) =>
    set((s) => {
      const manual = new Set(s.manual);
      const k = coinKey(ref);
      if (manual.has(k)) manual.delete(k);
      else manual.add(k);
      return { manual, strategy: "manual" };
    }),
  clearManual: () => set({ manual: new Set() }),

  async run(report) {
    const { amountBtc, feeRate, strategy, manual } = get();
    const amount = parseBtc(amountBtc);
    if (amount == null || amount <= 0) {
      set({ result: null, comparison: [], error: amountBtc ? "Enter a valid amount in BTC" : null });
      return;
    }
    set({ running: true, error: null });
    const manualInputs: CoinRef[] = [...manual].map((k) => {
      const [txid, vout] = k.split(":");
      return { txid: txid!, vout: Number(vout) };
    });
    try {
      const request = { amount, feeRate, strategy, manualInputs };
      const [result, comparison] = await Promise.all([
        strategy === "manual" && manualInputs.length === 0
          ? Promise.resolve(null)
          : simulateSpend(report, request).catch((e: Error) => {
              set({ error: e.message });
              return null;
            }),
        simulateAll(report, request),
      ]);
      set({ result, comparison, running: false });
    } catch (e) {
      set({ error: (e as Error).message, result: null, comparison: [], running: false });
    }
  },

  reset: () => set({ amountBtc: "", result: null, comparison: [], error: null, manual: new Set(), strategy: "largest-first" }),
}));
