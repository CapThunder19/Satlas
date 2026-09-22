// Persistence for real wallets: the last imported key (opt-in) and cached
// scan results keyed by descriptor, so reopening Satlas is instant and a
// "Refresh" only has to catch up.

import { del, get, set } from "idb-keyval";
import type { ScanResult } from "../api/scan";
import type { Network, ScriptType } from "../engine/types";

const REMEMBER_KEY = "satlas.wallet.remembered";
const CACHE_PREFIX = "satlas.scan:";

export interface RememberedWallet {
  input: string;
  scriptType: ScriptType;
  network?: Network;
  savedAt: number;
}

export interface CachedScan {
  scan: ScanResult;
  tipHeight: number | null;
  scannedAt: number;
}

const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await fn();
  } catch {
    return fallback; // private mode, blocked storage, quota: degrade to no cache
  }
};

export const rememberWallet = (w: Omit<RememberedWallet, "savedAt">) =>
  safe(() => set(REMEMBER_KEY, { ...w, savedAt: Date.now() } satisfies RememberedWallet), undefined);

export const forgetWallet = () => safe(() => del(REMEMBER_KEY), undefined);

export const loadRememberedWallet = () => safe(() => get<RememberedWallet>(REMEMBER_KEY), undefined);

/** Cache key: the canonical external descriptor (checksum included) is unique per wallet. */
const cacheKey = (descriptor: string) => CACHE_PREFIX + descriptor;

export const saveScan = (descriptor: string, entry: CachedScan) => safe(() => set(cacheKey(descriptor), entry), undefined);

export const loadScan = (descriptor: string) => safe(() => get<CachedScan>(cacheKey(descriptor)), undefined);

export const dropScan = (descriptor: string) => safe(() => del(cacheKey(descriptor)), undefined);
