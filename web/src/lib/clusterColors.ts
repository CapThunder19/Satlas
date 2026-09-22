// Colour assignment for groups (clusters). Every group is shown at once, so
// this is the all-pairs case: only the first three categorical slots stay
// distinguishable for every kind of colour vision on a dark surface
// (validated with the dataviz palette checker against #18181b). The three
// largest groups by value get those slots; every other group is neutral grey
// and relies on its text label, which every group carries anyway.

import type { Analysis } from "../engine/types";

export const GROUP_SLOTS = ["#3987e5", "#d95926", "#199e70"] as const;
export const GROUP_OTHER = "#71717a"; // zinc-500: 3.2:1 on zinc-900
export const SPEND_HIGHLIGHT = "#f59e0b"; // amber-500, reserved for "would be spent"

export interface GroupColor {
  fill: string;
  /** True when this group has one of the three distinct hues. */
  named: boolean;
}

/** Map cluster id -> colour, stable for a given analysis. */
export function assignGroupColors(analysis: Analysis | null): Map<number, GroupColor> {
  const out = new Map<number, GroupColor>();
  if (!analysis) return out;
  const ranked = [...analysis.clusters].sort((a, b) => b.value - a.value || a.id - b.id);
  ranked.forEach((c, i) => {
    const slot = GROUP_SLOTS[i];
    out.set(c.id, slot ? { fill: slot, named: true } : { fill: GROUP_OTHER, named: false });
  });
  return out;
}

export const groupColor = (colors: Map<number, GroupColor>, id: number): string =>
  colors.get(id)?.fill ?? GROUP_OTHER;
