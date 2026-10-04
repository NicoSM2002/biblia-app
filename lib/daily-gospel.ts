/**
 * Evangelio del día según el calendario litúrgico católico.
 *
 * evangelizo.org only gives us the liturgical title ("27º domingo del Tiempo
 * Ordinario") and the citation ("Mt 21,33-43"). The TEXT always comes from our
 * own Straubinger edition (data/biblia.json), same as everywhere else in the
 * app. Evangelizo only accepts dates within ±30 days of today — fine, since we
 * only ever ask for the viewer's "today".
 */

import { loadVerses, type Verse } from "@/lib/bible";

export type DailyGospel = {
  /** "27º domingo del Tiempo Ordinario" */
  title: string;
  /** "Mateo 21,33-43" */
  reference: string;
  verses: Pick<Verse, "capitulo" | "versiculo" | "texto">[];
};

const FEED = "https://feed.evangelizo.org/v2/reader.php";

// Liturgical data for a date never changes — memoize per warm instance.
const memo = new Map<string, DailyGospel>();

async function feed(params: Record<string, string>): Promise<string | null> {
  const qs = new URLSearchParams({ lang: "SP", ...params });
  try {
    const res = await fetch(`${FEED}?${qs}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const body = await res.text();
    // Bad params come back as a 200 HTML man page, not an error status.
    if (/<html|error\s*:/i.test(body)) return null;
    const clean = body.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    return clean || null;
  } catch {
    return null;
  }
}

/** "27o domingo" → "27º domingo", "27a semana" → "27ª semana" */
function ordinals(s: string): string {
  return s.replace(/(\d+)o\b/g, "$1º").replace(/(\d+)a\b/g, "$1ª");
}

type Span = { c1: number; v1: number; c2: number; v2: number };

/**
 * Parses lectionary citations: "21,33-43", "5,1-12a", "1,16.18-21.24a",
 * "26,14-27,66", "9,35-10,1.6-8". Verse letters (a/b/c) are dropped — we show
 * the whole verse. Returns null on anything we don't understand.
 */
export function parseCitation(cite: string): Span[] | null {
  const tokens = cite.replace(/\s+/g, "").replace(/\.$/, "").split(/[.;]/);
  const spans: Span[] = [];
  let chapter: number | null = null;
  for (const t of tokens) {
    const m = t.match(/^(?:(\d+),)?(\d+)[a-z]*(?:-(?:(\d+),)?(\d+)[a-z]*)?$/);
    if (!m) return null;
    const c1: number | null = m[1] ? Number(m[1]) : chapter;
    if (c1 == null) return null;
    const v1 = Number(m[2]);
    const c2: number = m[3] ? Number(m[3]) : c1;
    const v2 = m[4] ? Number(m[4]) : v1;
    spans.push({ c1, v1, c2, v2 });
    chapter = c2;
  }
  return spans.length ? spans : null;
}

function key(c: number, v: number) {
  return c * 1000 + v;
}

export async function getDailyGospel(dateKey: string): Promise<DailyGospel | null> {
  const cached = memo.get(dateKey);
  if (cached) return cached;

  const date = dateKey.replace(/-/g, "");
  const [title, short] = await Promise.all([
    feed({ date, type: "liturgic_t" }),
    feed({ date, type: "reading_st", content: "GSP" }),
  ]);
  if (!title || !short) return null;

  // "Mt 21,33-43."
  const m = short.match(/^(\S+)\s+(.+)$/);
  if (!m) return null;
  const [, abbr, cite] = m;
  const spans = parseCitation(cite);
  if (!spans) return null;

  const book = loadVerses().filter((v) => v.abbr === abbr);
  if (!book.length) return null;
  const verses = book
    .filter((v) => {
      const k = key(v.capitulo, v.versiculo);
      return spans.some((s) => k >= key(s.c1, s.v1) && k <= key(s.c2, s.v2));
    })
    .map(({ capitulo, versiculo, texto }) => ({ capitulo, versiculo, texto }));
  if (!verses.length) return null;

  const gospel: DailyGospel = {
    title: ordinals(title),
    reference: `${book[0].libro} ${cite.replace(/\.$/, "")}`,
    verses,
  };
  memo.set(dateKey, gospel);
  return gospel;
}
