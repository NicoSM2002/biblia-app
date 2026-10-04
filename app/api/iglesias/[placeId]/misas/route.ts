/**
 * GET /api/iglesias/[placeId]/misas — mass times read from the parish's own
 * website (lib/mass-times.ts). Separate from the detail route because it's
 * slow (fetch a site + an LLM call): the page shows everything else first
 * and fills this section in when it arrives.
 *
 * The website comes from Google Places by placeId, never from the client —
 * so this can't be used to make the server fetch arbitrary URLs.
 * Cached at the edge for a week (a day when nothing was found).
 */

import { getChurchDetail, isPlacesConfigured } from "@/lib/places";
import { getMassTimes, type MassTimes } from "@/lib/mass-times";

export const runtime = "nodejs";
export const maxDuration = 30;

const memo = new Map<string, MassTimes>();

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ placeId: string }> },
) {
  if (!isPlacesConfigured()) {
    return Response.json({ error: "servicio no configurado" }, { status: 503 });
  }
  const { placeId } = await params;

  let result = memo.get(placeId);
  if (!result) {
    const church = await getChurchDetail(placeId, null).catch(() => null);
    if (!church) return Response.json({ error: "no encontrada" }, { status: 404 });
    result = church.website
      ? await getMassTimes(church.website)
      : { found: false, days: [], notes: [], source: null };
    memo.set(placeId, result);
  }

  return Response.json(
    { masses: result },
    {
      headers: {
        "Cache-Control": result.found
          ? "public, s-maxage=604800, stale-while-revalidate=86400"
          : "public, s-maxage=86400",
      },
    },
  );
}
