import { useState } from "react";
import type { Finding } from "../engine/types";
import { shortId } from "../lib/format";
import { CertaintyBadge, SeverityDot } from "./Badges";

export default function Findings({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-400">
        No privacy issues found in this wallet's history. Coins have been received to fresh
        addresses and no spend has linked separate groups of coins.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {findings.map((f, i) => (
        <FindingRow key={`${f.kind}-${f.txid ?? ""}-${i}`} finding={f} />
      ))}
    </ul>
  );
}

function FindingRow({ finding: f }: { finding: Finding }) {
  const [open, setOpen] = useState(f.severity !== "info");
  return (
    <li className="rounded-lg border border-zinc-800 bg-zinc-900/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <SeverityDot severity={f.severity} />
        <span className="grow text-sm text-zinc-100">{f.title}</span>
        <CertaintyBadge certainty={f.certainty} />
        <span className="text-zinc-600">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-zinc-800 px-4 py-3 text-sm text-zinc-300">
          <p>{f.explanation}</p>
          {(f.txid || f.addresses.length > 0 || f.coins.length > 0) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-zinc-500">
              {f.txid && <span title={f.txid}>tx {shortId(f.txid)}</span>}
              {f.addresses.length > 0 && (
                <span title={f.addresses.join("\n")}>
                  {f.addresses.length} address{f.addresses.length === 1 ? "" : "es"}
                </span>
              )}
              {f.coins.length > 0 && (
                <span title={f.coins.map((c) => `${c.txid}:${c.vout}`).join("\n")}>
                  {f.coins.length} coin{f.coins.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
