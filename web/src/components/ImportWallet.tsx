import { useState, type FormEvent } from "react";
import { useWalletStore } from "../state/wallet";
import type { ScriptType } from "../engine/types";

const SCRIPT_TYPES: { value: ScriptType; label: string }[] = [
  { value: "native-segwit", label: "Addresses start with bc1q (most common)" },
  { value: "taproot", label: "Addresses start with bc1p" },
  { value: "nested-segwit", label: "Addresses start with 3" },
  { value: "legacy", label: "Addresses start with 1" },
];

export default function ImportWallet() {
  const [input, setInput] = useState("");
  const [scriptType, setScriptType] = useState<ScriptType>("native-segwit");
  const { importWallet, importing, error } = useWalletStore();

  // Only a plain xpub/tpub is ambiguous about address type; everything else says so itself.
  const needsScriptType = /^(\[[^\]]*\])?[xt]pub/i.test(input.trim());

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void importWallet(input, scriptType);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <textarea
        id="descriptor"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={3}
        spellCheck={false}
        aria-label="Public key or descriptor"
        placeholder="Paste your xpub / zpub / descriptor here"
        className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
      />

      {needsScriptType && (
        <label className="block">
          <span className="text-xs text-zinc-400">
            A plain xpub does not say what your addresses look like. Which is it?
          </span>
          <select
            value={scriptType}
            onChange={(e) => setScriptType(e.target.value as ScriptType)}
            className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none"
          >
            {SCRIPT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          Watch-only. Satlas cannot spend anything. Nothing leaves your browser except address lookups.
        </p>
        <button
          type="submit"
          disabled={importing || input.trim() === ""}
          className="rounded-md bg-amber-500 px-5 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {importing ? "Checking…" : "Show my coins"}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {friendlyError(error)}
        </p>
      )}
    </form>
  );
}

function friendlyError(e: string): string {
  if (/private key/i.test(e)) return "That looks like a private key. Satlas only needs the public one (xpub). Please don't paste private keys anywhere online.";
  if (/not a valid descriptor/i.test(e)) return "That doesn't look like an xpub or descriptor. Check the “Where do I find my xpub?” tips above.";
  if (/no wildcard/i.test(e)) return "This descriptor points at a single address. Satlas needs the whole wallet: it should end in /* (for example …/<0;1>/*).";
  return e;
}
