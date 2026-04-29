/**
 * Curated pool of verses to rotate as the "frase del día" — versículos
 * pastorales y consoladores tomados de toda la Sagrada Escritura.
 *
 * The reference uses the BAC abbreviation as it appears in biblia.json
 * (`abbr` field), so we can look up the exact literal text at runtime.
 */

export type DailyRef = {
  abbr: string;
  capitulo: number;
  versiculo: number;
};

export const DAILY_VERSE_POOL: DailyRef[] = [
  // Salmos
  { abbr: "Sal", capitulo: 23, versiculo: 1 },
  { abbr: "Sal", capitulo: 23, versiculo: 4 },
  { abbr: "Sal", capitulo: 27, versiculo: 1 },
  { abbr: "Sal", capitulo: 27, versiculo: 14 },
  { abbr: "Sal", capitulo: 34, versiculo: 19 },
  { abbr: "Sal", capitulo: 46, versiculo: 11 },
  { abbr: "Sal", capitulo: 62, versiculo: 2 },
  { abbr: "Sal", capitulo: 91, versiculo: 11 },
  { abbr: "Sal", capitulo: 103, versiculo: 8 },
  { abbr: "Sal", capitulo: 118, versiculo: 24 },
  { abbr: "Sal", capitulo: 121, versiculo: 1 },
  { abbr: "Sal", capitulo: 121, versiculo: 8 },
  { abbr: "Sal", capitulo: 139, versiculo: 14 },
  { abbr: "Sal", capitulo: 145, versiculo: 18 },

  // Sabiduría / Proverbios / Eclesiastés
  { abbr: "Prov", capitulo: 3, versiculo: 5 },
  { abbr: "Prov", capitulo: 16, versiculo: 3 },
  { abbr: "Ecl", capitulo: 3, versiculo: 1 },
  { abbr: "Sab", capitulo: 7, versiculo: 14 },

  // Profetas
  { abbr: "Is", capitulo: 40, versiculo: 31 },
  { abbr: "Is", capitulo: 41, versiculo: 10 },
  { abbr: "Is", capitulo: 43, versiculo: 1 },
  { abbr: "Jer", capitulo: 29, versiculo: 11 },
  { abbr: "Lam", capitulo: 3, versiculo: 22 },
  { abbr: "Miq", capitulo: 6, versiculo: 8 },

  // Evangelios
  { abbr: "Mt", capitulo: 5, versiculo: 3 },
  { abbr: "Mt", capitulo: 6, versiculo: 33 },
  { abbr: "Mt", capitulo: 11, versiculo: 28 },
  { abbr: "Mt", capitulo: 28, versiculo: 20 },
  { abbr: "Mc", capitulo: 9, versiculo: 23 },
  { abbr: "Lc", capitulo: 1, versiculo: 38 },
  { abbr: "Lc", capitulo: 6, versiculo: 36 },
  { abbr: "Jn", capitulo: 3, versiculo: 16 },
  { abbr: "Jn", capitulo: 14, versiculo: 6 },
  { abbr: "Jn", capitulo: 14, versiculo: 27 },
  { abbr: "Jn", capitulo: 15, versiculo: 13 },
  { abbr: "Jn", capitulo: 16, versiculo: 33 },

  // Cartas paulinas
  { abbr: "Rom", capitulo: 8, versiculo: 28 },
  { abbr: "Rom", capitulo: 8, versiculo: 38 },
  { abbr: "Rom", capitulo: 12, versiculo: 12 },
  { abbr: "1 Cor", capitulo: 13, versiculo: 4 },
  { abbr: "1 Cor", capitulo: 13, versiculo: 13 },
  { abbr: "2 Cor", capitulo: 12, versiculo: 9 },
  { abbr: "Flp", capitulo: 4, versiculo: 6 },
  { abbr: "Flp", capitulo: 4, versiculo: 13 },
  { abbr: "1 Tes", capitulo: 5, versiculo: 17 },

  // Cartas católicas
  { abbr: "Heb", capitulo: 13, versiculo: 8 },
  { abbr: "Sant", capitulo: 1, versiculo: 5 },
  { abbr: "1 Pe", capitulo: 5, versiculo: 7 },
  { abbr: "1 Jn", capitulo: 4, versiculo: 8 },
  { abbr: "1 Jn", capitulo: 4, versiculo: 18 },
];

/**
 * Returns the reference of the day. Deterministic — given the same date,
 * always returns the same verse. Rotates through the pool by day-of-year.
 */
export function getDailyReference(date = new Date()): DailyRef {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const now = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfYear = Math.floor((now - start) / 86_400_000);
  return DAILY_VERSE_POOL[dayOfYear % DAILY_VERSE_POOL.length];
}
