import { useEffect, useRef, useState } from "react";
import { allLabelTexts, useLabels } from "../state/labels";
import { useWalletStore } from "../state/wallet";

interface Props {
  /** "txid:vout" */
  outpoint: string;
  current: string | undefined;
  onDone: () => void;
}

/** Inline input for labelling one coin. Saves on Enter/blur, re-analyses immediately. */
export default function LabelEditor({ outpoint, current, onDone }: Props) {
  const [text, setText] = useState(current ?? "");
  const ref = useRef<HTMLInputElement>(null);
  const { labels, setLabel } = useLabels();
  const reanalyze = useWalletStore((s) => s.reanalyze);
  const suggestions = allLabelTexts(labels);

  useEffect(() => ref.current?.focus(), []);

  const commit = () => {
    if (text.trim() !== (current ?? "")) {
      setLabel("outputs", outpoint, text);
      void reanalyze();
    }
    onDone();
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        ref={ref}
        list="satlas-label-suggestions"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") onDone();
        }}
        placeholder="e.g. Salary, Exchange, Donation"
        className="w-full rounded border border-amber-600 bg-zinc-950 px-2 py-0.5 text-xs text-zinc-100 focus:outline-none"
      />
      <datalist id="satlas-label-suggestions">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}
