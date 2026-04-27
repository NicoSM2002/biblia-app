/**
 * Verifies that a quoted verse exists literally in the Bible JSON.
 * If the cited reference + text don't match exactly, we treat the response
 * as an attempted hallucination and discard it.
 */

import { findByRef, loadVerses } from "./bible";

const ABBR_BY_NAME: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const v of loadVerses()) {
    map[v.libro.toLowerCase()] = v.abbr;
  }
  return map;
})();

function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFC")
    // Strip punctuation, quotes, parentheses, square brackets
    .replace(/[«»"'""''()\[\]]/g, "")
    // Strip the BAC edition's poetic line separator
    .replace(/\|/g, " ")
    // Strip Hebrew acrostic letter marks the BAC uses in psalms ("(Pe)", "(Alef)", etc.)
    // — these are inside parens which we already stripped above; left here as a guard.
    .replace(/\b(?:alef|bet|guimel|dalet|he|vau|zain|jet|tet|yod|kaf|lamed|mem|nun|sámec|ain|pe|sade|kof|res|sin|tau)\b/g, "")
    .replace(/[.,;:¿?¡!—–\-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type ValidationResult =
  | { ok: true; reference: string; text: string }
  | { ok: false; reason: string };

/**
 * Try to resolve a free-form reference like "Salmos 23:1", "Sal 23,1", "Mt 5:3"
 * into a canonical lookup against biblia.json.
 */
function resolveRef(refRaw: string): { abbr: string; cap: number; vers: number } | null {
  // Accept "Book Cap:Vers" or "Book Cap,Vers" with various spellings.
  const m = refRaw.match(/^\s*(.+?)\s+(\d+)[\s,:.\-]+(\d+)\s*$/);
  if (!m) return null;
  const [, book, capS, versS] = m;
  const cap = parseInt(capS, 10);
  const vers = parseInt(versS, 10);
  // First try as a full book name
  const lcBook = book.toLowerCase().trim();
  let abbr = ABBR_BY_NAME[lcBook];
  if (!abbr) {
    // Maybe it's already an abbreviation — check by any verse with that abbr
    const verses = loadVerses();
    if (verses.some((v) => v.abbr.toLowerCase() === lcBook)) abbr = book.trim();
  }
  if (!abbr) return null;
  return { abbr, cap, vers };
}

export function validateQuote(reference: string, quotedText: string): ValidationResult {
  const resolved = resolveRef(reference);
  if (!resolved) return { ok: false, reason: "reference unparseable" };
  const verse = findByRef(`${resolved.abbr} ${resolved.cap}:${resolved.vers}`);
  if (!verse) return { ok: false, reason: "verse not found in Bible" };

  const a = normalizeForCompare(quotedText);
  const b = normalizeForCompare(verse.texto);

  // Allow the model to omit a trailing ellipsis or quote a substring as long
  // as it appears literally somewhere inside the verse text.
  if (b.includes(a) || a.includes(b)) {
    return { ok: true, reference: `${verse.libro} ${verse.capitulo}:${verse.versiculo}`, text: verse.texto };
  }
  return { ok: false, reason: "quoted text does not match Bible verse" };
}
