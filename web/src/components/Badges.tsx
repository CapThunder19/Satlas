import type { Certainty, Severity } from "../engine/types";

const CERTAINTY_STYLE: Record<Certainty, string> = {
  known: "border-emerald-800 bg-emerald-950/60 text-emerald-300",
  inferred: "border-amber-800 bg-amber-950/60 text-amber-300",
  unknown: "border-zinc-700 bg-zinc-900 text-zinc-400",
};

const CERTAINTY_TITLE: Record<Certainty, string> = {
  known: "Known: directly observable on-chain, or stated by you",
  inferred: "Inferred: follows from a heuristic that is usually, but not always, right",
  unknown: "Unknown: not enough information",
};

export function CertaintyBadge({ certainty }: { certainty: Certainty }) {
  return (
    <span
      title={CERTAINTY_TITLE[certainty]}
      className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${CERTAINTY_STYLE[certainty]}`}
    >
      {certainty}
    </span>
  );
}

const SEVERITY_STYLE: Record<Severity, string> = {
  info: "bg-sky-950 text-sky-300",
  warning: "bg-amber-950 text-amber-300",
  high: "bg-red-950 text-red-300",
};

export function SeverityDot({ severity }: { severity: Severity }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${SEVERITY_STYLE[severity]}`}>
      {severity}
    </span>
  );
}

/** Stable, distinguishable colour per cluster id. */
export function clusterColor(id: number): string {
  const palette = [
    "bg-sky-400",
    "bg-rose-400",
    "bg-emerald-400",
    "bg-violet-400",
    "bg-amber-400",
    "bg-teal-400",
    "bg-fuchsia-400",
    "bg-lime-400",
  ];
  return palette[id % palette.length]!;
}

export function ClusterChip({ id, size }: { id: number; size: number }) {
  return (
    <span
      title={`Cluster ${id + 1}: ${size} address${size === 1 ? "" : "es"} an observer can link together`}
      className="inline-flex items-center gap-1 rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400"
    >
      <span className={`inline-block h-2 w-2 rounded-full ${clusterColor(id)}`} />
      cluster {id + 1}
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
      title={certainty === "known" ? "Your label" : "Inferred from your other labels"}
      className={`rounded-full border px-2 py-0.5 text-xs ${style}`}
    >
      {text}
    </span>
  );
}
