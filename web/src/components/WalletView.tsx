import { useMemo, useState } from "react";
import { useWalletStore } from "../state/wallet";
import { useSettings } from "../state/settings";
import { useSimulator } from "../state/simulator";
import { coinKey, type Report } from "../engine/types";
import { formatBtc } from "../lib/format";
import { CertaintyLegend } from "./Badges";
import CoinCard from "./CoinCard";
import Findings from "./Findings";
import LabelTools from "./LabelTools";
import Simulator from "./Simulator";

type Tab = "coins" | "check";

export default function WalletView() {
  const { info, demo, scanning, progress, snapshot, analysis, tipHeight, error, rescan, reset } = useWalletStore();
  const endpoint = useSettings((s) => (info ? s.endpoints[info.network] : ""));
  const { strategy, manual, toggleManual, result } = useSimulator();
  const [tab, setTab] = useState<Tab>("coins");

  const coinAnalysis = useMemo(() => new Map(analysis?.coins.map((c) => [coinKey(c), c]) ?? []), [analysis]);
  const report: Report | null = useMemo(() => (snapshot && analysis ? { snapshot, analysis } : null), [snapshot, analysis]);
  const spending = useMemo(() => new Set(tab === "check" ? (result?.inputs.map(coinKey) ?? []) : []), [result, tab]);

  if (!info) return null;

  const hasCoins = !!snapshot && snapshot.utxos.length > 0;
  const unlabelled = analysis?.coins.filter((c) => c.labels.length === 0).length ?? 0;
  const groups = analysis?.clusters.length ?? 0;

  return (
    <section className="w-full space-y-6">
      {/* Summary */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-zinc-400">
            {demo ? "Demo wallet" : "Your wallet"}
            {info.network !== "bitcoin" && <span className="ml-2 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-zinc-300">{info.network}</span>}
          </div>
          <div className="text-3xl font-semibold tabular-nums">{snapshot ? formatBtc(snapshot.balance) : scanning ? "Looking…" : "—"}</div>
          {snapshot && (
            <p className="mt-1 text-sm text-zinc-400">
              held as <strong className="text-zinc-200">{snapshot.utxos.length}</strong> separate coin{snapshot.utxos.length === 1 ? "" : "s"}
              {groups > 1 && (
                <>
                  {" "}
                  in <strong className="text-zinc-200">{groups}</strong> groups that outsiders can't yet connect
                </>
              )}
              {groups === 1 && hasCoins && <> that outsiders can already tell belong together</>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          {!demo && (
            <button
              onClick={() => void rescan()}
              disabled={scanning}
              className="rounded-md border border-zinc-800 px-3 py-1.5 text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
            >
              {scanning ? "Refreshing…" : "Refresh"}
            </button>
          )}
          <button onClick={reset} className="text-zinc-400 hover:text-zinc-200">
            Use a different wallet
          </button>
        </div>
      </header>

      {scanning && (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            Looking up your addresses on {hostOf(endpoint)}…
          </div>
          {progress && (
            <div className="mt-1 text-xs text-zinc-500">
              {progress.chain === 0 ? "Receive" : "Change"} addresses checked: {progress.index + 1} · {progress.used} in use ·{" "}
              {progress.txs} transactions found
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {snapshot && !hasCoins && !scanning && (
        <div className="rounded-lg border border-zinc-800 px-4 py-10 text-center text-zinc-400">
          <p className="text-lg text-zinc-200">No coins to show</p>
          <p className="mt-1 text-sm">
            {snapshot.txs.length > 0
              ? "This wallet has a history but every coin has already been spent."
              : "Nothing has been received by this wallet yet, or the key belongs to a different network."}
          </p>
        </div>
      )}

      {hasCoins && (
        <>
          {/* Tabs */}
          <nav className="flex gap-1 border-b border-zinc-800" role="tablist">
            <TabButton active={tab === "coins"} onClick={() => setTab("coins")}>
              Your coins
            </TabButton>
            <TabButton active={tab === "check"} onClick={() => setTab("check")} accent>
              Check a payment
            </TabButton>
          </nav>

          {tab === "coins" && (
            <div className="space-y-8">
              {unlabelled > 0 && (
                <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
                  <strong>Tip:</strong> {unlabelled === 1 ? "One coin has" : `${unlabelled} coins have`} no name yet. Click{" "}
                  <em>“+ name this coin”</em> and write where it came from (Salary, Exchange, a friend…). The better your
                  names, the better Satlas can warn you.
                </div>
              )}

              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">Your coins</h2>
                  <LabelTools />
                </div>
                <CoinGrid />
              </div>

              <div>
                <h2 className="mb-1 text-lg font-semibold">What your history already shows</h2>
                <p className="mb-3 text-sm text-zinc-400">
                  Things an outsider could already work out from past transactions. None of this can be undone, but
                  knowing it helps you avoid making it worse.
                </p>
                <Findings findings={analysis!.findings} />
              </div>

              <CertaintyLegend />
            </div>
          )}

          {tab === "check" && report && (
            <div className="space-y-8">
              <Simulator report={report} />
              <div>
                <h3 className="mb-3 text-sm font-medium text-zinc-300">
                  {strategy === "manual" ? "Tick the coins you want to use" : "Your coins (highlighted = would be spent)"}
                </h3>
                <CoinGrid />
              </div>
              <CertaintyLegend />
            </div>
          )}
        </>
      )}
    </section>
  );

  function CoinGrid() {
    return (
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {snapshot!.utxos.map((u) => {
          const k = coinKey(u);
          const a = coinAnalysis.get(k);
          const manualMode = tab === "check" && strategy === "manual";
          return (
            <CoinCard
              key={k}
              utxo={u}
              analysis={a}
              clusterSize={a ? analysis?.clusters[a.clusterId]?.addresses.length : undefined}
              tipHeight={tipHeight}
              selected={manualMode ? manual.has(k) : undefined}
              onToggle={() => toggleManual(u)}
              highlighted={spending.has(k)}
            />
          );
        })}
      </ul>
    );
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function TabButton({ active, onClick, accent, children }: { active: boolean; onClick: () => void; accent?: boolean; children: React.ReactNode }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-amber-400 text-zinc-100"
          : accent
            ? "border-transparent text-amber-400/80 hover:text-amber-300"
            : "border-transparent text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}
