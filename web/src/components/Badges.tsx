import type { Certainty, Severity } from "../engine/types";
import { CERTAINTY } from "../lib/copy";

const CERTAINTY_STYLE: Record<Certainty, string> = {
  known: "border-emerald-800 bg-emerald-950/60 text-emerald-300",
  inferred: "border-amber-800 bg-amber-950/60 text-amber-300",
  unknown: "border-zinc-700 bg-zinc-900 text-zinc-400",
};

export function CertaintyBadge({ certainty }: { certainty: Certainty }) {
  const c = CERTAINTY[certainty];
  return (
    <span
      title={c.short}
      className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${CERTAINTY_STYLE[certainty]}`}
    >
      {c.label}
    </span>
  );
}

/** One-line legend explaining the three certainty badges. */
export function CertaintyLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
      <span>How sure is Satlas?</span>
      {(["known", "inferred", "unknown"] as Certainty[]).map((c) => (
        <span key={c} className="inline-flex items-center gap-1.5">
          <CertaintyBadge certainty={c} />
          <span>{CERTAINTY[c].short}</span>
        </span>
      ))}
    </div>
  );
}

const SEVERITY_STYLE: Record<Severity, string> = {
  info: "bg-sky-950 text-sky-300",
  warning: "bg-amber-950 text-amber-300",
  high: "bg-red-950 text-red-300",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  info: "Good to know",
  warning: "Heads up",
  high: "Important",
};

export function SeverityDot({ severity }: { severity: Severity }) {
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${SEVERITY_STYLE[severity]}`}>
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

export function ClusterChip({ id, size, color }: { id: number; size: number; color: string }) {
  return (
    <span
      title={
        size > 1
          ? `Group ${id + 1}: ${size} of your addresses that an outsider can already tell belong together`
          : `Group ${id + 1}: this coin is not publicly linked to any of your other coins`
      }
      className="inline-flex items-center gap-1 rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400"
    >
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      group {id + 1}
    </span>
  );
}

export function LabelChip({ text, certainty }: { text: string; certainty: Certainty }) {
  const style =
    certainty === "known"
      ? "border-zinc-600 bg-zinc-800 text-zinc-100"
      : "border-dashed border-zinc-700 bg-zinc-900 text-zinc-400";
  return (
    <span
      title={certainty === "known" ? "Your label" : "Guessed from your other labels (this is change from coins with this label)"}
      className={`rounded-full border px-2 py-0.5 text-xs ${style}`}
    >
      {text}
      {certainty !== "known" && "?"}
    </span>
  );
}
