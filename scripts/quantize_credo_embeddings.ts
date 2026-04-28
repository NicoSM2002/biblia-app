/**
 * Quantizes Credo embeddings to int8 + per-vector scale, packed in binary.
 *
 * Run after build_credo_embeddings.ts:
 *   npx tsx scripts/quantize_credo_embeddings.ts
 *
 * Output:
 *   data/credo.embeddings.bin
 *   data/credo.embeddings.meta.json
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const INPUT = path.join(ROOT, "data", "credo.embeddings.json");
const OUT_BIN = path.join(ROOT, "data", "credo.embeddings.bin");
const OUT_META = path.join(ROOT, "data", "credo.embeddings.meta.json");

type Embedded = { id: number; v: number[] };
type EmbeddingsFile = { model: string; dim: number; items: Embedded[] };

function quantizeVector(v: number[]): { q: Int8Array; scale: number } {
  let max = 0;
  for (const x of v) {
    const a = Math.abs(x);
    if (a > max) max = a;
  }
  if (max === 0) return { q: new Int8Array(v.length), scale: 0 };
  const q = new Int8Array(v.length);
  for (let i = 0; i < v.length; i++) {
    q[i] = Math.max(-127, Math.min(127, Math.round((v[i] / max) * 127)));
  }
  return { q, scale: max };
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`No encuentro ${INPUT}.`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(INPUT, "utf-8")) as EmbeddingsFile;
  console.log(
    `Loaded ${data.items.length} embeddings (model=${data.model}, dim=${data.dim})`,
  );

  const ids: number[] = [];
  const scales: number[] = [];
  const totalBytes = data.items.length * data.dim;
  const bin = Buffer.alloc(totalBytes);

  for (let i = 0; i < data.items.length; i++) {
    const e = data.items[i];
    const { q, scale } = quantizeVector(e.v);
    bin.set(q, i * data.dim);
    ids.push(e.id);
    scales.push(scale);
  }

  fs.writeFileSync(OUT_BIN, bin);
  fs.writeFileSync(
    OUT_META,
    JSON.stringify({
      model: data.model,
      dim: data.dim,
      count: data.items.length,
      ids,
      scales,
    }),
  );

  const inSize = fs.statSync(INPUT).size / 1024 / 1024;
  const outSize =
    (fs.statSync(OUT_BIN).size + fs.statSync(OUT_META).size) / 1024 / 1024;
  console.log(`Input:  ${inSize.toFixed(2)} MB`);
  console.log(`Output: ${outSize.toFixed(2)} MB (${(inSize / outSize).toFixed(2)}x)`);
}

main();
