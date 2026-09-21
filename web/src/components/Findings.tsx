import { useState } from "react";
import type { Finding } from "../engine/types";
import { FINDING_ADVICE, FINDING_TITLE_FRIENDLY } from "../lib/copy";
import { shortId } from "../lib/format";
import { CertaintyBadge, SeverityDot } from "./Badges";

export default function Findings({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
        Nothing to worry about so far. Every coin arrived at a fresh address and no past payment has tied
        separate coins together.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {findings.map((f, i) => (
        <FindingRow key={`${f.kind}-${f.txid ?? ""}-${i}`} finding={f} defaultOpen={i === 0} />
      ))}
    </ul>
  );
}

function FindingRow({ finding: f, defaultOpen }: { finding: Finding; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <li className="rounded-lg border border-zinc-800 bg-zinc-900/40">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={open}>
        <SeverityDot severity={f.severity} />
        <span className="grow text-sm text-zinc-100">{FINDING_TITLE_FRIENDLY[f.kind]}</span>
        <CertaintyBadge certainty={f.certainty} />
        <span className="text-zinc-600">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-zinc-800 px-4 py-3 text-sm">
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">What happened</div>
            <p className="text-zinc-300">{f.explanation}</p>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">What you can do</div>
            <p className="text-zinc-300">{FINDING_ADVICE[f.kind]}</p>
          </div>
          {(f.txid || f.addresses.length > 0) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-zinc-600">
              {f.txid && <span title={f.txid}>transaction {shortId(f.txid)}</span>}
              {f.addresses.length > 0 && (
                <span title={f.addresses.join("\n")}>
                  {f.addresses.length} address{f.addresses.length === 1 ? "" : "es"} involved
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
