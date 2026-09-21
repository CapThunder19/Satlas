import { readFile } from "node:fs/promises";
import { beforeAll, expect, it } from "vitest";
import init, { analyzeWallet } from "../wasm/pkg/satlas_wasm";
import type { Report } from "../engine/types";
import { DEMO_LABELS, DEMO_SCAN } from "./wallet";

beforeAll(async () => {
  const bytes = await readFile(new URL("../wasm/pkg/satlas_wasm_bg.wasm", import.meta.url));
  await init({ module_or_path: bytes });
});

it("demo wallet analyses cleanly and exercises every finding kind", () => {
  const { snapshot, analysis } = analyzeWallet(DEMO_SCAN.txs, DEMO_SCAN.addresses, DEMO_LABELS) as Report;
  console.log(
    `balance ${snapshot.balance} sat, ${snapshot.utxos.length} utxos, ${analysis.clusters.length} clusters\n` +
      analysis.findings.map((f) => `  [${f.severity}/${f.certainty}] ${f.title}`).join("\n"),
  );
  expect(snapshot.utxos).toHaveLength(4);
  const kinds = new Set(analysis.findings.map((f) => f.kind));
  expect(kinds).toContain("address-reuse");
  expect(kinds).toContain("change-revealed");
  expect(kinds).toContain("cluster-merge");
  const labelled = analysis.coins.flatMap((c) => c.labels.map((l) => l.text));
  expect(labelled).toEqual(expect.arrayContaining(["Salary", "Donation"]));
});
