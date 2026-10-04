/**
 * Text helpers shared by the home Gospel card and the full-screen reader.
 */

import type { DailyGospel } from "@/lib/daily-gospel";
import { speakable } from "@/lib/tts";

/** Straubinger marks acrostic psalms with "(Alef)", "(Bet)"… — not read. */
export const ACROSTIC =
  /\((?:Alef|Bet|Guímel|Guimel|Dálet|Dalet|He|Vau|Zain|Jet|Tet|Yod|Kaf|Lámed|Lamed|Mem|Nun|Sámec|Samec|Ain|Pe|Sade|Kof|Cof|Res|Sin|Sín|Shin|Tau)\)\s*/gi;

export function cleanVerse(text: string): string {
  return text.replace(ACROSTIC, "").replace(/\s*\|\s*/g, " — ").trim();
}

/** "Mateo 21,33-43" → "Mateo". */
export function gospelBook(gospel: DailyGospel): string {
  return gospel.reference.split(" ")[0];
}

/** What "Escuchar" reads: the liturgical frame around the pericope. */
export function gospelSpeech(gospel: DailyGospel): string {
  const body = gospel.verses.map((v) => cleanVerse(v.texto)).join(" ");
  return speakable(
    `Lectura del santo Evangelio según san ${gospelBook(gospel)}. ${body} Palabra del Señor.`,
  );
}

/** The question sent to the chat by "Reflexionar sobre este Evangelio". */
export function reflectQuestion(gospel: DailyGospel): string {
  return `Ayúdame a reflexionar sobre el Evangelio de hoy (${gospel.reference}). ¿Qué me quiere decir Dios con él?`;
}

export type Season = { name: string; color: string };

/**
 * Liturgical season + its vestment colour, read off the day's liturgical
 * title ("27º domingo del Tiempo Ordinario"). Feasts whose title names no
 * season ("Todos los Santos") return null and the home shows just the date.
 */
export function liturgicalSeason(title: string | undefined): Season | null {
  const t = (title ?? "").toLowerCase();
  if (t.includes("adviento")) return { name: "Adviento", color: "#6A4C93" };
  if (t.includes("cuaresma") || t.includes("ceniza") || t.includes("semana santa"))
    return { name: "Cuaresma", color: "#6A4C93" };
  if (t.includes("pascua")) return { name: "Tiempo de Pascua", color: "#C9A548" };
  if (t.includes("navidad") || t.includes("natividad") || t.includes("epifan"))
    return { name: "Navidad", color: "#C9A548" };
  if (t.includes("tiempo ordinario")) return { name: "Tiempo Ordinario", color: "#3E7A4E" };
  return null;
}
