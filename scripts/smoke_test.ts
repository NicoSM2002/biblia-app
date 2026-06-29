/** End-to-end retrieval smoke test against the new Straubinger + CIC indexes. */
import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const p = path.resolve(__dirname, "..", ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnvLocal();

async function main() {
  const { search } = await import("../lib/bible");
  const { searchCredo } = await import("../lib/credo");

  const queries = [
    "Me siento muy solo y triste esta noche",
    "Tengo miedo del futuro y de lo que viene",
    "¿Qué es la Eucaristía?",
    "Perdí a mi madre y no sé cómo seguir",
  ];

  for (const q of queries) {
    console.log(`\n=== "${q}" ===`);
    const verses = await search(q, 3);
    console.log("  VERSÍCULOS:");
    for (const r of verses) {
      console.log(
        `   (${r.score.toFixed(3)}) ${r.verse.libro} ${r.verse.capitulo}:${r.verse.versiculo} — ${r.verse.texto.slice(0, 70)}`,
      );
    }
    const credo = await searchCredo(q, 2);
    console.log("  DOCTRINA:");
    for (const c of credo) {
      console.log(`   (${c.score.toFixed(3)}) ${c.qa.respuesta.slice(0, 80)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
