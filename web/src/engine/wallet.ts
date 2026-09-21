import { loadEngine } from "../wasm";
import type { DerivedAddress, Report, ScriptType, UserLabels, WalletInfo } from "./types";
import type { EsploraTx } from "../api/esplora";
import type { Wallet as WasmWallet } from "../wasm/pkg/satlas_wasm";

/** Typed facade over the wasm `Wallet` class. */
export class Wallet {
  private constructor(private readonly inner: WasmWallet) {}

  static async parse(input: string, scriptType: ScriptType = "native-segwit"): Promise<Wallet> {
    const engine = await loadEngine();
    // The constructor throws a plain string on invalid input; normalise to Error.
    try {
      return new Wallet(new engine.Wallet(input, scriptType));
    } catch (e) {
      throw new Error(typeof e === "string" ? e : String(e));
    }
  }

  info(): WalletInfo {
    return this.inner.info() as WalletInfo;
  }

  get network(): Network {
    return this.inner.network as Network;
  }

  get hasInternal(): boolean {
    return this.inner.hasInternal;
  }

  addresses(chain: 0 | 1, start: number, count: number): DerivedAddress[] {
    return this.inner.addresses(chain, start, count) as DerivedAddress[];
  }

  free() {
    this.inner.free();
  }
}

type Network = WalletInfo["network"];

/** Build the coin snapshot and run every privacy heuristic in satlas-core. */
export async function analyzeWallet(
  txs: EsploraTx[],
  addresses: DerivedAddress[],
  labels: UserLabels,
): Promise<Report> {
  const engine = await loadEngine();
  try {
    return engine.analyzeWallet(txs, addresses, labels) as Report;
  } catch (e) {
    throw new Error(typeof e === "string" ? e : String(e));
  }
}
