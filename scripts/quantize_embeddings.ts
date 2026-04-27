/**
 * Quantizes the float32 embeddings to int8 + scale-per-vector and packs into
 * a compact binary format. Reduces file size ~4x with negligible quality loss
 * for cosine similarity.
 *
 * Run after embeddings are generated:
 *   npx tsx scripts/quantize_embeddings.ts
 *
 * Output:
 *   data/biblia.embeddings.bin   — binary, ~36 MB instead of ~150 MB
 *   data/biblia.embeddings.meta.json   — refs and quantization scales
 *
 * Layout of biblia.embeddings.bin:
 *   For each vector i in order:
 *     int8[dim]   — quantized values
 *
 * The meta.json holds the model name, dim, and the per-vector scale factor.
 * To dequantize: vec_f32[d] = int8_value[d] * scale[i] / 127
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const INPUT = path.join(ROOT, "data", "biblia.embeddings.json");
const OUT_BIN = path.join(ROOT, "data", "biblia.embeddings.bin");
const OUT_META = path.join(ROOT, "data", "biblia.embeddings.meta.json");

type Embedded = { ref: string; v: number[] };
type EmbeddingsFile = { model: string; dim: number; verses: Embedded[] };

function quantizeVector(v: number[]): { q: Int8Array; scale: number } {
  let max = 0;
  for (const x of v) {
    const a = Math.abs(x);
    if (a > max) max = a;
  }
  if (max === 0) return { q: new Int8Array(v.length), scale: 0 };
  const scale = max;
  const q = new Int8Array(v.length);
  for (let i = 0; i < v.length; i++) {
    q[i] = Math.max(-127, Math.min(127, Math.round((v[i] / scale) * 127)));
  }
  return { q, scale };
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`No encuentro ${INPUT}. ¿Ya corriste build_embeddings.ts?`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(INPUT, "utf-8")) as EmbeddingsFile;
  console.log(
    `Loaded ${data.verses.length} embeddings (model=${data.model}, dim=${data.dim})`,
  );

  const refs: string[] = [];
  const scales: number[] = [];
  const totalBytes = data.verses.length * data.dim;
  const bin = Buffer.alloc(totalBytes);

  for (let i = 0; i < data.verses.length; i++) {
    const e = data.verses[i];
    const { q, scale } = quantizeVector(e.v);
    bin.set(q, i * data.dim);
    refs.push(e.ref);
    scales.push(scale);
  }

  fs.writeFileSync(OUT_BIN, bin);
  fs.writeFileSync(
    OUT_META,
    JSON.stringify({
      model: data.model,
      dim: data.dim,
      count: data.verses.length,
      refs,
      scales,
    }),
  );

  const inSize = fs.statSync(INPUT).size / 1024 / 1024;
  const outSize =
    (fs.statSync(OUT_BIN).size + fs.statSync(OUT_META).size) / 1024 / 1024;
  console.log(`Input  ${INPUT}: ${inSize.toFixed(1)} MB`);
  console.log(`Output ${OUT_BIN} + meta: ${outSize.toFixed(1)} MB`);
  console.log(`Ratio: ${(inSize / outSize).toFixed(2)}x`);
}

main();
