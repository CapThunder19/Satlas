<div align="center">

<img src="docs/banner.svg" alt="Satlas — know what your Bitcoin reveals before you spend it" width="100%" />

<br />

![Rust](https://img.shields.io/badge/Rust-engine-b7410e?style=for-the-badge&logo=rust&logoColor=white)
![WebAssembly](https://img.shields.io/badge/WebAssembly-client--side-654ff0?style=for-the-badge&logo=webassembly&logoColor=white)
![React](https://img.shields.io/badge/React_19-UI-149eca?style=for-the-badge&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=for-the-badge&logo=typescript&logoColor=white)
<br />
![Bitcoin](https://img.shields.io/badge/Bitcoin-watch--only-f7931a?style=flat-square&logo=bitcoin&logoColor=white)
![BIP-329](https://img.shields.io/badge/labels-BIP--329-f59e0b?style=flat-square)
![Tests](https://img.shields.io/badge/tests-32_Rust_·_12_TS-22c55e?style=flat-square)
![Backend](https://img.shields.io/badge/backend-none-71717a?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-3b82f6?style=flat-square)

**A client-side Bitcoin privacy analyzer.**
See your wallet as individual coins, name where they came from, and check a payment
*before* you send it — in plain English.

[**Quick start**](#-quick-start) · [**Features**](#-features) · [**How it works**](#-how-it-works) · [**Trust model**](#-trust-model) · [**Development**](#-development)

</div>

---

## 🧭 The problem

Bitcoin has no single balance. Your wallet holds **separate coins**, each with its own history.
When you pay someone, the wallet picks coins automatically — and if it picks two that came from
different parts of your life, everyone watching the blockchain learns they belong to the same person.
**Forever.**

```mermaid
flowchart LR
    S["🟦 Salary coin<br/>0.20 BTC"]:::salary --> T{{"One payment<br/>of 0.23 BTC"}}:::tx
    D["🟩 Donation coin<br/>0.05 BTC"]:::donation --> T
    T --> R["Recipient"]:::out
    T --> C["Change back to you"]:::out
    T -. "now publicly linked" .-> L["😬 Salary ⟷ Donation<br/>same owner"]:::leak

    classDef salary fill:#1e3a5f,stroke:#3987e5,color:#fff
    classDef donation fill:#123f31,stroke:#199e70,color:#fff
    classDef tx fill:#27272a,stroke:#f59e0b,color:#fff
    classDef out fill:#18181b,stroke:#52525b,color:#e4e4e7
    classDef leak fill:#450a0a,stroke:#ef4444,color:#fecaca
```

Most wallets hide this behind automatic coin selection. **Satlas shows it to you before it happens** —
without holding your keys, replacing your wallet, or sending your data to a server.

<table>
<tr>
<td align="center" width="25%">🔑<br/><b>Watch-only</b><br/><sub>No private keys, no signing, no broadcasting</sub></td>
<td align="center" width="25%">🖥️<br/><b>No backend</b><br/><sub>All analysis runs in your browser via WASM</sub></td>
<td align="center" width="25%">🔌<br/><b>Wallet-agnostic</b><br/><sub>Works beside Sparrow, BlueWallet, Electrum…</sub></td>
<td align="center" width="25%">🧾<br/><b>Explainable</b><br/><sub>Every conclusion says why, and how sure it is</sub></td>
</tr>
</table>

---

## 🚀 Quick start

```sh
git clone https://github.com/CapThunder19/Satlas.git
cd Satlas/web
pnpm install
pnpm wasm      # build the Rust engine to WebAssembly
pnpm dev       # → http://localhost:5173
```

1. Click **Explore with a demo wallet** (or paste your own xpub / zpub / descriptor)
2. Open **Check a payment** and type `0.23`
3. Watch Satlas warn you that it would link *Salary* and *Donation* — then click **Show me** for a safer way

---

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

### 🪙 Your coins
Every unspent coin with its value, age, origin and group.
Click **+ name this coin** to label it; change inherits the label of
the coins that funded it when that's unambiguous.

</td>
<td width="50%" valign="top">

### 🔍 Check a payment
Type an amount. Satlas simulates the coins your wallet would pick
and tells you what that reveals — with a **Show me** button when a
safer selection exists.

</td>
</tr>
<tr>
<td><img src="docs/screenshots/coins.png" alt="Your coins" /></td>
<td><img src="docs/screenshots/check-payment.png" alt="Check a payment" /></td>
</tr>
<tr>
<td width="50%" valign="top">

### 🗺️ Map
A force-directed map: bubbles are coins sized by value, shaded areas are groups
an outsider can already link, and a pulsing amber line shows the **new** link
your planned payment would create.

</td>
<td width="50%" valign="top">

### 🏠 Beginner-first
Three-step onboarding, per-wallet *"where's my xpub?"* help, a glossary,
jargon-free copy, and *"what you can do"* advice on every warning.

</td>
</tr>
<tr>
<td><img src="docs/screenshots/map.png" alt="Map" /></td>
<td><img src="docs/screenshots/landing.png" alt="Landing page" /></td>
</tr>
</table>

### Verdicts

| | Verdict | Meaning |
|:-:|---|---|
| 🟢 | **Safe to send** | Reveals nothing an observer couldn't already infer |
| 🟡 | **Mostly fine** | Some history exposed, but no labelled coins newly linked |
| 🔴 | **Careful** | Connects coins that were previously separate |

### Certainty on every conclusion

Satlas never dresses a heuristic up as a fact.

| Badge | Meaning | Example |
|---|---|---|
| ![Fact](https://img.shields.io/badge/FACT-065f46?style=flat-square) | On the blockchain, or a label you added | *"This address received 2 payments"* |
| ![Likely](https://img.shields.io/badge/LIKELY-92400e?style=flat-square) | A standard chain-analysis rule of thumb | *"This output looks like change"* |
| ![Unclear](https://img.shields.io/badge/UNCLEAR-3f3f46?style=flat-square) | Not enough information | *"This coin has no label"* |

### Six coin-selection strategies, compared side by side

| Strategy | What it models |
|---|---|
| Biggest coins first | The default in most wallets |
| Oldest coins first | FIFO |
| Smallest coins first | Consolidation |
| Avoid change | Exact-match subset, no change output |
| **Best for privacy** | Stay inside one already-linked group |
| I'll pick the coins | Manual coin control |

### More
- 🏷️ **BIP-329 labels** — export to / import from Sparrow and other compatible wallets
- 🌐 **Real-wallet scanning** — parallel gap-limit scan, retries, rate-limit backoff, automatic failover
- 💾 **Remember this wallet** — cached in IndexedDB, reopens instantly, refreshes in the background
- 🛠️ **Self-hosted backend** — point Satlas at your own Esplora / mempool instance
- 🧪 **Demo wallet** — synthetic history for trying it with zero setup

---

## ⚙️ How it works

### Architecture

```mermaid
flowchart LR
    U(["👤 xpub /<br/>descriptor"]):::you --> D

    subgraph B["🖥️ Your browser"]
        D["① Derive addresses<br/><sub>🦀 Rust · WASM</sub>"]:::rust --> S["② Scan history<br/><sub>TypeScript</sub>"]:::ts
        S --> A["③ Coins + heuristics<br/><sub>🦀 Rust · WASM</sub>"]:::rust
        A --> V["④ Coins · Map<br/><sub>React</sub>"]:::ts
        V --> P["⑤ Simulate payment<br/><sub>🦀 Rust · WASM</sub>"]:::rust
        V <--> I[("IndexedDB<br/><sub>labels · cache</sub>")]:::store
    end

    S <-->|"HTTPS · addresses only"| E[("Esplora API<br/><sub>mempool.space<br/>blockstream.info<br/>or your own</sub>")]:::ext

    classDef you fill:#1c1917,stroke:#f59e0b,color:#fde68a
    classDef rust fill:#3b1d12,stroke:#d95926,color:#fff
    classDef ts fill:#132a45,stroke:#3987e5,color:#fff
    classDef store fill:#18181b,stroke:#71717a,color:#e4e4e7
    classDef ext fill:#1c1917,stroke:#f59e0b,color:#fde68a
```

<sub>🟧 Rust compiled to WebAssembly · 🟦 TypeScript / React · everything inside the box runs locally</sub>

### What happens when you check a payment

```mermaid
sequenceDiagram
    autonumber
    actor You
    participant UI as React UI
    participant Core as satlas-core (WASM)

    You->>UI: Amount 0.23 BTC
    UI->>Core: simulateSpend(wallet, amount, strategy)
    Core->>Core: Select coins (biggest first)
    Core->>Core: Which groups & labels do the inputs span?
    Core->>Core: Is the change output identifiable?
    Core-->>UI: 🔴 Careful — links Salary ⟷ Donation
    UI->>Core: simulateAll(every strategy)
    Core-->>UI: "Best for privacy" → 🟢 Safe to send
    UI-->>You: Verdict · why · what you can do · Show me
```

### The heuristics

```mermaid
mindmap
  root((satlas-core<br/>heuristics))
    Common-input ownership
      Coins spent together share an owner
      Union-find over full history
      Names the tx that merged groups
    Address reuse
      Same address received twice
      Always a Fact
    Change detection
      Round payment amount
      Script-type mismatch
      Change to a reused address
      Unnecessary input
    Label mixing
      Inputs carry different labels
      From previously separate groups
```

<details>
<summary><b>Scanning a real wallet — the details</b></summary>

<br />

```mermaid
flowchart LR
    A["Derive receive #0…n<br/>and change #0…n"] --> B{"Address has<br/>history?"}
    B -- yes --> C["Fetch all pages<br/>until count matches"] --> D["Extend window:<br/>last used + gap"]
    B -- no --> E{"20 unused<br/>in a row?"}
    D --> A
    E -- no --> A
    E -- yes --> F(["Done ✅"])
    C -. "429 / timeout" .-> G["Back off & retry<br/>or fail over to<br/>next provider"] -.-> C
```

- Receive and change chains are scanned **in parallel**, each with its own worker pool
- Unused addresses cost **one** cheap stats request
- History pagination is checked against the provider's own transaction count, so nothing is silently dropped
- `Retry-After` is honoured; each request times out after 15 s so a dead host fails over fast
- Results are cached per descriptor, so reopening shows coins instantly while a refresh runs

</details>

---

## 🔐 Trust model

```mermaid
flowchart LR
    subgraph Never["❌ Satlas never"]
        direction TB
        N1["sees your seed or private keys"]
        N2["signs or broadcasts"]
        N3["runs a server or account"]
    end
    subgraph Does["⚠️ By default"]
        direction TB
        D1["asks a public block explorer<br/>about your derived addresses"]
    end
    subgraph Fix["✅ To remove that"]
        direction TB
        F1["Settings ⚙ → your own<br/>Esplora / mempool server"]
    end
    Does --> Fix
```

The block explorer's operator can see *which addresses you asked about* — the same trade-off every
watch-only wallet with a public backend makes. Point Satlas at your own server and no third party
sees them. Labels and cached scans stay in your browser; **Forget** wipes both.
Full details: [docs/trust-model.md](docs/trust-model.md).

---

## 🗂️ Project layout

```
satlas/
├── crates/
│   ├── satlas-core/        🦀 Pure Rust engine — no network, no WASM, reusable as a library
│   │   └── src/
│   │       ├── descriptor.rs    xpub / zpub / descriptor parsing, address derivation
│   │       ├── wallet.rs        transactions → UTXOs, balance, tx classification
│   │       ├── heuristics/      clustering · reuse · change detection · labels
│   │       ├── simulate.rs      coin selection + linkage analysis
│   │       └── bip329.rs        label import / export
│   └── satlas-wasm/        wasm-bindgen bindings
├── web/
│   └── src/
│       ├── api/            Esplora client + gap-limit scanner
│       ├── engine/         typed facade over the WASM engine
│       ├── state/          zustand stores (wallet · labels · settings · cache)
│       ├── components/     React UI (CoinGraph, Simulator, …)
│       └── demo/           synthetic demo wallet
└── docs/                   trust model, screenshots, banner
```

---

## 🛠️ Development

### Prerequisites

| Tool | Why | Install |
|---|---|---|
| Rust stable + `wasm32-unknown-unknown` | the engine | [rustup.rs](https://rustup.rs) (pinned by `rust-toolchain.toml`) |
| `wasm-pack` | Rust → npm package | `cargo install wasm-pack` |
| `clang` | compiles `secp256k1` for WASM | Windows: `winget install LLVM.LLVM` + add `C:\Program Files\LLVM\bin` to `PATH` |
| Node 22+ and pnpm | the UI | `npm i -g pnpm` |

### Commands

| Command | Where | What |
|---|---|---|
| `cargo test` | repo root | engine tests |
| `pnpm wasm` | `web/` | release build of the engine → `web/src/wasm/pkg` |
| `pnpm wasm:dev` | `web/` | faster, unoptimised engine build |
| `pnpm dev` | `web/` | dev server on http://localhost:5173 |
| `pnpm test` | `web/` | UI + WASM-boundary tests |
| `pnpm typecheck` | `web/` | TypeScript strict check |
| `pnpm build` | `web/` | production build → `web/dist` |

> [!TIP]
> Re-run `pnpm wasm` whenever you change Rust code.

<details>
<summary><b>Live network test against a real mainnet wallet</b></summary>

```sh
SATLAS_NETWORK_TESTS=1 pnpm test
SATLAS_NETWORK_TESTS=1 SATLAS_ESPLORA=https://blockstream.info/api pnpm test
```

Runs import → scan → analyse end to end on the public BIP-84 test-vector wallet.
</details>

<details>
<summary><b>Troubleshooting</b></summary>

| Error | Fix |
|---|---|
| `failed to find tool "clang"` | Install LLVM and put `C:\Program Files\LLVM\bin` on `PATH` |
| `Bulk memory operations require bulk memory` | Already handled by the `wasm-opt` flags in `crates/satlas-wasm/Cargo.toml` |
| pnpm won't run esbuild's install script | `pnpm approve-builds esbuild` |
| `npm.ps1 cannot be loaded` (PowerShell) | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |

</details>

---

## ⚠️ Limitations

> [!NOTE]
> Satlas describes what a **typical chain-analysis observer** would infer. It is not a privacy
> guarantee, and CoinJoin / PayJoin transactions can defeat these heuristics.

- Observer-side change detection covers the common *one payment + change* shape; batched spends aren't analysed
- Fee estimates assume `p2sh` inputs are wrapped segwit
- The *Avoid change* search considers at most 16 coins
- A first scan of a large wallet over a public API can take tens of seconds

## 🗺️ Roadmap

- [x] Descriptor & xpub import, UTXO discovery
- [x] Clustering, reuse and change heuristics with certainty levels
- [x] Pre-spend simulator with six strategies
- [x] BIP-329 export & import
- [x] Relationship map
- [x] Self-hosted endpoint, caching, failover
- [ ] Publish `satlas-core` as a standalone crate
- [ ] Incremental refresh (only re-check addresses with new activity)
- [ ] Change analysis for batched spends
- [ ] Import a PSBT to check the exact transaction your wallet built

---

<div align="center">

**Satlas** — because *"which coin should I spend?"* is really *"what will spending this reveal?"*

MIT License · built with 🦀 Rust, ⚛️ React and ₿ Bitcoin

</div>
