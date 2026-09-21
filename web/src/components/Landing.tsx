import { useState } from "react";
import ImportWallet from "./ImportWallet";
import { useWalletStore } from "../state/wallet";
import { WALLET_XPUB_HINTS } from "../lib/copy";

const STEPS = [
  {
    n: "1",
    title: "Paste your wallet's public key",
    text: "An xpub or descriptor lets Satlas see your coins but never spend them. Your seed phrase is never needed.",
  },
  {
    n: "2",
    title: "See your bitcoin as separate coins",
    text: "Not one balance — individual coins, each with its own story. Name them: Salary, Exchange, Gift.",
  },
  {
    n: "3",
    title: "Check a payment before you send it",
    text: "Type an amount. Satlas tells you which coins your wallet would use and whether that connects things you'd rather keep apart.",
  },
];

export default function Landing() {
  const loadDemo = useWalletStore((s) => s.loadDemo);
  const [showHints, setShowHints] = useState(false);

  return (
    <div className="w-full max-w-3xl space-y-10">
      <div className="text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Know what your bitcoin reveals
          <br />
          <span className="text-amber-400">before you spend it.</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-zinc-400">
          Every payment is public forever. Satlas shows what a payment would tell the world about you — in
          plain English, before you press send.
        </p>
      </div>

      <ol className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-zinc-950">
              {s.n}
            </div>
            <h3 className="font-medium text-zinc-100">{s.title}</h3>
            <p className="mt-1 text-sm text-zinc-400">{s.text}</p>
          </li>
        ))}
      </ol>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium">Start with your wallet</h3>
          <button onClick={() => setShowHints((v) => !v)} className="text-sm text-amber-400 hover:text-amber-300">
            Where do I find my xpub?
          </button>
        </div>

        {showHints && (
          <ul className="mb-4 space-y-1.5 rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm">
            {WALLET_XPUB_HINTS.map((h) => (
              <li key={h.wallet}>
                <span className="font-medium text-zinc-200">{h.wallet}:</span>{" "}
                <span className="text-zinc-400">{h.how}</span>
              </li>
            ))}
            <li className="pt-1 text-xs text-zinc-500">
              Anything starting with xpub, ypub, zpub, tpub, vpub, or a descriptor like wpkh(…) works. Never
              paste a seed phrase or anything starting with xprv.
            </li>
          </ul>
        )}

        <ImportWallet />
      </div>

      <div className="text-center">
        <p className="text-sm text-zinc-500">Just curious?</p>
        <button
          onClick={() => void loadDemo()}
          className="mt-2 rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:border-zinc-500 hover:bg-zinc-900"
        >
          Explore with a demo wallet
        </button>
        <p className="mt-2 text-xs text-zinc-600">Made-up coins, nothing is fetched from the internet.</p>
      </div>
    </div>
  );
}
