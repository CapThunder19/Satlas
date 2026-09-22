import { create } from "zustand";
import { Wallet, analyzeWallet } from "../engine/wallet";
import type { Analysis, Network, ScriptType, WalletInfo, WalletSnapshot } from "../engine/types";
import { EsploraClient, EsploraError, KNOWN_ENDPOINTS } from "../api/esplora";
import { scanWallet, type ScanProgress, type ScanResult } from "../api/scan";
import { useSettings } from "./settings";
import { useLabels } from "./labels";
import { useSimulator } from "./simulator";
import { DEMO_LABELS, DEMO_SCAN, DEMO_TIP_HEIGHT } from "../demo/wallet";
import {
  dropScan,
  forgetWallet,
  loadRememberedWallet,
  loadScan,
  rememberWallet,
  saveScan,
} from "./cache";

export interface ImportOptions {
  scriptType?: ScriptType;
  /** Force a network for test keys (tpub can be signet or testnet4). */
  network?: Network;
  /** Keep the key on this device and reopen it automatically. */
  remember?: boolean;
}

interface WalletState {
  wallet: Wallet | null;
  info: WalletInfo | null;
  /** True when showing the built-in synthetic wallet (no network, no rescan). */
  demo: boolean;
  remembered: boolean;
  importing: boolean;
  /** True while trying to reopen a remembered wallet on startup. */
  restoring: boolean;
  error: string | null;

  scanning: boolean;
  progress: ScanProgress | null;
  scan: ScanResult | null;
  /** When the data on screen was fetched; null for demo. */
  scannedAt: number | null;
  /** True when showing cached data while a refresh runs. */
  stale: boolean;
  snapshot: WalletSnapshot | null;
  analysis: Analysis | null;
  tipHeight: number | null;
  fees: { fast: number; medium: number; slow: number } | null;
  /** Set when the configured server failed and a fallback provider was used instead. */
  fallbackNotice: string | null;

  importWallet: (input: string, opts?: ImportOptions) => Promise<void>;
  restore: () => Promise<void>;
  loadDemo: () => Promise<void>;
  rescan: () => Promise<void>;
  /** Re-run heuristics on the cached scan (e.g. after labels change) without refetching. */
  reanalyze: () => Promise<void>;
  forget: () => Promise<void>;
  reset: () => void;
}

let abort: AbortController | null = null;

export const useWalletStore = create<WalletState>((set, get) => ({
  wallet: null,
  info: null,
  demo: false,
  remembered: false,
  importing: false,
  restoring: false,
  error: null,
  scanning: false,
  progress: null,
  scan: null,
  scannedAt: null,
  stale: false,
  snapshot: null,
  analysis: null,
  tipHeight: null,
  fees: null,
  fallbackNotice: null,

  async importWallet(input, { scriptType = "native-segwit", network, remember = false } = {}) {
    set({ importing: true, error: null });
    let wallet: Wallet;
    try {
      wallet = await Wallet.parse(input, scriptType, network);
    } catch (e) {
      set({ error: (e as Error).message, importing: false });
      return;
    }
    get().reset();
    const info = wallet.info();
    set({ wallet, info, importing: false, remembered: remember });

    if (remember) await rememberWallet({ input, scriptType, network });
    else await forgetWallet();

    // Show what we already know, then catch up in the background.
    const cached = await loadScan(info.externalDescriptor);
    if (cached) {
      await applyScan(cached.scan, cached.tipHeight, cached.scannedAt, true);
    }
    await get().rescan();
  },

  async restore() {
    const saved = await loadRememberedWallet();
    if (!saved) return;
    set({ restoring: true });
    try {
      await get().importWallet(saved.input, { scriptType: saved.scriptType, network: saved.network, remember: true });
    } finally {
      set({ restoring: false });
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
      info: {
        network: "signet",
        externalDescriptor: "demo wallet (synthetic history, not on-chain)",
        internalDescriptor: "demo",
      },
      scan: DEMO_SCAN,
      tipHeight: DEMO_TIP_HEIGHT,
    });
    await get().reanalyze();
  },

  async rescan() {
    const { wallet, info } = get();
    if (!wallet || !info) return;
    abort?.abort();
    abort = new AbortController();
    const { signal } = abort;

    const { endpoints, gapLimit } = useSettings.getState();
    const configured = endpoints[wallet.network];
    // Configured server first, then other public providers if it is unreachable.
    const candidates = [configured, ...KNOWN_ENDPOINTS[wallet.network].map((e) => e.url).filter((u) => u !== configured)];

    set({ scanning: true, error: null, progress: null, stale: get().scan !== null, fallbackNotice: null });
    let lastError: Error | null = null;
    for (const [i, baseUrl] of candidates.entries()) {
      // Two chains x 4 workers each; the client caps total sockets at 8.
      const client = new EsploraClient(baseUrl, { concurrency: 8, signal });
      try {
        const [scan, tipHeight, fees] = await Promise.all([
          scanWallet(wallet, client, { gap: gapLimit, signal, onProgress: (progress) => set({ progress }) }),
          client.tipHeight().catch(() => null),
          client.recommendedFees(),
        ]);
        if (signal.aborted) return;
        const scannedAt = Date.now();
        await applyScan(scan, tipHeight, scannedAt, false);
        set({
          fees,
          scanning: false,
          fallbackNotice: i === 0 ? null : `${hostOf(configured)} was unreachable, so this data came from ${hostOf(baseUrl)} instead.`,
        });
        await saveScan(info.externalDescriptor, { scan, tipHeight, scannedAt });
        return;
      } catch (e) {
        if (signal.aborted) return;
        lastError = e as Error;
        // Only fail over on connectivity / server trouble, not on bad input.
        const status = e instanceof EsploraError ? e.status : undefined;
        const transient = /could not reach|rate limited/i.test(lastError.message) || (status !== undefined && status >= 500);
        if (!transient) break;
        set({ progress: null });
      }
    }
    set({ error: friendlyScanError(lastError?.message ?? "scan failed"), scanning: false, stale: false });
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

  async forget() {
    const desc = get().info?.externalDescriptor;
    await forgetWallet();
    if (desc) await dropScan(desc);
    get().reset();
  },

  reset() {
    abort?.abort();
    get().wallet?.free();
    useSimulator.getState().reset();
    set({
      wallet: null,
      info: null,
      demo: false,
      remembered: false,
      error: null,
      scanning: false,
      progress: null,
      scan: null,
      scannedAt: null,
      stale: false,
      snapshot: null,
      analysis: null,
      tipHeight: null,
      fees: null,
      fallbackNotice: null,
    });
  },
}));

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

async function applyScan(scan: ScanResult, tipHeight: number | null, scannedAt: number, stale: boolean) {
  const { snapshot, analysis } = await analyzeWallet(scan.txs, scan.addresses, useLabels.getState().labels);
  useWalletStore.setState({ scan, snapshot, analysis, tipHeight, scannedAt, stale });
}

function friendlyScanError(msg: string): string {
  if (/rate limited/i.test(msg))
    return "The block explorer is rate-limiting requests. Wait a minute and press Refresh, or set your own server in Settings.";
  if (/could not reach/i.test(msg))
    return "Could not reach the block explorer. Check your connection, or set a different server in Settings.";
  return msg;
}
