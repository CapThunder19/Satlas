import { useEffect, useState } from "react";
import { loadEngine } from "./wasm";
import { useWalletStore } from "./state/wallet";
import Landing from "./components/Landing";
import WalletView from "./components/WalletView";
import HelpModal from "./components/HelpModal";
import SettingsModal from "./components/SettingsModal";

const REPO_URL = "https://github.com/CapThunder19/Satlas";

export default function App() {
  const [engineError, setEngineError] = useState<string | null>(null);
  const [modal, setModal] = useState<"help" | "settings" | null>(null);
  const hasWallet = useWalletStore((s) => s.info !== null);
  const restoring = useWalletStore((s) => s.restoring);
  const onLanding = !hasWallet && !restoring;

  useEffect(() => {
    loadEngine()
      .then(() => useWalletStore.getState().restore())
      .catch((err) => setEngineError(String(err)));
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur">
        <div className={`mx-auto flex items-center justify-between px-4 py-3 ${onLanding ? "max-w-6xl" : "max-w-5xl"}`}>
          <button
            onClick={() => {
              useWalletStore.getState().reset();
              window.scrollTo({ top: 0 });
            }}
            className="flex items-center gap-2 text-xl font-semibold tracking-tight"
          >
            <Logo />
            Satlas
          </button>
          <nav className="flex items-center gap-5 text-sm text-zinc-400">
            {onLanding && (
              <>
                <a href="#how" className="hidden hover:text-zinc-100 sm:inline">
                  How it works
                </a>
                <a href="#features" className="hidden hover:text-zinc-100 sm:inline">
                  Features
                </a>
                <a href="#trust" className="hidden hover:text-zinc-100 md:inline">
                  Privacy
                </a>
              </>
            )}
            {!onLanding && (
              <button onClick={() => setModal("help")} className="hover:text-zinc-100">
                Help
              </button>
            )}
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="hidden hover:text-zinc-100 sm:inline">
              GitHub
            </a>
            <button onClick={() => setModal("settings")} className="hover:text-zinc-100" aria-label="Settings" title="Settings">
              ⚙
            </button>
            {onLanding && (
              <a
                href="#start"
                className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400"
              >
                Get started
              </a>
            )}
          </nav>
        </div>
      </header>

      {engineError && (
        <div className="mx-auto max-w-5xl px-4 pt-6">
          <p role="alert" className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            Satlas could not start its analysis engine: {engineError}. Try a different browser.
          </p>
        </div>
      )}

      {onLanding ? (
        <Landing />
      ) : (
        <main className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 py-10">
          {hasWallet ? <WalletView /> : <p className="text-sm text-zinc-500">Reopening your wallet…</p>}
        </main>
      )}

      <footer className="border-t border-zinc-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-zinc-500">
          <span className="flex items-center gap-2">
            <Logo small /> Satlas · Watch-only. No account, no server, no keys.
          </span>
          <span className="flex gap-4">
            <button onClick={() => setModal("help")} className="hover:text-zinc-300">
              Glossary
            </button>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-zinc-300">
              Source code
            </a>
            <span>MIT license</span>
          </span>
        </div>
      </footer>

      {modal === "help" && <HelpModal onClose={() => setModal(null)} />}
      {modal === "settings" && <SettingsModal onClose={() => setModal(null)} />}
    </div>
  );
}

function Logo({ small }: { small?: boolean }) {
  const s = small ? 14 : 22;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="none" stroke="#3987e5" strokeOpacity="0.5" strokeWidth="1.5" />
      <circle cx="9" cy="10" r="4" fill="#3987e5" />
      <circle cx="15.5" cy="15" r="2.5" fill="#199e70" />
      <circle cx="9" cy="10" r="5.6" fill="none" stroke="#f59e0b" strokeWidth="1.3" />
    </svg>
  );
}
