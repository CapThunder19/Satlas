import { create } from "zustand";
import { persist, type StateStorage, createJSONStorage } from "zustand/middleware";
import { del, get, set } from "idb-keyval";
import type { UserLabels } from "../engine/types";

// Labels are the user's own work product, so they live in IndexedDB rather
// than localStorage: larger quota and no accidental eviction with site data.
const idbStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name)) ?? null,
  setItem: async (name, value) => set(name, value),
  removeItem: async (name) => del(name),
};

const EMPTY: UserLabels = { outputs: {}, addresses: {}, txs: {} };

type LabelKind = keyof UserLabels;

interface LabelsState {
  labels: UserLabels;
  hydrated: boolean;
  setLabel: (kind: LabelKind, ref: string, text: string) => void;
  removeLabel: (kind: LabelKind, ref: string) => void;
  replaceAll: (labels: UserLabels) => void;
  clear: () => void;
}

export const useLabels = create<LabelsState>()(
  persist(
    (set) => ({
      labels: EMPTY,
      hydrated: false,
      setLabel: (kind, ref, text) =>
        set((s) => {
          const next = { ...s.labels, [kind]: { ...s.labels[kind] } };
          if (text.trim() === "") delete next[kind][ref];
          else next[kind][ref] = text.trim();
          return { labels: next };
        }),
      removeLabel: (kind, ref) =>
        set((s) => {
          const next = { ...s.labels, [kind]: { ...s.labels[kind] } };
          delete next[kind][ref];
          return { labels: next };
        }),
      replaceAll: (labels) => set({ labels }),
      clear: () => set({ labels: EMPTY }),
    }),
    {
      name: "satlas.labels",
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ labels: s.labels }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

/** All distinct label texts currently in use, for autocomplete. */
export function allLabelTexts(labels: UserLabels): string[] {
  const s = new Set<string>();
  for (const kind of Object.keys(labels) as LabelKind[]) {
    for (const v of Object.values(labels[kind])) s.add(v);
  }
  return [...s].sort();
}
