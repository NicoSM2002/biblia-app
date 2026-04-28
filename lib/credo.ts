/**
 * Credo: Compendio de la Fe Católica — supplementary catechetical retrieval.
 *
 * The Credo is used to enrich pastoral responses with relevant Catholic
 * doctrine when applicable. The Bible verse remains the only explicitly
 * cited source; Credo content is incorporated naturally into the response
 * without attribution (per the user's product decision).
 *
 * Loaded as quantized int8 binary (~1.8 MB) like the Bible embeddings.
 */

import fs from "node:fs";
import path from "node:path";
import { embedQuery } from "./bible";

export type CredoQA = {
  id: number;
  numero: number;
  pregunta: string;
  respuesta: string;
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const CREDO_PATH = path.join(DATA_DIR, "credo.json");
const CREDO_BIN_PATH = path.join(DATA_DIR, "credo.embeddings.bin");
const CREDO_META_PATH = path.join(DATA_DIR, "credo.embeddings.meta.json");

let cachedCredo: CredoQA[] | null = null;
let cachedCredoById: Map<number, CredoQA> | null = null;
let cachedEmbeddings: {
  model: string;
  dim: number;
  ids: number[];
  qVectors: Int8Array[];
  qScales: Float32Array;
} | null = null;

function loadCredo(): CredoQA[] {
  if (cachedCredo) return cachedCredo;
  if (!fs.existsSync(CREDO_PATH)) {
    cachedCredo = [];
    cachedCredoById = new Map();
    return cachedCredo;
  }
  cachedCredo = JSON.parse(fs.readFileSync(CREDO_PATH, "utf-8")) as CredoQA[];
  cachedCredoById = new Map(cachedCredo.map((q) => [q.id, q]));
  return cachedCredo;
}

function loadCredoEmbeddings() {
  if (cachedEmbeddings !== null) return cachedEmbeddings;
  if (!fs.existsSync(CREDO_BIN_PATH) || !fs.existsSync(CREDO_META_PATH)) {
    return null;
  }
  const meta = JSON.parse(fs.readFileSync(CREDO_META_PATH, "utf-8")) as {
    model: string;
    dim: number;
    count: number;
    ids: number[];
    scales: number[];
  };
  const buf = fs.readFileSync(CREDO_BIN_PATH);
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
    ids: meta.ids,
    qVectors,
    qScales: Float32Array.from(meta.scales),
  };
  return cachedEmbeddings;
}

function cosineSimQ(q: Float32Array, qb: Int8Array, scaleB: number): number {
  let dot = 0,
    nq = 0,
    nb = 0;
  for (let i = 0; i < q.length; i++) {
    dot += q[i] * qb[i];
    nq += q[i] * q[i];
    nb += qb[i] * qb[i];
  }
  const dotScaled = dot * (scaleB / 127);
  const normBScaled = Math.sqrt(nb) * (scaleB / 127);
  return dotScaled / (Math.sqrt(nq) * normBScaled || 1);
}

export async function searchCredo(
  query: string,
  k = 2,
): Promise<{ qa: CredoQA; score: number }[]> {
  loadCredo();
  if (!cachedCredo || cachedCredo.length === 0 || !cachedCredoById) return [];
  const emb = loadCredoEmbeddings();
  if (!emb) return [];
  const qvArr = await embedQuery(query);
  if (!qvArr) return [];
  const qv = Float32Array.from(qvArr);
  const scored: { score: number; id: number }[] = new Array(emb.qVectors.length);
  for (let i = 0; i < emb.qVectors.length; i++) {
    scored[i] = {
      score: cosineSimQ(qv, emb.qVectors[i], emb.qScales[i]),
      id: emb.ids[i],
    };
  }
  scored.sort((a, b) => b.score - a.score);
  return scored
    .slice(0, k)
    .map((s) => ({ qa: cachedCredoById!.get(s.id)!, score: s.score }))
    .filter((x) => x.qa);
}
