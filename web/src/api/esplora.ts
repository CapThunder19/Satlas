import { z } from "zod";
import type { Network } from "../engine/types";

// Only the fields satlas-core reads are validated; extra fields pass through.
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

export const DEFAULT_ENDPOINTS: Record<Network, string> = {
  bitcoin: "https://mempool.space/api",
  signet: "https://mempool.space/signet/api",
  testnet: "https://mempool.space/testnet4/api",
  regtest: "http://localhost:3002",
};

/** Esplora returns confirmed history in pages of this size. */
const PAGE_SIZE = 25;

export class EsploraError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "EsploraError";
  }
}

export class EsploraClient {
  constructor(
    readonly baseUrl: string,
    private readonly fetchFn: typeof fetch = (...a) => fetch(...a),
  ) {}

  static forNetwork(network: Network): EsploraClient {
    return new EsploraClient(DEFAULT_ENDPOINTS[network]);
  }

  private async get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const url = `${this.baseUrl.replace(/\/$/, "")}${path}`;
    let res: Response;
    try {
      res = await this.fetchFn(url, { headers: { accept: "application/json" } });
    } catch (e) {
      throw new EsploraError(`network error reaching ${this.baseUrl}: ${(e as Error).message}`);
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

  /**
   * Full transaction history for an address: mempool txs plus every page of
   * confirmed history.
   */
  async addressTxs(address: string): Promise<EsploraTx[]> {
    const first = await this.get(`/address/${address}/txs`, z.array(esploraTxSchema));
    const all = [...first];
    let confirmed = first.filter((t) => t.status.confirmed);
    // The first call returns at most PAGE_SIZE confirmed txs; page the rest.
    while (confirmed.length === PAGE_SIZE) {
      const last = confirmed[confirmed.length - 1]!.txid;
      confirmed = await this.get(`/address/${address}/txs/chain/${last}`, z.array(esploraTxSchema));
      all.push(...confirmed);
    }
    return all;
  }

  async tipHeight(): Promise<number> {
    return this.get("/blocks/tip/height", z.number().int());
  }
}
