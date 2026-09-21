// Single entry point for the Rust engine. Everything else imports from here so
// the init() call happens exactly once.
import init, * as wasm from "./pkg/satlas_wasm";

let ready: Promise<typeof wasm> | null = null;

export function loadEngine(): Promise<typeof wasm> {
  if (!ready) {
    ready = init().then(() => wasm);
  }
  return ready;
}

export type Engine = typeof wasm;
