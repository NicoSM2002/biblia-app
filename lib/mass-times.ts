/**
 * Horarios de misa from the parish's own website.
 *
 * Google Places has no mass times — its `regularOpeningHours` is the
 * parish's ATTENTION/office hours, which the app used to show as "Próximas
 * misas" (wrong: 8:30–13:00 office hours instead of 6:30 p.m. mass). Parish
 * sites usually do publish "Horarios de Misas", so:
 *
 *   1. fetch the site (and, if the home page never mentions mass, the first
 *      same-site link that looks like a schedule page),
 *   2. keep only the text around "misa"/"eucaristía" so the model sees a few
 *      KB instead of a whole page,
 *   3. have a small LLM pull out ONLY mass times as strict JSON, which we
 *      validate before trusting.
 *
 * Uses DeepSeek when DEEPSEEK_API_KEY is set (production), else Claude Haiku.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export const DAYS = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
] as const;
export type Day = (typeof DAYS)[number];

export type MassTimes = {
  found: boolean;
  /** Mass times per day, 24h "HH:MM", main church only. */
  days: { day: Day; times: string[] }[];
  /** Other places/notes, e.g. "Domingo 11:00 — Parque de Molinos". */
  notes: string[];
  source: string | null;
};

const NOT_FOUND = (source: string | null): MassTimes => ({
  found: false,
  days: [],
  notes: [],
  source,
});

const KEYWORD = /\b(misas?|eucarist[ií]as?|celebraci[oó]n eucar)/i;
const MAX_HTML = 600_000;

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; HablaConLaPalabra/1.0; +horarios de misa)",
        "Accept-Language": "es",
      },
    });
    if (!res.ok || !/text\/html/i.test(res.headers.get("content-type") ?? "")) return null;
    return (await res.text()).slice(0, MAX_HTML);
  } catch {
    return null;
  }
}

const ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", ordm: "º", ordf: "ª", middot: "·",
};

/** HTML → plain text with one line per block element. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|td)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => ENTITIES[name] ?? m)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Lines around each mass keyword, merged, capped. */
export function relevantText(text: string, max = 6000): string | null {
  const lines = text.split("\n");
  const keep = new Set<number>();
  lines.forEach((l, i) => {
    if (KEYWORD.test(l)) for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 22); j++) keep.add(j);
  });
  if (!keep.size) return null;
  return [...keep].sort((a, b) => a - b).map((i) => lines[i]).join("\n").slice(0, max);
}

/**
 * Same-site links that may hold the schedule, best first: "horario / misas"
 * pages, then generic ones parishes often use ("servicios parroquiales",
 * "celebraciones", "sacramentos").
 */
function scheduleLinks(html: string, base: string): { strong: string[]; weak: string[] } {
  const baseUrl = new URL(base);
  const strong: string[] = [];
  const weak: string[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = `${m[1]} ${m[2].replace(/<[^>]+>/g, " ")}`;
    const bucket = /horario|misas?\b|eucarist/i.test(label)
      ? strong
      : /servicios|celebraci|sacramento|liturgi/i.test(label)
        ? weak
        : null;
    if (!bucket) continue;
    try {
      const u = new URL(m[1], baseUrl);
      u.hash = "";
      const href = u.toString();
      if (u.hostname === baseUrl.hostname && /^https?:$/.test(u.protocol) && href !== baseUrl.toString()) {
        if (!strong.includes(href) && !weak.includes(href)) bucket.push(href);
      }
    } catch {
      // bad href
    }
  }
  return { strong, weak };
}

const SYSTEM = `Extraes los HORARIOS DE MISA de un texto tomado de la web de una parroquia católica.
Reglas:
- Solo misas / eucaristías. IGNORA horarios de atención, oficina, despacho parroquial, confesiones, adoración, catequesis.
- Expande rangos de días ("martes a viernes" = martes, miércoles, jueves, viernes).
- Horas en formato 24 h "HH:MM" (6:30 p.m. → "18:30"; "12:00 m." → "12:00").
- "days" = solo el templo parroquial principal. Misas en otras sedes/capillas van en "notes" como texto corto en español, p. ej. "Domingo 11:00 — Parque de Molinos".
- Si el texto no trae horarios de misa claros, responde {"found": false}.
- No inventes nada que no esté en el texto.
Responde SOLO con JSON: {"found": true, "days": [{"day": "lunes", "times": ["18:30"]}], "notes": []}
Días válidos: lunes, martes, miércoles, jueves, viernes, sábado, domingo.`;

async function askModel(text: string): Promise<string> {
  if (process.env.DEEPSEEK_API_KEY) {
    const client = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com" });
    const r = await client.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      temperature: 0,
      max_tokens: 800,
      // No response_format json_object: DeepSeek warns it can return empty
      // content (see lib/deepseek.ts). parseMassJson slices out the {…}.
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: text },
      ],
      // Same as lib/deepseek.ts: thinking only adds latency for extraction.
      ...({ thinking: { type: "disabled" } } as Record<string, unknown>),
    });
    return r.choices[0]?.message?.content ?? "";
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const r = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    temperature: 0,
    system: SYSTEM,
    messages: [{ role: "user", content: text }],
  });
  return r.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

/** Parse + validate the model's JSON; anything malformed → not found. */
export function parseMassJson(raw: string, source: string): MassTimes {
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  try {
    const data = JSON.parse(json) as { found?: boolean; days?: unknown; notes?: unknown };
    if (!data.found || !Array.isArray(data.days)) return NOT_FOUND(source);
    const days = DAYS.map((day) => {
      const times = (data.days as { day?: string; times?: unknown }[])
        .filter((d) => d.day?.toLowerCase() === day)
        .flatMap((d) => (Array.isArray(d.times) ? d.times : []))
        .map(String)
        .filter((t) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(t))
        .sort((a, b) => toMin(a) - toMin(b));
      return { day, times: [...new Set(times)] };
    }).filter((d) => d.times.length);
    const notes = Array.isArray(data.notes) ? data.notes.map(String).filter(Boolean).slice(0, 6) : [];
    if (!days.length && !notes.length) return NOT_FOUND(source);
    return { found: true, days, notes, source };
  } catch {
    return NOT_FOUND(source);
  }
}

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

async function fromText(text: string | null, source: string): Promise<MassTimes> {
  if (!text) return NOT_FOUND(source);
  try {
    return parseMassJson(await askModel(text), source);
  } catch {
    return NOT_FOUND(source);
  }
}

/**
 * Home page first, then follow likely links up to two levels deep. Real
 * case: Santa Gema Galgani's schedule is home → "Servicios Parroquiales" →
 * "Eucaristías"; stopping at the first level missed it. "horario / misas /
 * eucaristías" links are always tried before generic ones ("servicios…").
 * Bounded: at most 5 extra pages and ~20 s, so the route never hangs.
 */
export async function getMassTimes(website: string): Promise<MassTimes> {
  const deadline = Date.now() + 20_000;
  const home = await fetchHtml(website);
  if (!home) return NOT_FOUND(website);
  const first = await fromText(relevantText(htmlToText(home)), website);
  if (first.found) return first;

  const seen = new Set([website]);
  let level = scheduleLinks(home, website);
  let fetched = 0;
  for (let depth = 0; depth < 2; depth++) {
    const next = { strong: [] as string[], weak: [] as string[] };
    for (const link of [...level.strong, ...level.weak].slice(0, 3)) {
      if (seen.has(link) || fetched >= 5 || Date.now() > deadline) continue;
      seen.add(link);
      fetched++;
      const page = await fetchHtml(link);
      if (!page) continue;
      const r = await fromText(relevantText(htmlToText(page)), link);
      if (r.found) return r;
      const found = scheduleLinks(page, website);
      next.strong.push(...found.strong.filter((u) => !seen.has(u) && !next.strong.includes(u)));
      next.weak.push(...found.weak.filter((u) => !seen.has(u) && !next.weak.includes(u)));
    }
    level = next;
  }
  return NOT_FOUND(website);
}
