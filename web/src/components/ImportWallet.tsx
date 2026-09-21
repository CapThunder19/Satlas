import { useState, type FormEvent } from "react";
import { useWalletStore } from "../state/wallet";
import type { ScriptType } from "../engine/types";

const SCRIPT_TYPES: { value: ScriptType; label: string }[] = [
  { value: "native-segwit", label: "Native SegWit (BIP-84, bc1q...)" },
  { value: "taproot", label: "Taproot (BIP-86, bc1p...)" },
  { value: "nested-segwit", label: "Nested SegWit (BIP-49, 3...)" },
  { value: "legacy", label: "Legacy (BIP-44, 1...)" },
];

export default function ImportWallet() {
  const [input, setInput] = useState("");
  const [scriptType, setScriptType] = useState<ScriptType>("native-segwit");
  const { importWallet, importing, error } = useWalletStore();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void importWallet(input, scriptType);
  };

  return (
    <form onSubmit={onSubmit} className="w-full max-w-2xl space-y-4">
      <div>
        <label htmlFor="descriptor" className="block text-sm font-medium text-zinc-300">
          Public descriptor or extended public key
        </label>
        <textarea
          id="descriptor"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          spellCheck={false}
          placeholder="wpkh([fingerprint/84h/0h/0h]xpub.../<0;1>/*)  or  zpub...  or  vpub..."
          className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Watch-only. Private keys are never accepted, and nothing leaves your browser except
          address lookups to the block explorer.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grow">
          <label htmlFor="script-type" className="block text-sm font-medium text-zinc-300">
            Script type <span className="text-zinc-500">(only used for plain xpub / tpub)</span>
          </label>
          <select
            id="script-type"
            value={scriptType}
            onChange={(e) => setScriptType(e.target.value as ScriptType)}
            className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none"
          >
            {SCRIPT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={importing || input.trim() === ""}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {importing ? "Parsing..." : "Import"}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </form>
  );
}
