import { useRef, useState } from "react";
import { exportBip329, importBip329 } from "../engine/wallet";
import { useLabels } from "../state/labels";
import { useWalletStore } from "../state/wallet";

/** BIP-329 export / import buttons. */
export default function LabelTools() {
  const { labels, replaceAll } = useLabels();
  const reanalyze = useWalletStore((s) => s.reanalyze);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const count =
    Object.keys(labels.outputs).length + Object.keys(labels.addresses).length + Object.keys(labels.txs).length;

  const onExport = async () => {
    const jsonl = await exportBip329(labels);
    const blob = new Blob([jsonl], { type: "application/jsonl" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `satlas-labels-${new Date().toISOString().slice(0, 10)}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (file: File) => {
    try {
      const incoming = await importBip329(await file.text());
      // Merge: imported labels win on conflict, existing ones are kept otherwise.
      replaceAll({
        outputs: { ...labels.outputs, ...incoming.outputs },
        addresses: { ...labels.addresses, ...incoming.addresses },
        txs: { ...labels.txs, ...incoming.txs },
      });
      const n =
        Object.keys(incoming.outputs).length +
        Object.keys(incoming.addresses).length +
        Object.keys(incoming.txs).length;
      setMsg(`Imported ${n} label${n === 1 ? "" : "s"}`);
      void reanalyze();
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
      <span>
        {count} label{count === 1 ? "" : "s"}
      </span>
      <button onClick={() => void onExport()} disabled={count === 0} className="underline-offset-2 hover:text-zinc-200 hover:underline disabled:opacity-40">
        Export BIP-329
      </button>
      <button onClick={() => fileRef.current?.click()} className="underline-offset-2 hover:text-zinc-200 hover:underline">
        Import BIP-329
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".jsonl,.json,.txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onImport(f);
        }}
      />
      {msg && <span className="text-zinc-500">{msg}</span>}
    </div>
  );
}
