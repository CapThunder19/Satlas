# Satlas

**Know what your Bitcoin reveals before you spend it.**

Client-side Bitcoin privacy analyzer. Import a watch-only descriptor/xpub, see your
coins individually, and simulate a spend to learn which financial histories it would
link together — before you sign anything in your real wallet.

- No private keys, no signing, no broadcasting
- No backend: all analysis runs in your browser via Rust compiled to WebAssembly
- Blockchain data comes from an Esplora-compatible API (mempool.space by default)

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

Run engine tests with `cargo test` from the repo root.

## Trust model

Satlas has no server. However, the default Esplora endpoint (mempool.space) sees the
addresses derived from your descriptor. Point Satlas at your own Esplora instance to
avoid that. See [docs/trust-model.md](docs/trust-model.md).

## License

MIT
