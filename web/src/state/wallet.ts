import { create } from "zustand";
import { Wallet, analyzeWallet } from "../engine/wallet";
import type { Analysis, ScriptType, WalletInfo, WalletSnapshot } from "../engine/types";
import { EsploraClient } from "../api/esplora";
import { scanWallet, type ScanProgress, type ScanResult } from "../api/scan";
import { useSettings } from "./settings";
import { useLabels } from "./labels";
import { DEMO_LABELS, DEMO_SCAN, DEMO_TIP_HEIGHT } from "../demo/wallet";
import { useSimulator } from "./simulator";

interface WalletState {
  wallet: Wallet | null;
  info: WalletInfo | null;
  /** True when showing the built-in synthetic wallet (no network, no rescan). */
  demo: boolean;
  importing: boolean;
  error: string | null;

  scanning: boolean;
  progress: ScanProgress | null;
  scan: ScanResult | null;
  snapshot: WalletSnapshot | null;
  analysis: Analysis | null;
  tipHeight: number | null;

  importWallet: (input: string, scriptType: ScriptType) => Promise<void>;
  loadDemo: () => Promise<void>;
  rescan: () => Promise<void>;
  /** Re-run heuristics on the cached scan (e.g. after labels change) without refetching. */
  reanalyze: () => Promise<void>;
  reset: () => void;
}

let abort: AbortController | null = null;

export const useWalletStore = create<WalletState>((set, get) => ({
  wallet: null,
  info: null,
  demo: false,
  importing: false,
  error: null,
  scanning: false,
  progress: null,
  scan: null,
  snapshot: null,
  analysis: null,
  tipHeight: null,

  async importWallet(input, scriptType) {
    set({ importing: true, error: null });
    try {
      const wallet = await Wallet.parse(input, scriptType);
      get().reset();
      set({ wallet, info: wallet.info(), importing: false });
      await get().rescan();
    } catch (e) {
      set({ error: (e as Error).message, importing: false });
    }
  },

  async loadDemo() {
    get().reset();
    // Seed demo labels without clobbering anything the user already labelled.
    const labels = useLabels.getState();
    for (const [ref, text] of Object.entries(DEMO_LABELS.outputs)) {
      if (!labels.labels.outputs[ref]) labels.setLabel("outputs", ref, text);
    }
    set({
      demo: true,
      info: { network: "signet", externalDescriptor: "demo wallet (synthetic history, not on-chain)", internalDescriptor: "demo" },
      scan: DEMO_SCAN,
      tipHeight: DEMO_TIP_HEIGHT,
    });
    await get().reanalyze();
  },

  async rescan() {
    const { wallet } = get();
    if (!wallet) return;
    abort?.abort();
    abort = new AbortController();
    const { signal } = abort;

    const { endpoints, gapLimit } = useSettings.getState();
    const client = new EsploraClient(endpoints[wallet.network]);

    set({ scanning: true, error: null, progress: null });
    try {
      const [scan, tipHeight] = await Promise.all([
        scanWallet(wallet, client, {
          gap: gapLimit,
          signal,
          onProgress: (progress) => set({ progress }),
        }),
        client.tipHeight().catch(() => null),
      ]);
      const { snapshot, analysis } = await analyzeWallet(scan.txs, scan.addresses, useLabels.getState().labels);
      if (signal.aborted) return;
      set({ scan, snapshot, analysis, tipHeight, scanning: false });
    } catch (e) {
      if (signal.aborted) return;
      set({ error: (e as Error).message, scanning: false });
    }
  },

  async reanalyze() {
    const { scan } = get();
    if (!scan) return;
    try {
      const { snapshot, analysis } = await analyzeWallet(scan.txs, scan.addresses, useLabels.getState().labels);
      set({ snapshot, analysis });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  reset() {
    abort?.abort();
    get().wallet?.free();
    useSimulator.getState().reset();
    set({
      wallet: null,
      info: null,
      demo: false,
      error: null,
      scanning: false,
      progress: null,
      scan: null,
      snapshot: null,
      analysis: null,
      tipHeight: null,
    });
  },
}));
