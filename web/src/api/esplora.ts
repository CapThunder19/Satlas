import { z } from "zod";
import type { Network } from "../engine/types";

// Only the fields satlas-core reads are validated; unknown keys are stripped.
const voutSchema = z.object({
  scriptpubkey: z.string(),
  scriptpubkey_address: z.string().optional(),
  scriptpubkey_type: z.string().optional(),
  value: z.number().int().nonnegative(),
});

const vinSchema = z.object({
  txid: z.string().length(64),
  vout: z.number().int().nonnegative(),
  prevout: voutSchema.nullish(),
  is_coinbase: z.boolean().default(false),
  sequence: z.number().int().default(0xffffffff),
});

const statusSchema = z.object({
  confirmed: z.boolean(),
  block_height: z.number().int().optional(),
  block_time: z.number().int().optional(),
});

export const esploraTxSchema = z.object({
  txid: z.string().length(64),
  version: z.number().int().default(2),
  locktime: z.number().int().default(0),
  vin: z.array(vinSchema),
  vout: z.array(voutSchema),
  size: z.number().int().default(0),
  weight: z.number().int().default(0),
  fee: z.number().int().default(0),
  status: statusSchema,
});

export type EsploraTx = z.infer<typeof esploraTxSchema>;

const addressStatsSchema = z.object({
  chain_stats: z.object({ tx_count: z.number().int() }),
  mempool_stats: z.object({ tx_count: z.number().int() }),
});

export const DEFAULT_ENDPOINTS: Record<Network, string> = {
  bitcoin: "https://mempool.space/api",
  signet: "https://mempool.space/signet/api",
  testnet: "https://mempool.space/testnet4/api",
  regtest: "http://localhost:3002",
};

/** Public providers per network, in preference order. Used for presets and failover. */
export const KNOWN_ENDPOINTS: Record<Network, { name: string; url: string }[]> = {
  bitcoin: [
    { name: "mempool.space", url: "https://mempool.space/api" },
    { name: "blockstream.info", url: "https://blockstream.info/api" },
  ],
  signet: [
    { name: "mempool.space", url: "https://mempool.space/signet/api" },
    { name: "blockstream.info", url: "https://blockstream.info/signet/api" },
  ],
  testnet: [{ name: "mempool.space (testnet4)", url: "https://mempool.space/testnet4/api" }],
  regtest: [{ name: "local", url: "http://localhost:3002" }],
};

export class EsploraError extends Error {
  /** Server-requested backoff, from a Retry-After header. */
  retryAfterMs = 0;
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "EsploraError";
  }
}

export interface EsploraOptions {
  fetchFn?: typeof fetch;
  /** Attempts per request including the first. */
  retries?: number;
  /** Max simultaneous requests to this endpoint. */
  concurrency?: number;
  /** Per-request timeout in ms. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(signal.reason ?? new DOMException("aborted", "AbortError"));
      },
      { once: true },
    );
  });

export class EsploraClient {
  private readonly fetchFn: typeof fetch;
  private readonly retries: number;
  private readonly concurrency: number;
  private readonly timeoutMs: number;
  private readonly signal?: AbortSignal;
  private active = 0;
  private queue: (() => void)[] = [];
  /** Requests made by this client; useful for tests and diagnostics. */
  requests = 0;

  constructor(
    readonly baseUrl: string,
    opts: EsploraOptions = {},
  ) {
    this.fetchFn = opts.fetchFn ?? ((...a) => fetch(...a));
    this.retries = opts.retries ?? 4;
    this.concurrency = opts.concurrency ?? 4;
    this.timeoutMs = opts.timeoutMs ?? 15_000;
    this.signal = opts.signal;
  }

  static forNetwork(network: Network, opts?: EsploraOptions): EsploraClient {
    return new EsploraClient(DEFAULT_ENDPOINTS[network], opts);
  }

  /** Simple semaphore so a big wallet does not open dozens of sockets at once. */
  private async withSlot<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.concurrency) {
      await new Promise<void>((r) => this.queue.push(r));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.queue.shift()?.();
    }
  }

  private async get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const url = `${this.baseUrl.replace(/\/$/, "")}${path}`;
    let lastErr: EsploraError | null = null;

    for (let attempt = 0; attempt < this.retries; attempt++) {
      this.signal?.throwIfAborted();
      if (attempt > 0) {
        // 500ms, 1s, 2s... plus jitter; or what the server asked for.
        const base = 500 * 2 ** (attempt - 1);
        await sleep(Math.min(8000, base + Math.random() * 250) + (lastErr?.retryAfterMs ?? 0), this.signal);
      }

      let res: Response;
      try {
        this.requests++;
        res = await this.withSlot(() => {
          // Give up on a single request after a while so a dead host fails fast
          // and failover can kick in; the outer signal still cancels everything.
          const timeout = AbortSignal.timeout(this.timeoutMs);
          const signal = this.signal ? AbortSignal.any([this.signal, timeout]) : timeout;
          return this.fetchFn(url, { headers: { accept: "application/json" }, signal });
        });
      } catch (e) {
        if ((e as Error).name === "AbortError" && this.signal?.aborted) throw e;
        lastErr = new EsploraError(`could not reach ${this.baseUrl}: ${(e as Error).message}`);
        continue;
      }

      if (res.status === 429 || res.status >= 500) {
        const ra = Number(res.headers.get("retry-after"));
        lastErr = new EsploraError(
          res.status === 429 ? `rate limited by ${new URL(url).host}` : `${res.status} from ${new URL(url).host}`,
          res.status,
        );
        lastErr.retryAfterMs = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 0;
        continue;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new EsploraError(`${res.status} from ${path}: ${body.slice(0, 200)}`, res.status);
      }

      const json: unknown = await res.json();
      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        throw new EsploraError(`unexpected response shape from ${path}: ${parsed.error.issues[0]?.message}`);
      }
      return parsed.data;
    }
    throw lastErr ?? new EsploraError("request failed");
  }

  /** Number of transactions involving an address (confirmed + mempool). */
  async addressTxCount(address: string): Promise<number> {
    const s = await this.get(`/address/${address}`, addressStatsSchema);
    return s.chain_stats.tx_count + s.mempool_stats.tx_count;
  }

  /**
   * Full transaction history for an address.
   *
   * Providers differ in page sizes and the first page mixes mempool and
   * confirmed txs, so instead of guessing from page length we first ask how
   * many transactions exist and page until we have them all (or stop making
   * progress). Unused addresses cost a single cheap stats request.
   */
  async addressTxs(address: string): Promise<EsploraTx[]> {
    const total = await this.addressTxCount(address);
    if (total === 0) return [];

    const byId = new Map<string, EsploraTx>();
    let page = await this.get(`/address/${address}/txs`, z.array(esploraTxSchema));
    for (const t of page) byId.set(t.txid, t);

    // Hard cap so a misbehaving server cannot loop us forever.
    for (let i = 0; byId.size < total && i < 10_000; i++) {
      const confirmed = page.filter((t) => t.status.confirmed);
      if (confirmed.length === 0) break;
      const last = confirmed[confirmed.length - 1]!.txid;
      page = await this.get(`/address/${address}/txs/chain/${last}`, z.array(esploraTxSchema));
      const before = byId.size;
      for (const t of page) byId.set(t.txid, t);
      if (byId.size === before) break; // no progress: end of history or stale count
    }
    return [...byId.values()];
  }

  async tipHeight(): Promise<number> {
    return this.get("/blocks/tip/height", z.number().int());
  }

  /** Recommended fee rates in sat/vB, when the endpoint is mempool.space-compatible. */
  async recommendedFees(): Promise<{ fast: number; medium: number; slow: number } | null> {
    try {
      const f = await this.get(
        "/v1/fees/recommended",
        z.object({ fastestFee: z.number(), halfHourFee: z.number(), hourFee: z.number() }),
      );
      return { fast: f.fastestFee, medium: f.halfHourFee, slow: f.hourFee };
    } catch {
      return null;
    }
  }
}
