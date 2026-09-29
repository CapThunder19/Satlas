import { useState, type ReactNode } from "react";
import ImportWallet from "./ImportWallet";
import { useWalletStore } from "../state/wallet";
import { WALLET_XPUB_HINTS } from "../lib/copy";

const BLUE = "#3987e5";
const ORANGE = "#d95926";
const AQUA = "#199e70";
const AMBER = "#f59e0b";

export default function Landing() {
  const loadDemo = useWalletStore((s) => s.loadDemo);
  const demo = () => void loadDemo();

  return (
    <div className="w-full">
      <Hero onDemo={demo} />
      <ProofStrip />
      <Problem />
      <HowItWorks />
      <TryIt />
      <Features />
      <Trust />
      <Faq />
      <Start onDemo={demo} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Section({ id, eyebrow, title, sub, children }: { id?: string; eyebrow: string; title: ReactNode; sub?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">{eyebrow}</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">{title}</h2>
        {sub && <p className="mt-4 text-base text-zinc-400 sm:text-lg">{sub}</p>}
      </div>
      <div className="mt-12">{children}</div>
    </section>
  );
}

/* ---- hero ---------------------------------------------------------- */

function Hero({ onDemo }: { onDemo: () => void }) {
  return (
    <section className="relative overflow-hidden border-b border-zinc-900">
      <div className="satlas-grid-bg pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute -top-40 right-0 h-[520px] w-[520px] rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-20 h-[420px] w-[420px] rounded-full bg-sky-500/10 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:py-28 lg:grid-cols-[1.05fr_1fr]">
        <div className="satlas-rise">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1 text-xs text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Watch-only · Open source · Runs in your browser
          </div>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight text-zinc-50 sm:text-6xl">
            Know what your bitcoin reveals
            <span className="block bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500 bg-clip-text text-transparent">
              before you spend it.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-zinc-400">
            Every payment is public forever. Your wallet quietly picks which coins to spend — and can tie your salary
            to your donations in one click. Satlas shows you what a payment will expose, in plain English,{" "}
            <em className="text-zinc-200 not-italic">before</em> you press send.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={onDemo}
              className="rounded-lg bg-amber-500 px-5 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400"
            >
              Try the live demo →
            </button>
            <a
              href="#start"
              className="rounded-lg border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900"
            >
              Check my wallet
            </a>
          </div>
          <p className="mt-4 text-xs text-zinc-500">No sign-up. No keys. The demo uses made-up coins and fetches nothing.</p>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

/** Two groups of coins; the planned payment would join them. */
function HeroVisual() {
  return (
    <div className="satlas-rise relative mx-auto w-full max-w-lg" style={{ animationDelay: "120ms" }}>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="flex items-center gap-1.5 px-2 pb-2">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <span className="ml-3 text-[11px] text-zinc-500">Map · planned payment of 0.23 BTC</span>
        </div>
        <svg viewBox="0 0 440 300" className="block w-full rounded-xl" style={{ background: "#18181b" }} role="img" aria-label="Two separate groups of coins, and a payment that would link them">
          {/* group: salary */}
          <circle cx="120" cy="130" r="78" fill={BLUE} fillOpacity="0.08" stroke={BLUE} strokeOpacity="0.3" strokeWidth="2" />
          <text x="120" y="42" textAnchor="middle" fontSize="12" fontWeight="600" fill="#e4e4e7">Group 1 · Salary</text>
          <circle cx="98" cy="118" r="30" fill={BLUE} stroke="#18181b" strokeWidth="2" />
          <circle cx="152" cy="160" r="16" fill={BLUE} stroke="#18181b" strokeWidth="2" />
          <circle cx="148" cy="96" r="10" fill={BLUE} stroke="#18181b" strokeWidth="2" />
          <circle cx="98" cy="118" r="37" fill="none" stroke={AMBER} strokeWidth="3" className="satlas-pulse" />

          {/* group: donation */}
          <circle cx="330" cy="200" r="58" fill={AQUA} fillOpacity="0.08" stroke={AQUA} strokeOpacity="0.3" strokeWidth="2" />
          <text x="330" y="280" textAnchor="middle" fontSize="12" fontWeight="600" fill="#e4e4e7">Group 2 · Donation</text>
          <circle cx="330" cy="200" r="22" fill={AQUA} stroke="#18181b" strokeWidth="2" />
          <circle cx="330" cy="200" r="29" fill="none" stroke={AMBER} strokeWidth="3" className="satlas-pulse" />

          {/* group: exchange (untouched) */}
          <circle cx="345" cy="62" r="34" fill={ORANGE} fillOpacity="0.08" stroke={ORANGE} strokeOpacity="0.3" strokeWidth="2" />
          <circle cx="345" cy="62" r="14" fill={ORANGE} stroke="#18181b" strokeWidth="2" />
          <text x="345" y="20" textAnchor="middle" fontSize="11" fill="#a1a1aa">Group 3 · Exchange</text>

          {/* the new link */}
          <line x1="128" y1="132" x2="304" y2="192" stroke={AMBER} strokeWidth="3" strokeDasharray="10 8" className="satlas-dash" />
          <text x="206" y="186" textAnchor="middle" fontSize="11" fontWeight="600" fill={AMBER} stroke="#18181b" strokeWidth="4" paintOrder="stroke">
            new public link
          </text>
        </svg>
      </div>

      <div className="satlas-float absolute -bottom-6 -left-4 w-64 rounded-xl border border-red-900/70 bg-zinc-950/95 p-3 shadow-xl sm:-left-10">
        <div className="flex items-center gap-2">
          <span className="rounded bg-red-950 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300">Careful</span>
          <span className="rounded border border-amber-800 bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-300">Likely</span>
        </div>
        <p className="mt-2 text-sm font-medium text-zinc-100">This connects your Salary and Donation coins.</p>
        <p className="mt-1 text-xs text-zinc-400">Try “Best for privacy” → safe to send.</p>
      </div>
    </div>
  );
}

function ProofStrip() {
  const items = [
    { big: "0", small: "private keys ever needed" },
    { big: "0", small: "servers, accounts or trackers" },
    { big: "100%", small: "of the analysis runs in your browser" },
    { big: "BIP-329", small: "labels you can take anywhere" },
  ];
  return (
    <div className="border-b border-zinc-900 bg-zinc-950">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:grid-cols-4">
        {items.map((i) => (
          <div key={i.small} className="text-center">
            <div className="text-2xl font-semibold text-zinc-50 sm:text-3xl">{i.big}</div>
            <div className="mt-1 text-xs text-zinc-500 sm:text-sm">{i.small}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- problem ------------------------------------------------------- */

function Problem() {
  const coins = [
    { v: "0.80 BTC", label: "Exchange", color: ORANGE, when: "12 days ago" },
    { v: "0.20 BTC", label: "Salary", color: BLUE, when: "8 days ago" },
    { v: "0.05 BTC", label: "Donation", color: AQUA, when: "3 days ago" },
  ];
  return (
    <Section
      eyebrow="The problem"
      title="Your wallet shows a balance. The blockchain shows much more."
      sub="Bitcoin isn't one pot of money. It's separate coins, each with a public history. Spend two together and anyone can see they belong to the same person."
    >
      <div className="grid items-stretch gap-6 md:grid-cols-[1fr_auto_1fr]">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">What your wallet shows</div>
          <div className="mt-8 text-center">
            <div className="text-sm text-zinc-400">Balance</div>
            <div className="mt-1 text-5xl font-semibold tabular-nums text-zinc-100">1.05 BTC</div>
            <div className="mt-6 text-sm text-zinc-500">…and a “Send” button that picks coins for you.</div>
          </div>
        </div>

        <div className="hidden items-center text-2xl text-zinc-600 md:flex">→</div>

        <div className="rounded-2xl border border-amber-900/50 bg-zinc-900/40 p-6 shadow-lg shadow-amber-500/5">
          <div className="text-xs font-medium uppercase tracking-wide text-amber-400">What Satlas shows</div>
          <ul className="mt-5 space-y-2.5">
            {coins.map((c) => (
              <li key={c.label} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                  <span className="font-semibold tabular-nums text-zinc-100">{c.v}</span>
                  <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200">{c.label}</span>
                </div>
                <span className="text-xs text-zinc-500">{c.when}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-zinc-400">
            Three coins, three separate stories — and a warning before any payment would merge them.
          </p>
        </div>
      </div>
    </Section>
  );
}

/* ---- how it works -------------------------------------------------- */

function HowItWorks() {
  const steps = [
    {
      n: "1",
      title: "Paste your public key",
      text: "An xpub or descriptor lets Satlas see your coins. It can never spend them, and your seed phrase is never asked for.",
      icon: "🔑",
    },
    {
      n: "2",
      title: "Name your coins",
      text: "See each coin separately and label where it came from: Salary, Exchange, a friend. Labels stay in your browser.",
      icon: "🏷️",
    },
    {
      n: "3",
      title: "Check before you pay",
      text: "Type an amount. Satlas shows which coins your wallet would use, what that exposes, and a safer way if there is one.",
      icon: "🛡️",
    },
  ];
  return (
    <div className="border-y border-zinc-900 bg-zinc-900/20">
      <Section id="how" eyebrow="How it works" title="Three steps. About a minute." sub="Keep using your normal wallet. Satlas is the checkup that sits beside it.">
        <ol className="relative grid gap-6 md:grid-cols-3">
          <div className="pointer-events-none absolute left-[16%] right-[16%] top-8 hidden h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent md:block" />
          {steps.map((s) => (
            <li key={s.n} className="relative rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-2xl">{s.icon}</div>
              <div className="mt-4 text-xs font-semibold uppercase tracking-widest text-amber-400">Step {s.n}</div>
              <h3 className="mt-1 text-lg font-semibold text-zinc-100">{s.title}</h3>
              <p className="mt-2 text-sm text-zinc-400">{s.text}</p>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

/* ---- interactive mini demo ---------------------------------------- */

type Pick = "wallet" | "privacy";

function TryIt() {
  const [pick, setPick] = useState<Pick>("wallet");
  const coins = [
    { id: "ex", v: "0.80", label: "Exchange", color: ORANGE },
    { id: "sa", v: "0.20", label: "Salary", color: BLUE },
    { id: "do", v: "0.05", label: "Donation", color: AQUA },
  ];
  const chosen = pick === "wallet" ? new Set(["sa", "do"]) : new Set(["ex"]);
  const bad = pick === "wallet";

  return (
    <Section
      eyebrow="See it in action"
      title="Same payment. Very different story."
      sub="You want to send 0.23 BTC. Flip between what a typical wallet would do and what Satlas suggests."
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-zinc-400">
            Send <span className="font-mono text-lg text-zinc-100">0.23 BTC</span>
          </div>
          <div role="tablist" className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-1 text-sm">
            {(
              [
                ["wallet", "What your wallet does"],
                ["privacy", "Best for privacy"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={pick === k}
                onClick={() => setPick(k)}
                className={`rounded-md px-3 py-1.5 font-medium transition ${pick === k ? "bg-zinc-800 text-zinc-50" : "text-zinc-400 hover:text-zinc-200"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {coins.map((c) => {
            const on = chosen.has(c.id);
            return (
              <li
                key={c.id}
                className={`rounded-xl border p-4 transition ${on ? "border-amber-500/70 bg-amber-500/5 ring-1 ring-amber-500/30" : "border-zinc-800 bg-zinc-950/60 opacity-60"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold tabular-nums text-zinc-100">{c.v} BTC</span>
                  {on && <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">spent</span>}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-zinc-300">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                  {c.label}
                </div>
              </li>
            );
          })}
        </ul>

        <div
          className={`mt-5 rounded-xl border px-5 py-4 transition ${bad ? "border-red-800 bg-red-950/40 text-red-100" : "border-emerald-800 bg-emerald-950/40 text-emerald-100"}`}
          aria-live="polite"
        >
          <div className="text-lg font-semibold">
            {bad ? "Careful — this connects coins that were separate" : "Safe to send — reveals nothing new"}
          </div>
          <p className="mt-1 text-sm opacity-90">
            {bad
              ? "Your Salary and Donation coins would appear together as inputs. Anyone who knows where one came from can now infer the other is yours too."
              : "One coin from a single source. Nothing new is linked, and the change stays in the same group."}
          </p>
        </div>
      </div>
    </Section>
  );
}

/* ---- features ------------------------------------------------------ */

function Features() {
  const items = [
    { icon: "🪙", title: "Coins, not a balance", text: "Every coin with its value, age, origin and the group an outsider can tie it to." },
    { icon: "🔍", title: "Pre-payment check", text: "Six coin-selection methods simulated and compared side by side, with a one-click safer option." },
    { icon: "🗺️", title: "Relationship map", text: "See which coins are already linked, and the exact link your next payment would add." },
    { icon: "💬", title: "Plain English", text: "No jargon. Every warning says what happened, why it matters and what you can do." },
    { icon: "🎯", title: "Honest about certainty", text: "Every conclusion is marked Fact, Likely or Unclear. Guesses are never dressed up as facts." },
    { icon: "🏷️", title: "Portable labels", text: "Export and import BIP-329 labels to and from Sparrow and other wallets." },
  ];
  return (
    <div className="border-y border-zinc-900 bg-zinc-900/20">
      <Section id="features" eyebrow="Features" title="Everything you need to spend privately" sub="Built on the same heuristics chain-analysis firms use — pointed back at you, for you.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((f) => (
            <div key={f.title} className="group rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-zinc-700 hover:bg-zinc-900/60">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-xl transition group-hover:border-amber-800">
                {f.icon}
              </div>
              <h3 className="mt-4 font-semibold text-zinc-100">{f.title}</h3>
              <p className="mt-1.5 text-sm text-zinc-400">{f.text}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 px-6 py-4 text-sm">
          <span className="text-zinc-500">How sure is Satlas?</span>
          <Badge cls="border-emerald-800 bg-emerald-950/60 text-emerald-300" label="Fact" text="on the blockchain or told by you" />
          <Badge cls="border-amber-800 bg-amber-950/60 text-amber-300" label="Likely" text="a well-known rule of thumb" />
          <Badge cls="border-zinc-700 bg-zinc-900 text-zinc-400" label="Unclear" text="not enough information" />
        </div>
      </Section>
    </div>
  );
}

function Badge({ cls, label, text }: { cls: string; label: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>{label}</span>
      <span className="text-zinc-400">{text}</span>
    </span>
  );
}

/* ---- trust --------------------------------------------------------- */

function Trust() {
  return (
    <Section
      id="trust"
      eyebrow="Trust model"
      title="Private by design. Honest about the trade-offs."
      sub="Satlas has no backend. But we won't pretend it's magic — here's exactly what happens to your data."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <TrustCard tone="good" title="Satlas never…" items={["asks for a seed phrase or private key", "signs or broadcasts a transaction", "runs a server, account or tracker", "sends your labels anywhere"]} />
        <TrustCard
          tone="warn"
          title="By default…"
          items={["your browser asks a public block explorer (mempool.space) about your addresses", "that explorer can see which addresses were looked up", "— the same trade-off as any watch-only wallet"]}
        />
        <TrustCard tone="fix" title="To remove that…" items={["open Settings ⚙", "point Satlas at your own Esplora or mempool server", "now no third party sees your addresses at all"]} />
      </div>
    </Section>
  );
}

function TrustCard({ tone, title, items }: { tone: "good" | "warn" | "fix"; title: string; items: string[] }) {
  const style = {
    good: { border: "border-emerald-900/60", mark: "✓", markCls: "text-emerald-400" },
    warn: { border: "border-amber-900/60", mark: "!", markCls: "text-amber-400" },
    fix: { border: "border-sky-900/60", mark: "→", markCls: "text-sky-400" },
  }[tone];
  return (
    <div className={`rounded-2xl border ${style.border} bg-zinc-900/40 p-6`}>
      <h3 className="font-semibold text-zinc-100">{title}</h3>
      <ul className="mt-4 space-y-2.5 text-sm text-zinc-300">
        {items.map((i) => (
          <li key={i} className="flex gap-2.5">
            <span className={`mt-px font-bold ${style.markCls}`}>{style.mark}</span>
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---- faq ----------------------------------------------------------- */

function Faq() {
  const qs = [
    {
      q: "Can Satlas spend or steal my bitcoin?",
      a: "No. An xpub or descriptor only reveals addresses; it cannot sign anything. Satlas refuses private keys outright, and it never builds or broadcasts transactions. You still pay from your normal wallet.",
    },
    {
      q: "Which wallets does it work with?",
      a: "Any wallet that can show an xpub, zpub or output descriptor: Sparrow, BlueWallet, Electrum, Bitcoin Core, and hardware-wallet apps like Ledger Live or Trezor Suite.",
    },
    {
      q: "Where are my labels stored?",
      a: "Only in your browser (IndexedDB). There is no Satlas server. Export them as a BIP-329 file any time to back them up or move them to another wallet.",
    },
    {
      q: "Is the analysis always right?",
      a: "It uses the same rules of thumb chain-analysis companies use, which are usually but not always right. That's why every conclusion is marked Fact, Likely or Unclear. CoinJoin and PayJoin transactions can defeat these rules.",
    },
    {
      q: "Does it cost anything?",
      a: "No. It's open source and runs entirely in your browser.",
    },
  ];
  return (
    <div className="border-t border-zinc-900 bg-zinc-900/20">
      <Section eyebrow="FAQ" title="Questions, answered">
        <div className="mx-auto max-w-3xl divide-y divide-zinc-800 rounded-2xl border border-zinc-800 bg-zinc-950">
          {qs.map((x) => (
            <details key={x.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-zinc-100">
                {x.q}
                <span className="text-zinc-500 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-zinc-400">{x.a}</p>
            </details>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* ---- start --------------------------------------------------------- */

function Start({ onDemo }: { onDemo: () => void }) {
  const [showHints, setShowHints] = useState(false);
  return (
    <section id="start" className="relative scroll-mt-16 overflow-hidden border-t border-zinc-900">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-3xl px-4 py-20 sm:py-24">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">Check your own wallet</h2>
          <p className="mt-3 text-zinc-400">Paste a public key. It stays in your browser.</p>
        </div>

        <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-2xl shadow-black/40 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium text-zinc-100">Your xpub, zpub or descriptor</h3>
            <button onClick={() => setShowHints((v) => !v)} className="text-sm text-amber-400 hover:text-amber-300">
              {showHints ? "Hide help" : "Where do I find it?"}
            </button>
          </div>

          {showHints && (
            <ul className="mb-4 space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm">
              {WALLET_XPUB_HINTS.map((h) => (
                <li key={h.wallet}>
                  <span className="font-medium text-zinc-200">{h.wallet}:</span> <span className="text-zinc-400">{h.how}</span>
                </li>
              ))}
              <li className="pt-1 text-xs text-zinc-500">
                Anything starting with xpub, ypub, zpub, tpub, vpub, or a descriptor like wpkh(…) works. Never paste a seed
                phrase or anything starting with xprv.
              </li>
            </ul>
          )}

          <ImportWallet />
        </div>

        <div className="mt-8 text-center">
          <span className="text-sm text-zinc-500">No wallet handy? </span>
          <button onClick={onDemo} className="text-sm font-medium text-amber-400 underline-offset-4 hover:underline">
            Explore the demo wallet
          </button>
        </div>
      </div>
    </section>
  );
}
