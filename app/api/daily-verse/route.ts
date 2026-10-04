/**
 * GET /api/daily-verse?date=YYYY-MM-DD — the Gospel of the day per the
 * Catholic liturgical calendar (see lib/daily-gospel.ts), for the viewer's
 * LOCAL date. Because the date is part of the URL, each response can be
 * cached safely (a cached entry can never be "yesterday's" Gospel).
 *
 * ?tipo=oracion skips the Gospel and returns the day's verse from
 * PRAYER_POOL (lib/daily-verses.ts): the prayer screen needs a
 * line to rest on in silence, not the first verse of a pericope (which can
 * start mid-parable: "Escuchad otra parábola…").
 *
 * Response:
 *   verse   — always present: the Gospel's first verse (or, if the liturgical
 *             feed is unreachable, a verse from the curated pool). The prayer
 *             page uses only this.
 *   gospel  — the full passage + liturgical title, when available.
 */

import { findByRef } from "@/lib/bible";
import { getDailyGospel } from "@/lib/daily-gospel";
import { getDailyReference, getPrayerReference, localDateKey } from "@/lib/daily-verses";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const param = new URL(req.url).searchParams.get("date");
  const match = param?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date();
  const dateKey = localDateKey(date);
  const forPrayer = new URL(req.url).searchParams.get("tipo") === "oracion";

  const gospel = forPrayer ? null : await getDailyGospel(dateKey);
  if (gospel) {
    const first = gospel.verses[0];
    return Response.json(
      {
        verse: {
          reference: `${gospel.reference.split(" ")[0]} ${first.capitulo}:${first.versiculo}`,
          text: first.texto,
        },
        gospel,
      },
      {
        headers: {
          "Cache-Control": match
            ? // Keyed by date in the URL — same date, same Gospel.
              "public, max-age=86400, s-maxage=86400"
            : "no-store",
        },
      },
    );
  }

  // Prayer verse, or fallback when the liturgical feed is down: the curated
  // pool. Short cache in the fallback case so we retry the feed soon.
  const ref = forPrayer ? getPrayerReference(date) : getDailyReference(date);
  const verse = findByRef(`${ref.abbr} ${ref.capitulo}:${ref.versiculo}`);
  if (!verse) {
    return Response.json({ error: "verse not found" }, { status: 500 });
  }
  return Response.json(
    {
      verse: {
        reference: `${verse.libro} ${verse.capitulo}:${verse.versiculo}`,
        text: verse.texto,
      },
    },
    {
      headers: {
        "Cache-Control":
          forPrayer && match ? "public, max-age=86400, s-maxage=86400" : "public, max-age=300, s-maxage=300",
      },
    },
  );
}
