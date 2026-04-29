/**
 * GET /api/daily-verse — returns today's verse from the curated pool.
 * Cached on the edge for 24h since the value only changes once a day.
 */

import { findByRef } from "@/lib/bible";
import { getDailyReference } from "@/lib/daily-verses";

export const runtime = "nodejs";

export async function GET() {
  const ref = getDailyReference();
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
        // Browser cache 1 hour, CDN/edge cache 24h.
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
      },
    },
  );
}
