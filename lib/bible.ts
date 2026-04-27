/**
 * Bible loading and verse retrieval.
 *
 * Two retrieval modes (auto-detected at boot):
 *   - Vector search via Voyage embeddings (if data/biblia.embeddings.json exists)
 *   - BM25 keyword search (fallback, always available)
 *
 * Loads everything into memory once at module load (Edge runtime compatible
 * via Node.js `fs` at build time — see app/api/chat/route.ts for runtime).
 */

import fs from "node:fs";
import path from "node:path";

export type Verse = {
  libro: string;
  abbr: string;
  capitulo: number;
  versiculo: number;
  texto: string;
};

export type Embedded = {
  ref: string;
  v: number[];
};

export type Retrieved = {
  verse: Verse;
  score: number;
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const VERSES_PATH = path.join(DATA_DIR, "biblia.json");
const EMBEDDINGS_JSON_PATH = path.join(DATA_DIR, "biblia.embeddings.json");
const EMBEDDINGS_BIN_PATH = path.join(DATA_DIR, "biblia.embeddings.bin");
const EMBEDDINGS_META_PATH = path.join(DATA_DIR, "biblia.embeddings.meta.json");

type EmbeddingStore = {
  model: string;
  dim: number;
  // For each i: ref[i] and a function to compute cosine similarity vs a query vec
  refs: string[];
  // Internally we keep either Float32Array (per vec) or Int8Array (per vec) +
  // scale[i]. The cosine sim function below abstracts the difference.
  vectors: Float32Array[] | null;
  qVectors: Int8Array[] | null;
  qScales: Float32Array | null;
};

let cachedVerses: Verse[] | null = null;
let cachedByRef: Map<string, Verse> | null = null;
let cachedEmbeddings: EmbeddingStore | null = null;
let cachedBM25: BM25Index | null = null;

export function loadVerses(): Verse[] {
  if (cachedVerses) return cachedVerses;
  const raw = fs.readFileSync(VERSES_PATH, "utf-8");
  cachedVerses = JSON.parse(raw) as Verse[];
  cachedByRef = new Map(
    cachedVerses.map((v) => [`${v.abbr} ${v.capitulo}:${v.versiculo}`, v]),
  );
  return cachedVerses;
}

export function findByRef(ref: string): Verse | undefined {
  if (!cachedByRef) loadVerses();
  return cachedByRef!.get(ref);
}

export function loadEmbeddings(): EmbeddingStore | null {
  if (cachedEmbeddings !== null) return cachedEmbeddings;

  // Prefer the quantized binary format (smaller, fits Vercel size limits).
  if (
    fs.existsSync(EMBEDDINGS_BIN_PATH) &&
    fs.existsSync(EMBEDDINGS_META_PATH)
  ) {
    const meta = JSON.parse(
      fs.readFileSync(EMBEDDINGS_META_PATH, "utf-8"),
    ) as { model: string; dim: number; count: number; refs: string[]; scales: number[] };
    const buf = fs.readFileSync(EMBEDDINGS_BIN_PATH);
    const qVectors: Int8Array[] = new Array(meta.count);
    for (let i = 0; i < meta.count; i++) {
      qVectors[i] = new Int8Array(
        buf.buffer,
        buf.byteOffset + i * meta.dim,
        meta.dim,
      );
    }
    cachedEmbeddings = {
      model: meta.model,
      dim: meta.dim,
      refs: meta.refs,
      vectors: null,
      qVectors,
      qScales: Float32Array.from(meta.scales),
    };
    return cachedEmbeddings;
  }

  // Fallback: full float32 JSON (used during local development).
  if (fs.existsSync(EMBEDDINGS_JSON_PATH)) {
    const raw = JSON.parse(
      fs.readFileSync(EMBEDDINGS_JSON_PATH, "utf-8"),
    ) as { model: string; dim: number; verses: Embedded[] };
    const refs = raw.verses.map((v) => v.ref);
    const vectors = raw.verses.map((v) => Float32Array.from(v.v));
    cachedEmbeddings = {
      model: raw.model,
      dim: raw.dim,
      refs,
      vectors,
      qVectors: null,
      qScales: null,
    };
    return cachedEmbeddings;
  }

  cachedEmbeddings = null;
  return null;
}

// -----------------------------------------------------------------------------
// BM25 keyword search (fallback, always available)
// -----------------------------------------------------------------------------

const STOPWORDS_ES = new Set([
  "a", "al", "ante", "bajo", "con", "contra", "de", "del", "desde", "durante",
  "en", "entre", "hacia", "hasta", "mediante", "para", "por", "según", "sin",
  "sobre", "tras", "el", "la", "los", "las", "un", "una", "unos", "unas", "y",
  "o", "u", "ni", "que", "se", "su", "sus", "lo", "le", "les", "me", "te", "nos",
  "es", "son", "ser", "soy", "eres", "fue", "fueron", "ha", "han", "he", "hemos",
  "hay", "está", "están", "estoy", "estás", "como", "cómo", "qué", "quién",
  "cuándo", "donde", "dónde", "este", "esta", "estos", "estas", "ese", "esa",
  "esos", "esas", "mi", "mí", "tu", "tú", "él", "ella", "ellos", "ellas",
  "nosotros", "vosotros", "yo", "muy", "más", "menos", "no", "sí", "ya", "pero",
  "porque", "pues", "si", "también",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents for matching
    .replace(/[«»¿?¡!.,;:"'""()\[\]{}|—–\-]/g, " ");
}

function tokenize(s: string): string[] {
  return normalize(s)
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS_ES.has(t));
}

interface BM25Index {
  N: number;
  avgDL: number;
  df: Map<string, number>;
  docs: { tf: Map<string, number>; len: number }[];
}

function buildBM25(verses: Verse[]): BM25Index {
  const docs = verses.map((v) => {
    const tokens = tokenize(v.texto);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { tf, len: tokens.length };
  });
  const df = new Map<string, number>();
  for (const d of docs) {
    for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const avgDL = docs.reduce((s, d) => s + d.len, 0) / Math.max(1, docs.length);
  return { N: docs.length, avgDL, df, docs };
}

function bm25Score(
  index: BM25Index,
  queryTokens: string[],
  docIdx: number,
): number {
  const k1 = 1.5;
  const b = 0.75;
  const d = index.docs[docIdx];
  let score = 0;
  for (const term of queryTokens) {
    const dfT = index.df.get(term);
    if (!dfT) continue;
    const idf = Math.log(1 + (index.N - dfT + 0.5) / (dfT + 0.5));
    const tf = d.tf.get(term) ?? 0;
    const num = tf * (k1 + 1);
    const den = tf + k1 * (1 - b + b * (d.len / index.avgDL));
    score += idf * (num / den);
  }
  return score;
}

export function searchBM25(query: string, k: number): Retrieved[] {
  const verses = loadVerses();
  if (!cachedBM25) cachedBM25 = buildBM25(verses);
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const scores: { idx: number; score: number }[] = [];
  for (let i = 0; i < cachedBM25.N; i++) {
    const s = bm25Score(cachedBM25, tokens, i);
    if (s > 0) scores.push({ idx: i, score: s });
  }
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, k).map(({ idx, score }) => ({
    verse: verses[idx],
    score,
  }));
}

// -----------------------------------------------------------------------------
// Vector search (if embeddings are available)
// -----------------------------------------------------------------------------

function cosineSimF32(a: Float32Array, b: Float32Array): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/**
 * Cosine similarity between a float32 query and an int8-quantized stored
 * vector with an associated scale. Decoding inline avoids materialising the
 * full float32 vector for every comparison.
 */
function cosineSimQ(q: Float32Array, qb: Int8Array, scaleB: number): number {
  let dot = 0,
    nq = 0,
    nb = 0;
  // factor = scaleB / 127 — scalar applied per int8 lane after dot
  for (let i = 0; i < q.length; i++) {
    const a = q[i];
    const bRaw = qb[i];
    dot += a * bRaw;
    nq += a * a;
    nb += bRaw * bRaw;
  }
  // The scaleB factors cancel out in the cosine ratio when applied uniformly,
  // but include them for numerical sanity:
  const dotScaled = dot * (scaleB / 127);
  const normBScaled = Math.sqrt(nb) * (scaleB / 127);
  return dotScaled / (Math.sqrt(nq) * normBScaled || 1);
}

export async function embedQuery(text: string): Promise<number[] | null> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) return null;
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: [text],
      model: process.env.VOYAGE_MODEL || "voyage-3-large",
      input_type: "query",
    }),
  });
  if (!res.ok) {
    console.error("Voyage embed query failed:", res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data[0]?.embedding ?? null;
}

export async function searchVector(
  query: string,
  k: number,
): Promise<Retrieved[] | null> {
  const emb = loadEmbeddings();
  if (!emb) return null;
  const qvArr = await embedQuery(query);
  if (!qvArr) return null;
  const qv = Float32Array.from(qvArr);
  const verses = loadVerses();
  const byRef = new Map(
    verses.map((v) => [`${v.abbr} ${v.capitulo}:${v.versiculo}`, v]),
  );
  const scored: { score: number; ref: string }[] = new Array(emb.refs.length);

  if (emb.vectors) {
    for (let i = 0; i < emb.vectors.length; i++) {
      scored[i] = {
        score: cosineSimF32(qv, emb.vectors[i]),
        ref: emb.refs[i],
      };
    }
  } else if (emb.qVectors && emb.qScales) {
    for (let i = 0; i < emb.qVectors.length; i++) {
      scored[i] = {
        score: cosineSimQ(qv, emb.qVectors[i], emb.qScales[i]),
        ref: emb.refs[i],
      };
    }
  } else {
    return null;
  }

  scored.sort((a, b) => b.score - a.score);
  return scored
    .slice(0, k)
    .map((s) => ({ verse: byRef.get(s.ref)!, score: s.score }))
    .filter((x) => x.verse);
}

// -----------------------------------------------------------------------------
// Unified search — vector if available, else BM25
// -----------------------------------------------------------------------------

export async function search(query: string, k = 8): Promise<Retrieved[]> {
  const vec = await searchVector(query, k);
  if (vec && vec.length > 0) return vec;
  return searchBM25(query, k);
}
