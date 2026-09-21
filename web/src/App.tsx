import { useEffect, useState } from "react";
import { loadEngine } from "./wasm";
import { useWalletStore } from "./state/wallet";
import Landing from "./components/Landing";
import WalletView from "./components/WalletView";
import HelpModal from "./components/HelpModal";
import SettingsModal from "./components/SettingsModal";

export default function App() {
  const [engineError, setEngineError] = useState<string | null>(null);
  const [modal, setModal] = useState<"help" | "settings" | null>(null);
  const hasWallet = useWalletStore((s) => s.info !== null);

  useEffect(() => {
    loadEngine().catch((err) => setEngineError(String(err)));
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <button onClick={() => useWalletStore.getState().reset()} className="text-xl font-semibold tracking-tight">
            Satlas
          </button>
          <nav className="flex items-center gap-4 text-sm text-zinc-400">
            <button onClick={() => setModal("help")} className="hover:text-zinc-100">
              How it works
            </button>
            <button onClick={() => setModal("settings")} className="hover:text-zinc-100" aria-label="Settings" title="Settings">
              ⚙
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 py-10">
        {engineError && (
          <p role="alert" className="w-full rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            Satlas could not start its analysis engine: {engineError}. Try a different browser.
          </p>
        )}
        {hasWallet ? <WalletView /> : <Landing />}
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-8 text-center text-xs text-zinc-600">
        Watch-only. No account, no server, no keys. Your labels stay in this browser.
      </footer>

      {modal === "help" && <HelpModal onClose={() => setModal(null)} />}
      {modal === "settings" && <SettingsModal onClose={() => setModal(null)} />}
    </div>
  );
}
