/**
 * POST /api/iglesias
 *   body: { address?: string, lat?: number, lng?: number, radius?: number }
 *
 * Either an address (will be geocoded) or a lat/lng pair must be provided.
 * Returns up to 20 nearby Catholic churches sorted by distance.
 */

import { NextRequest } from "next/server";
import {
  geocodeAddress,
  isPlacesConfigured,
  searchNearbyChurches,
  type Coords,
} from "@/lib/places";

export const runtime = "nodejs";

type Body = {
  address?: string;
  lat?: number;
  lng?: number;
  radius?: number;
};

export async function POST(req: NextRequest) {
  if (!isPlacesConfigured()) {
    return Response.json(
      { error: "El servicio de iglesias no está configurado en este servidor." },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  let center: Coords | null = null;
  let formattedAddress: string | null = null;

  if (typeof body.lat === "number" && typeof body.lng === "number") {
    center = { lat: body.lat, lng: body.lng };
  } else if (body.address && body.address.trim()) {
    const result = await geocodeAddress(body.address.trim());
    if (!result) {
      return Response.json(
        { error: "No pudimos encontrar esa dirección. Intenta con más detalle." },
        { status: 400 },
      );
    }
    center = result.coords;
    formattedAddress = result.formattedAddress;
  }

  if (!center) {
    return Response.json(
      { error: "Necesitas indicar una dirección o tu ubicación." },
      { status: 400 },
    );
  }

  const radius = Math.min(Math.max(body.radius ?? 5000, 500), 50000);

  try {
    const churches = await searchNearbyChurches(center, radius);
    return Response.json({
      center,
      formattedAddress,
      radiusMeters: radius,
      churches,
    });
  } catch (err) {
    return Response.json(
      { error: (err as Error).message || "Error consultando iglesias" },
      { status: 500 },
    );
  }
}
