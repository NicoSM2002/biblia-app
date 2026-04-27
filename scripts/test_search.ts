/**
 * Sanity test: compares BM25 (keyword) vs Vector (semantic) search.
 *
 * Run:
 *   npx tsx scripts/test_search.ts
 *
 * Loads .env.local automatically so VOYAGE_API_KEY is picked up.
 */
import fs from "node:fs";
import path from "node:path";
import { search, searchBM25, loadEmbeddings } from "../lib/bible";

// Lightweight .env.local loader
const envPath = path.resolve(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const QUERIES = [
  "me siento solo, ¿qué hago?",
  "acabo de perder a mi madre",
  "tengo miedo del futuro",
  "cómo perdonar a alguien que me hizo daño",
  "el amor es paciente",
  "necesito esperanza",
];

async function main() {
  const hasEmb = !!loadEmbeddings();
  console.log(
    `Embeddings disponibles: ${hasEmb ? "sí (vector search)" : "no (BM25 only)"}`,
  );
  for (const q of QUERIES) {
    console.log(`\n=== ${q} ===`);
    if (hasEmb) {
      const v = await search(q, 5);
      console.log("  [VECTOR]");
      for (const { verse, score } of v) {
        const ref = `${verse.libro} ${verse.capitulo}:${verse.versiculo}`;
        console.log(`    [${score.toFixed(3)}] ${ref} — ${verse.texto.slice(0, 90)}`);
      }
    }
    const b = searchBM25(q, 5);
    console.log("  [BM25]");
    for (const { verse, score } of b) {
      const ref = `${verse.libro} ${verse.capitulo}:${verse.versiculo}`;
      console.log(`    [${score.toFixed(2)}] ${ref} — ${verse.texto.slice(0, 90)}`);
    }
  }
}

main().catch(console.error);
