import { useEffect, useState } from "react";
import { loadEngine } from "./wasm";
import { useWalletStore } from "./state/wallet";
import ImportWallet from "./components/ImportWallet";
import WalletView from "./components/WalletView";

export default function App() {
  const [engineVersion, setEngineVersion] = useState<string | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const hasWallet = useWalletStore((s) => s.info !== null);
  const loadDemo = useWalletStore((s) => s.loadDemo);

  useEffect(() => {
    loadEngine()
      .then((e) => setEngineVersion(e.version()))
      .catch((err) => setEngineError(String(err)));
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-semibold tracking-tight">Satlas</h1>
          <span className="text-xs text-zinc-500">
            {engineError
              ? `engine error: ${engineError}`
              : engineVersion
                ? `engine v${engineVersion}`
                : "loading engine..."}
          </span>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 py-12">
        {!hasWallet && (
          <div className="text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              Know what your Bitcoin reveals before you spend it.
            </h2>
            <p className="mt-2 text-zinc-400">
              Import a watch-only wallet to see your coins and simulate a spend.
            </p>
          </div>
        )}
        {hasWallet ? (
          <WalletView />
        ) : (
          <>
            <ImportWallet />
            <button
              onClick={() => void loadDemo()}
              className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
            >
              No wallet handy? Load the demo wallet
            </button>
          </>
        )}
      </main>
    </div>
  );
}
