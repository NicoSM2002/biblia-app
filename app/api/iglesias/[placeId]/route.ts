/**
 * GET /api/iglesias/[placeId]?lat=…&lng=…
 *
 * Returns full detail (multiple photos, description, phone, hours) for a
 * single church. The optional lat/lng query allows us to compute distance
 * from where the user originally searched.
 */

import { NextRequest } from "next/server";
import { getChurchDetail, isPlacesConfigured, type Coords } from "@/lib/places";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ placeId: string }> },
) {
  if (!isPlacesConfigured()) {
    return Response.json(
      { error: "El servicio de iglesias no está configurado en este servidor." },
      { status: 503 },
    );
  }

  const { placeId } = await params;
  if (!placeId) {
    return Response.json({ error: "placeId requerido" }, { status: 400 });
  }

  const url = new URL(req.url);
  const latRaw = url.searchParams.get("lat");
  const lngRaw = url.searchParams.get("lng");
  let origin: Coords | null = null;
  if (latRaw && lngRaw) {
    const lat = parseFloat(latRaw);
    const lng = parseFloat(lngRaw);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      origin = { lat, lng };
    }
  }

  try {
    const church = await getChurchDetail(placeId, origin);
    if (!church) {
      return Response.json(
        { error: "No encontramos esa iglesia." },
        { status: 404 },
      );
    }
    return Response.json({ church });
  } catch (err) {
    return Response.json(
      { error: (err as Error).message || "Error consultando la iglesia" },
      { status: 500 },
    );
  }
}
