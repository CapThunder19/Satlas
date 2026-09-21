import type { CoinAnalysis, Utxo } from "../engine/types";
import { confirmations, formatBtc, formatSats, shortId, timeAgo } from "../lib/format";
import { CertaintyBadge, ClusterChip, LabelChip } from "./Badges";

interface Props {
  utxo: Utxo;
  analysis?: CoinAnalysis;
  clusterSize?: number;
  tipHeight: number | null;
}

const ORIGIN_TEXT = {
  change: "Change",
  receive: "Received",
  "self-transfer": "Self-transfer",
  unknown: "Unknown origin",
} as const;

export default function CoinCard({ utxo, analysis, clusterSize = 1, tipHeight }: Props) {
  const confs = confirmations(utxo.height, tipHeight);

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold tabular-nums">{formatBtc(utxo.value)}</div>
          <div className="text-xs text-zinc-500 tabular-nums">{formatSats(utxo.value)}</div>
        </div>
        <div className="text-right text-xs text-zinc-400">
          <div>{timeAgo(utxo.time)}</div>
          <div className="text-zinc-500">
            {confs === 0 ? "in mempool" : confs == null ? "confirmed" : `${confs} conf${confs === 1 ? "" : "s"}`}
          </div>
        </div>
      </div>

      {analysis && (
        <div className="flex flex-wrap items-center gap-1.5">
          {analysis.labels.length > 0 ? (
            analysis.labels.map((l) => <LabelChip key={l.text} text={l.text} certainty={l.certainty} />)
          ) : (
            <span className="text-xs text-zinc-600">unlabelled</span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {analysis && (
          <span className="inline-flex items-center gap-1 text-zinc-300" title={analysis.origin.reason}>
            {ORIGIN_TEXT[analysis.origin.kind]}
            <CertaintyBadge certainty={analysis.origin.certainty} />
          </span>
        )}
        {analysis && <ClusterChip id={analysis.clusterId} size={clusterSize} />}
        {analysis && analysis.addressUseCount > 1 && (
          <span className="rounded bg-amber-950 px-1.5 py-0.5 text-[10px] font-medium text-amber-300" title="This address received more than once">
            reused ×{analysis.addressUseCount}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-zinc-500">
        <span className="text-zinc-600">{utxo.chain}/{utxo.index}</span>
        <span title={utxo.address}>{shortId(utxo.address, 10)}</span>
        <span className="text-zinc-600" title={`${utxo.txid}:${utxo.vout}`}>
          {shortId(utxo.txid, 6)}:{utxo.vout}
        </span>
      </div>
    </li>
  );
}
