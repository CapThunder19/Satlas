import { useState } from "react";
import Modal from "./Modal";
import { useSettings } from "../state/settings";
import { DEFAULT_ENDPOINTS, KNOWN_ENDPOINTS } from "../api/esplora";
import type { Network } from "../engine/types";

const NETWORKS: { id: Network; label: string }[] = [
  { id: "bitcoin", label: "Bitcoin (mainnet)" },
  { id: "signet", label: "Signet (test coins)" },
  { id: "testnet", label: "Testnet4" },
];

function isUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { endpoints, gapLimit, setEndpoint, resetEndpoint, setGapLimit } = useSettings();
  const [advanced, setAdvanced] = useState(false);

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="space-y-5 text-sm">
        <section className="space-y-2">
          <h3 className="font-medium text-zinc-100">Where Satlas looks up your coins</h3>
          <p className="text-xs text-zinc-400">
            By default Satlas asks the public mempool.space server about your addresses. That server can see
            which addresses you asked about. If you run your own Esplora or mempool server, paste its API URL
            here and no third party ever sees your addresses.
          </p>
          {NETWORKS.map((n) => (
            <label key={n.id} className="block">
              <span className="text-xs text-zinc-400">{n.label}</span>
              <div className="mt-1 flex gap-2">
                <input
                  value={endpoints[n.id]}
                  onChange={(e) => setEndpoint(n.id, e.target.value)}
                  spellCheck={false}
                  aria-invalid={!isUrl(endpoints[n.id])}
                  className={`w-full rounded-md border bg-zinc-900 px-3 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none ${
                    isUrl(endpoints[n.id]) ? "border-zinc-800 focus:border-amber-500" : "border-red-800"
                  }`}
                />
                <select
                  aria-label="Preset servers"
                  value=""
                  onChange={(e) => e.target.value && setEndpoint(n.id, e.target.value)}
                  className="rounded-md border border-zinc-800 bg-zinc-900 px-2 text-xs text-zinc-300"
                >
                  <option value="">presets…</option>
                  {KNOWN_ENDPOINTS[n.id].map((k) => (
                    <option key={k.url} value={k.url}>
                      {k.name}
                    </option>
                  ))}
                </select>
                {endpoints[n.id] !== DEFAULT_ENDPOINTS[n.id] && (
                  <button onClick={() => resetEndpoint(n.id)} className="text-xs text-zinc-400 hover:text-zinc-200">
                    reset
                  </button>
                )}
              </div>
            </label>
          ))}
        </section>

        <button onClick={() => setAdvanced((a) => !a)} className="text-xs text-zinc-400 hover:text-zinc-200">
          {advanced ? "Hide" : "Show"} advanced
        </button>

        {advanced && (
          <section className="space-y-2">
            <label className="block">
              <span className="font-medium text-zinc-100">Gap limit</span>
              <p className="text-xs text-zinc-400">
                How many unused addresses in a row before Satlas stops looking. 20 is the standard. Raise it
                if coins seem to be missing.
              </p>
              <input
                type="number"
                min={1}
                max={500}
                value={gapLimit}
                onChange={(e) => setGapLimit(Math.max(1, Math.min(500, Number(e.target.value) || 20)))}
                className="mt-1 w-24 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-mono text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
              />
            </label>
          </section>
        )}

        <p className="text-xs text-zinc-500">Changes apply the next time you import or rescan a wallet.</p>
      </div>
    </Modal>
  );
}
