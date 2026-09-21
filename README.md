# Satlas

**Know what your Bitcoin reveals before you spend it.**

Client-side Bitcoin privacy analyzer. Import a watch-only descriptor/xpub, see your
coins individually, and simulate a spend to learn which financial histories it would
link together — before you sign anything in your real wallet.

- No private keys, no signing, no broadcasting
- No backend: all analysis runs in your browser via Rust compiled to WebAssembly
- Blockchain data comes from an Esplora-compatible API (mempool.space by default)

## What it does

- **Coins, not a balance.** Import a public descriptor or xpub/zpub/vpub; Satlas derives
  addresses, scans an Esplora API with a gap limit, and lists every unspent coin.
- **Explainable heuristics.** Common-input-ownership clustering, address reuse, change
  detection (both what *you* know from the descriptor and what an *observer* could infer).
  Every conclusion is tagged **Known / Inferred / Unknown**.
- **Labels.** Click a coin to label it (Salary, Exchange, Donation...). Change outputs
  inherit an unambiguous input label. Export and import as **BIP-329** JSONL.
- **Pre-spend simulator.** Enter an amount and a coin-selection strategy (largest-first,
  oldest-first, smallest-first, exact-match, privacy-aware, or pick coins manually). Satlas
  shows which coins would be spent, the fee and change, and explains in plain English what
  new links the transaction would create: label mixing, cluster merges, reused-address
  inputs, identifiable change. All strategies are compared side by side.
- **Demo wallet.** A built-in synthetic history for trying the tool without a wallet.
- **Beginner-first UI.** Plain-language explanations, a glossary, per-wallet “where is my xpub” help,
  Fact / Likely / Unclear badges on every conclusion, and “what you can do” advice for every warning.
- **Self-hosted backend.** Point Satlas at your own Esplora/mempool instance in Settings.

## Layout

```
crates/satlas-core   pure Rust privacy engine (no network, no wasm)
crates/satlas-wasm   wasm-bindgen wrapper around satlas-core
web/                 Vite + React + TypeScript UI
```

## Development

Prerequisites: Rust stable (with `wasm32-unknown-unknown`), `wasm-pack`, `clang`
(needed to compile `secp256k1` for wasm), Node 22+, pnpm.

```sh
cd web
pnpm install
pnpm wasm        # build the Rust engine into web/src/wasm/pkg
pnpm dev         # http://localhost:5173
```

Run engine tests with `cargo test` from the repo root and UI/boundary tests with
`pnpm test` in `web/` (`SATLAS_NETWORK_TESTS=1` also hits mempool.space).

## Trust model

Satlas has no server. However, the default Esplora endpoint (mempool.space) sees the
addresses derived from your descriptor. Point Satlas at your own Esplora instance to
avoid that. See [docs/trust-model.md](docs/trust-model.md).

## License

MIT
