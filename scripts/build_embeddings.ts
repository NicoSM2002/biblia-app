/**
 * Generates embeddings for every verse in data/biblia.json using Voyage AI.
 *
 * Run:
 *   VOYAGE_API_KEY=... npx tsx scripts/build_embeddings.ts
 *
 * Output:
 *   data/biblia.embeddings.json
 *     {
 *       "model": "voyage-3-large",
 *       "dim": 1024,
 *       "verses": [
 *         { "ref": "Gén 1:1", "v": [...1024 floats...] },
 *         ...
 *       ]
 *     }
 */

import fs from "node:fs";
import path from "node:path";

// Lightweight .env.local loader — avoids adding the dotenv dependency.
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

type Verse = {
  libro: string;
  abbr: string;
  capitulo: number;
  versiculo: number;
  texto: string;
};

type Embedded = {
  ref: string;
  v: number[];
};

const ROOT = path.resolve(__dirname, "..");
const INPUT = path.join(ROOT, "data", "biblia.json");
const OUTPUT = path.join(ROOT, "data", "biblia.embeddings.json");

// Voyage 3-large: best quality, 1024 dims. voyage-3.5 is also a solid option.
const MODEL = process.env.VOYAGE_MODEL || "voyage-3-large";
const BATCH = 128; // Voyage allows up to 1000 texts per request, but batches of 128 keep payloads light.
const API_URL = "https://api.voyageai.com/v1/embeddings";

type VoyageError = Error & { status?: number };

async function embedBatchOnce(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("VOYAGE_API_KEY env var is not set.");
  }
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: texts,
      model: MODEL,
      input_type: "document",
    }),
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
  // Endless patience on 429 (rate-limit), capped retries on other errors.
  let nonRateLimitAttempts = 0;
  while (true) {
    try {
      return await embedBatchOnce(texts);
    } catch (err) {
      const e = err as VoyageError;
      if (e.status === 429) {
        const wait = 30_000;
        console.warn(
          `[rate-limit] 429 from Voyage. Waiting ${wait / 1000}s then retrying.`,
        );
        await new Promise((r) => setTimeout(r, wait));
        continue; // do NOT count toward retry budget
      }
      nonRateLimitAttempts++;
      if (nonRateLimitAttempts >= 5) throw e;
      const wait = 2 ** nonRateLimitAttempts * 1000;
      console.warn(
        `[transient] ${e.message}. Retry #${nonRateLimitAttempts} in ${wait}ms.`,
      );
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

async function main() {
  const verses = JSON.parse(fs.readFileSync(INPUT, "utf-8")) as Verse[];
  console.log(`Loaded ${verses.length} verses from ${INPUT}`);

  // If output exists, resume from where we left off
  let resumeFrom = 0;
  let existing: Embedded[] = [];
  if (fs.existsSync(OUTPUT)) {
    try {
      const prev = JSON.parse(fs.readFileSync(OUTPUT, "utf-8"));
      if (prev.model === MODEL && Array.isArray(prev.verses)) {
        existing = prev.verses;
        resumeFrom = existing.length;
        console.log(`Resuming from index ${resumeFrom}`);
      }
    } catch {
      // ignore
    }
  }

  const startTime = Date.now();
  const out: Embedded[] = existing;

  for (let i = resumeFrom; i < verses.length; i += BATCH) {
    const batch = verses.slice(i, i + BATCH);
    // Include reference in the input so the embedding captures locality.
    const texts = batch.map(
      (v) => `${v.abbr} ${v.capitulo}:${v.versiculo} — ${v.texto}`,
    );
    let embeddings: number[][];
    let attempts = 0;
    while (true) {
      try {
        embeddings = await embedBatch(texts);
        break;
      } catch (err) {
        attempts++;
        if (attempts >= 5) throw err;
        const wait = 2 ** attempts * 1000;
        console.warn(
          `Batch starting at ${i} failed (attempt ${attempts}). Retry in ${wait}ms. Error: ${(err as Error).message}`,
        );
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    for (let j = 0; j < batch.length; j++) {
      out.push({
        ref: `${batch[j].abbr} ${batch[j].capitulo}:${batch[j].versiculo}`,
        v: embeddings[j],
      });
    }
    if ((i / BATCH) % 10 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (out.length - resumeFrom) / elapsed;
      const remaining = (verses.length - out.length) / rate;
      console.log(
        `  ${out.length}/${verses.length}  (${Math.round(rate)} v/s, ETA ${Math.round(remaining)}s)`,
      );
      // Periodic checkpoint write
      fs.writeFileSync(
        OUTPUT,
        JSON.stringify({ model: MODEL, dim: out[0]?.v.length, verses: out }),
      );
    }
  }

  fs.writeFileSync(
    OUTPUT,
    JSON.stringify({ model: MODEL, dim: out[0].v.length, verses: out }),
  );
  console.log(
    `\nWrote ${OUTPUT} — ${out.length} embeddings (${(fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(1)} MB)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
