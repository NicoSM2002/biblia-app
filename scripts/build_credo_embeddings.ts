/**
 * Generates Voyage embeddings for the Credo compendium (data/credo.json).
 *
 * Run:
 *   npx tsx scripts/build_credo_embeddings.ts
 *
 * Output:
 *   data/credo.embeddings.json  — { model, dim, items: [{ id, v: [...] }] }
 *
 * Uses .env.local automatically.
 */

import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const envPath = path.resolve(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const [, k, vRaw] = m;
    if (process.env[k]) continue;
    let v = vRaw;
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[k] = v;
  }
}
loadEnvLocal();

type CredoItem = {
  id: number;
  numero: number;
  pregunta: string;
  respuesta: string;
};

type Embedded = { id: number; v: number[] };

const ROOT = path.resolve(__dirname, "..");
const INPUT = path.join(ROOT, "data", "credo.json");
const OUTPUT = path.join(ROOT, "data", "credo.embeddings.json");

const MODEL = process.env.VOYAGE_MODEL || "voyage-4";
const BATCH = 128;
const API_URL = "https://api.voyageai.com/v1/embeddings";

type VoyageError = Error & { status?: number };

async function embedBatchOnce(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY env var is not set.");
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input: texts, model: MODEL, input_type: "document" }),
  });
  if (!res.ok) {
    const body = await res.text();
    const err: VoyageError = new Error(`Voyage API error ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data.map((d) => d.embedding);
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  let attempts = 0;
  while (true) {
    try {
      return await embedBatchOnce(texts);
    } catch (err) {
      const e = err as VoyageError;
      if (e.status === 429) {
        await new Promise((r) => setTimeout(r, 30_000));
        continue;
      }
      attempts++;
      if (attempts >= 5) throw e;
      await new Promise((r) => setTimeout(r, 2 ** attempts * 1000));
    }
  }
}

async function main() {
  const items = JSON.parse(fs.readFileSync(INPUT, "utf-8")) as CredoItem[];
  console.log(`Loaded ${items.length} Credo Q&A from ${INPUT}`);

  let resumeFrom = 0;
  let existing: Embedded[] = [];
  if (fs.existsSync(OUTPUT)) {
    try {
      const prev = JSON.parse(fs.readFileSync(OUTPUT, "utf-8"));
      if (prev.model === MODEL && Array.isArray(prev.items)) {
        existing = prev.items;
        resumeFrom = existing.length;
        console.log(`Resuming from ${resumeFrom}`);
      }
    } catch {}
  }

  const startTime = Date.now();
  const out: Embedded[] = existing;

  for (let i = resumeFrom; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    // Embed the question + answer combined so retrieval matches either.
    const texts = batch.map((it) => `${it.pregunta}\n\n${it.respuesta}`);
    const embeddings = await embedBatch(texts);
    for (let j = 0; j < batch.length; j++) {
      out.push({ id: batch[j].id, v: embeddings[j] });
    }
    if ((i / BATCH) % 4 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (out.length - resumeFrom) / elapsed;
      const remaining = (items.length - out.length) / rate;
      console.log(
        `  ${out.length}/${items.length}  (${Math.round(rate)}/s, ETA ${Math.round(remaining)}s)`,
      );
      fs.writeFileSync(
        OUTPUT,
        JSON.stringify({ model: MODEL, dim: out[0]?.v.length, items: out }),
      );
    }
  }

  fs.writeFileSync(
    OUTPUT,
    JSON.stringify({ model: MODEL, dim: out[0].v.length, items: out }),
  );
  console.log(
    `Wrote ${OUTPUT} — ${out.length} embeddings (${(fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(2)} MB)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
