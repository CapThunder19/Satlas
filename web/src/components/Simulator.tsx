import { useEffect, useState } from "react";
import type { Report, Simulation, Strategy } from "../engine/types";
import { LINKAGE_ADVICE, STRATEGY, VERDICT } from "../lib/copy";
import { formatBtc, formatSats } from "../lib/format";
import { useSimulator } from "../state/simulator";
import { useWalletStore } from "../state/wallet";
import { CertaintyBadge, SeverityDot } from "./Badges";

const ALL: Strategy[] = ["largest-first", "oldest-first", "smallest-first", "exact-match", "privacy-aware", "manual"];
const RANK: Record<Simulation["verdict"], number> = { clean: 0, caution: 1, linking: 2 };

export default function Simulator({ report }: { report: Report }) {
  const sim = useSimulator();
  const fees = useWalletStore((s) => s.fees);
  const [advanced, setAdvanced] = useState(false);

  // Default to the explorer's current "normal" rate once known, unless the user changed it.
  useEffect(() => {
    if (fees && sim.feeRate === 10) sim.setFeeRate(fees.medium);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fees]);

  useEffect(() => {
    void sim.run(report);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.amountBtc, sim.feeRate, sim.strategy, sim.manual, report]);

  const isDefault = sim.strategy === "largest-first";

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Check a payment before you send it</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Type the amount you are about to send from your normal wallet. Satlas guesses which coins your wallet
          would pick and tells you what that reveals. Nothing is sent from here.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block grow sm:max-w-xs">
          <span className="text-xs text-zinc-400">Amount to send (BTC)</span>
          <input
            inputMode="decimal"
            autoFocus
            value={sim.amountBtc}
            onChange={(e) => sim.setAmount(e.target.value)}
            placeholder="0.23"
            className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2.5 font-mono text-lg text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
          />
        </label>
        <button onClick={() => setAdvanced((a) => !a)} className="pb-2.5 text-xs text-zinc-400 hover:text-zinc-200">
          {advanced ? "Hide options" : "More options"}
        </button>
      </div>

      {(advanced || !isDefault) && (
        <div className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="text-xs text-zinc-400">How should coins be chosen?</span>
            <select
              value={sim.strategy}
              onChange={(e) => sim.setStrategy(e.target.value as Strategy)}
              className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none"
            >
              {ALL.map((s) => (
                <option key={s} value={s}>
                  {STRATEGY[s].label} — {STRATEGY[s].hint}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-zinc-400">Fee (sat/vB)</span>
            <input
              type="number"
              min={1}
              value={sim.feeRate}
              onChange={(e) => sim.setFeeRate(Math.max(1, Number(e.target.value)))}
              className="mt-1 w-28 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-amber-500 focus:outline-none"
            />
            {fees && (
              <div className="mt-1 flex gap-2 text-[11px] text-zinc-500">
                {(
                  [
                    ["fast", fees.fast],
                    ["normal", fees.medium],
                    ["slow", fees.slow],
                  ] as const
                ).map(([name, rate]) => (
                  <button key={name} type="button" onClick={() => sim.setFeeRate(rate)} className="hover:text-zinc-200">
                    {name} {rate}
                  </button>
                ))}
              </div>
            )}
          </label>
          {sim.strategy === "manual" && (
            <p className="text-xs text-zinc-400 sm:col-span-2">
              {sim.manual.size === 0
                ? "Now tick the coins you want to use in the list below."
                : `${sim.manual.size} coin${sim.manual.size === 1 ? "" : "s"} ticked. `}
              {sim.manual.size > 0 && (
                <button onClick={sim.clearManual} className="underline-offset-2 hover:text-zinc-200 hover:underline">
                  untick all
                </button>
              )}
            </p>
          )}
        </div>
      )}

      {sim.error && (
        <p role="alert" className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {friendly(sim.error)}
        </p>
      )}

      {!sim.result && !sim.error && sim.amountBtc === "" && (
        <p className="rounded-lg border border-dashed border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
          Enter an amount to see what your wallet would reveal.
        </p>
      )}

      {sim.result && <Result sim={sim.result} alternatives={sim.comparison} onPick={sim.setStrategy} />}
    </section>
  );
}

function friendly(e: string) {
  const m = /insufficient funds: need (\d+) sat, have (\d+) sat/.exec(e);
  if (m) return `Not enough coins: this needs ${formatBtc(Number(m[1]))} including the fee, but the selected coins hold ${formatBtc(Number(m[2]))}.`;
  return e;
}

function Result({ sim, alternatives, onPick }: { sim: Simulation; alternatives: Simulation[]; onPick: (s: Strategy) => void }) {
  const v = VERDICT[sim.verdict];
  const better = alternatives
    .filter((a) => a.strategy !== sim.strategy && RANK[a.verdict] < RANK[sim.verdict])
    .sort((a, b) => RANK[a.verdict] - RANK[b.verdict] || a.fee - b.fee);
  const [showAll, setShowAll] = useState(false);

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border px-5 py-4 ${v.cls}`}>
        <div className="text-lg font-semibold">{v.title}</div>
        <p className="mt-1 text-sm opacity-90">{sim.summary}</p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs opacity-80">
          <span>
            Uses <strong>{sim.inputs.length}</strong> coin{sim.inputs.length === 1 ? "" : "s"} (highlighted below)
          </span>
          <span>
            Fee <strong>{formatSats(sim.fee)}</strong>
          </span>
          <span>{sim.change == null ? "No change" : <>Change back to you <strong>{formatBtc(sim.change)}</strong></>}</span>
        </div>
      </div>

      {better.length > 0 && (
        <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-4">
          <div className="text-sm font-medium text-emerald-200">A better way to pay the same amount</div>
          <ul className="mt-2 space-y-2">
            {better.slice(0, 2).map((a) => (
              <li key={a.strategy} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-zinc-200">
                  <strong>{STRATEGY[a.strategy].label}</strong>: {VERDICT[a.verdict].title.toLowerCase()} · {a.inputs.length} coin
                  {a.inputs.length === 1 ? "" : "s"} · fee {formatSats(a.fee)}
                </span>
                <button
                  onClick={() => onPick(a.strategy)}
                  className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  Show me
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-zinc-400">
            Then, in your real wallet, use coin control to pick the highlighted coins.
          </p>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium text-zinc-300">Why</h3>
        <ul className="space-y-2">
          {sim.linkages.map((l, i) => (
            <li key={`${l.kind}-${i}`} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
              <div className="flex items-center gap-3">
                <SeverityDot severity={l.severity} />
                <span className="grow text-sm text-zinc-100">{l.title}</span>
                <CertaintyBadge certainty={l.certainty} />
              </div>
              <p className="mt-2 text-sm text-zinc-300">{l.explanation}</p>
              {LINKAGE_ADVICE[l.kind] && (
                <p className="mt-2 text-sm text-zinc-400">
                  <span className="font-medium text-zinc-300">What you can do: </span>
                  {LINKAGE_ADVICE[l.kind]}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>

      {alternatives.length > 1 && (
        <div>
          <button onClick={() => setShowAll((s) => !s)} className="text-xs text-zinc-400 hover:text-zinc-200">
            {showAll ? "Hide" : "Compare"} all ways of choosing coins
          </button>
          {showAll && (
            <table className="mt-2 w-full text-left text-xs">
              <thead className="text-zinc-500">
                <tr>
                  <th className="py-1 pr-3 font-medium">Method</th>
                  <th className="py-1 pr-3 font-medium">Result</th>
                  <th className="py-1 pr-3 font-medium">Coins</th>
                  <th className="py-1 pr-3 font-medium">Fee</th>
                  <th className="py-1 font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                {alternatives.map((s) => (
                  <tr
                    key={s.strategy}
                    onClick={() => onPick(s.strategy)}
                    className={`cursor-pointer border-t border-zinc-800 hover:bg-zinc-900 ${s.strategy === sim.strategy ? "bg-zinc-900/80" : ""}`}
                  >
                    <td className="py-1.5 pr-3 text-zinc-200">{STRATEGY[s.strategy].label}</td>
                    <td className={`py-1.5 pr-3 ${VERDICT[s.verdict].ring}`}>{VERDICT[s.verdict].title}</td>
                    <td className="py-1.5 pr-3 font-mono tabular-nums text-zinc-300">{s.inputs.length}</td>
                    <td className="py-1.5 pr-3 font-mono tabular-nums text-zinc-300">{formatSats(s.fee)}</td>
                    <td className="py-1.5 font-mono tabular-nums text-zinc-300">{s.change == null ? "none" : formatBtc(s.change)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
