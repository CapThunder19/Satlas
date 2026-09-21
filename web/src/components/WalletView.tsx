import { useWalletStore } from "../state/wallet";
import { useSettings } from "../state/settings";
import { formatBtc, shortId } from "../lib/format";
import CoinCard from "./CoinCard";
import Findings from "./Findings";
import { coinKey } from "../engine/types";
import { useMemo } from "react";

export default function WalletView() {
  const { info, demo, scanning, progress, snapshot, analysis, tipHeight, error, rescan, reset } =
    useWalletStore();
  const coinAnalysis = useMemo(
    () => new Map(analysis?.coins.map((c) => [coinKey(c), c]) ?? []),
    [analysis],
  );
  const endpoint = useSettings((s) => (info ? s.endpoints[info.network] : ""));

  if (!info) return null;

  return (
    <section className="w-full space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-zinc-400">
            Balance on <span className="font-mono text-zinc-200">{info.network}</span>
          </div>
          <div className="text-3xl font-semibold tabular-nums">
            {snapshot ? formatBtc(snapshot.balance) : scanning ? "scanning…" : "—"}
          </div>
          {snapshot && (
            <div className="mt-1 text-xs text-zinc-500">
              {snapshot.utxos.length} coin{snapshot.utxos.length === 1 ? "" : "s"} ·{" "}
              {snapshot.txs.length} transaction{snapshot.txs.length === 1 ? "" : "s"} ·{" "}
              {snapshot.addressesUsed} address{snapshot.addressesUsed === 1 ? "" : "es"} used
            </div>
          )}
        </div>
        <div className="flex gap-3 text-sm">
          <button
            onClick={() => void rescan()}
            disabled={scanning || demo}
            className="rounded-md border border-zinc-800 px-3 py-1.5 text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
          >
            {scanning ? "Scanning…" : "Rescan"}
          </button>
          <button onClick={reset} className="text-zinc-400 hover:text-zinc-200">
            Import another
          </button>
        </div>
      </header>

      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 font-mono text-xs text-zinc-500 break-all">
        <div title={info.externalDescriptor}>{shortId(info.externalDescriptor, 40)}</div>
        <div className="mt-1 text-zinc-600">{demo ? "synthetic data, nothing fetched" : `via ${endpoint}`}</div>
      </div>

      {scanning && progress && (
        <p className="text-sm text-zinc-400">
          Scanning {progress.chain === 0 ? "receive" : "change"} addresses up to index {progress.index} ·{" "}
          {progress.used} used · {progress.txs} transactions found
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {snapshot && snapshot.utxos.length === 0 && !scanning && (
        <p className="rounded-md border border-zinc-800 px-4 py-8 text-center text-zinc-400">
          No unspent coins found on {info.network}.
          {snapshot.txs.length > 0 && " This wallet has history but everything has been spent."}
        </p>
      )}

      {analysis && snapshot && snapshot.utxos.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Privacy findings
            {analysis.clusters.length > 1 && (
              <span className="ml-2 normal-case tracking-normal text-zinc-600">
                · coins fall into {analysis.clusters.length} separately-linkable clusters
              </span>
            )}
          </h2>
          <Findings findings={analysis.findings} />
        </div>
      )}

      {snapshot && snapshot.utxos.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">Coins</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {snapshot.utxos.map((u) => (
              <CoinCard
                key={coinKey(u)}
                utxo={u}
                analysis={coinAnalysis.get(coinKey(u))}
                clusterSize={analysis?.clusters[coinAnalysis.get(coinKey(u))?.clusterId ?? 0]?.addresses.length}
                tipHeight={tipHeight}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
