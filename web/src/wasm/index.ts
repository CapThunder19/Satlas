// Single entry point for the Rust engine. Everything else imports from here so
// the init() call happens exactly once.
import init, * as wasm from "./pkg/satlas_wasm";

let ready: Promise<typeof wasm> | null = null;

async function initEngine(): Promise<typeof wasm> {
  if (typeof document === "undefined") {
    // Node (tests): fetch() cannot load a file URL, so hand init the bytes.
    const fsName = "node:fs/promises";
    const { readFile } = (await import(/* @vite-ignore */ fsName)) as {
      readFile: (path: URL) => Promise<Uint8Array>;
    };
    const bytes = await readFile(new URL("./pkg/satlas_wasm_bg.wasm", import.meta.url));
    await init({ module_or_path: bytes });
  } else {
    await init();
  }
  return wasm;
}

export function loadEngine(): Promise<typeof wasm> {
  if (!ready) {
    ready = initEngine().catch((e) => {
      ready = null; // allow a retry after a transient failure
      throw e;
    });
  }
  return ready;
}

export type Engine = typeof wasm;
