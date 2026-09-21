import { useState } from "react";
import type { CoinAnalysis, Utxo } from "../engine/types";
import { coinKey } from "../engine/types";
import { confirmations, formatBtc, formatSats, shortId, timeAgo } from "../lib/format";
import { ORIGIN } from "../lib/copy";
import { useLabels } from "../state/labels";
import { CertaintyBadge, ClusterChip, LabelChip } from "./Badges";
import LabelEditor from "./LabelEditor";

interface Props {
  utxo: Utxo;
  analysis?: CoinAnalysis;
  clusterSize?: number;
  tipHeight: number | null;
  /** Manual-selection checkbox state; undefined hides the checkbox. */
  selected?: boolean;
  onToggle?: () => void;
  /** The current simulation would spend this coin. */
  highlighted?: boolean;
}

export default function CoinCard({
  utxo,
  analysis,
  clusterSize = 1,
  tipHeight,
  selected,
  onToggle,
  highlighted,
}: Props) {
  const confs = confirmations(utxo.height, tipHeight);
  const key = coinKey(utxo);
  const userLabel = useLabels((s) => s.labels.outputs[key]);
  const [editing, setEditing] = useState(false);
  const [details, setDetails] = useState(false);

  const border = highlighted
    ? "border-amber-500/70 ring-1 ring-amber-500/40"
    : selected
      ? "border-sky-500/70 ring-1 ring-sky-500/40"
      : "border-zinc-800";

  const status = confs === 0 ? "not confirmed yet" : `received ${timeAgo(utxo.time)}`;

  return (
    <li className={`flex flex-col gap-3 rounded-lg border bg-zinc-900/60 p-4 ${border}`}>
      <div className="flex items-start gap-3">
        {selected !== undefined && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label="Use this coin in the payment"
            className="mt-1.5 h-4 w-4 shrink-0 accent-sky-500"
          />
        )}
        <div className="min-w-0 grow">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-lg font-semibold tabular-nums">{formatBtc(utxo.value)}</span>
            {highlighted && <span className="text-[10px] font-medium uppercase tracking-wide text-amber-400">would be spent</span>}
          </div>
          <div className="text-xs text-zinc-500">{status}</div>
        </div>
      </div>

      {editing ? (
        <LabelEditor outpoint={key} current={userLabel} onDone={() => setEditing(false)} />
      ) : (
        <button onClick={() => setEditing(true)} className="flex flex-wrap items-center gap-1.5 text-left" title="Click to name this coin">
          {analysis && analysis.labels.length > 0 ? (
            <>
              {analysis.labels.map((l) => (
                <LabelChip key={l.text} text={l.text} certainty={l.certainty} />
              ))}
              <span className="text-[11px] text-zinc-600">edit</span>
            </>
          ) : (
            <span className="rounded-full border border-dashed border-zinc-700 px-2 py-0.5 text-xs text-zinc-500 hover:border-zinc-500 hover:text-zinc-300">
              + name this coin
            </span>
          )}
        </button>
      )}

      {analysis && (
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5 text-zinc-300" title={analysis.origin.reason}>
            <span>{ORIGIN[analysis.origin.kind]}</span>
            <CertaintyBadge certainty={analysis.origin.certainty} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ClusterChip id={analysis.clusterId} size={clusterSize} />
            {analysis.addressUseCount > 1 && (
              <span
                className="rounded bg-amber-950 px-1.5 py-0.5 text-[10px] font-medium text-amber-300"
                title="This address received money more than once, so everyone who paid it can see the others"
              >
                shared address ×{analysis.addressUseCount}
              </span>
            )}
          </div>
        </div>
      )}

      <button onClick={() => setDetails((d) => !d)} className="self-start text-[11px] text-zinc-600 hover:text-zinc-400">
        {details ? "hide details" : "details"}
      </button>
      {details && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px] text-zinc-500">
          <dt>sats</dt>
          <dd>{formatSats(utxo.value)}</dd>
          <dt>address</dt>
          <dd className="break-all text-zinc-400" title={utxo.address}>
            {utxo.address}
          </dd>
          <dt>path</dt>
          <dd>
            {utxo.chain === 1 ? "change" : "receive"} #{utxo.index}
          </dd>
          <dt>outpoint</dt>
          <dd className="break-all" title={key}>
            {shortId(utxo.txid, 8)}:{utxo.vout}
          </dd>
          <dt>confirmations</dt>
          <dd>{confs ?? "—"}</dd>
        </dl>
      )}
    </li>
  );
}
