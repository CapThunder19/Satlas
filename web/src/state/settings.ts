import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_ENDPOINTS } from "../api/esplora";
import type { Network } from "../engine/types";

interface SettingsState {
  /** Esplora base URL per network. Users can point these at a self-hosted instance. */
  endpoints: Record<Network, string>;
  gapLimit: number;
  setEndpoint: (network: Network, url: string) => void;
  resetEndpoint: (network: Network) => void;
  setGapLimit: (gap: number) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      endpoints: { ...DEFAULT_ENDPOINTS },
      gapLimit: 20,
      setEndpoint: (network, url) =>
        set((s) => ({ endpoints: { ...s.endpoints, [network]: url.trim() } })),
      resetEndpoint: (network) =>
        set((s) => ({ endpoints: { ...s.endpoints, [network]: DEFAULT_ENDPOINTS[network] } })),
      setGapLimit: (gapLimit) => set({ gapLimit }),
    }),
    { name: "satlas.settings" },
  ),
);
