/**
 * Server-side helpers around Google Maps Platform — Places (New) + Geocoding.
 *
 * Never call from a Client Component: the API key must stay on the server.
 */

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

export type Coords = { lat: number; lng: number };

export type Church = {
  id: string;
  name: string;
  address: string;
  location: Coords;
  distanceMeters: number;
  phone?: string | null;
  website?: string | null;
  rating?: number | null;
  userRatingCount?: number | null;
  openingHours?: string[] | null;
  mapsUrl: string;
};

function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY is not configured");
  return key;
}

export function isPlacesConfigured(): boolean {
  return !!process.env.GOOGLE_PLACES_API_KEY;
}

/**
 * Convert a free-form address string into a (lat, lng).
 */
export async function geocodeAddress(
  address: string,
): Promise<{ coords: Coords; formattedAddress: string } | null> {
  const url = new URL(GEOCODE_URL);
  url.searchParams.set("address", address);
  url.searchParams.set("language", "es");
  url.searchParams.set("key", getApiKey());

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status: string;
    results: Array<{
      geometry: { location: { lat: number; lng: number } };
      formatted_address: string;
    }>;
  };
  if (data.status !== "OK" || data.results.length === 0) return null;
  const r = data.results[0];
  return {
    coords: { lat: r.geometry.location.lat, lng: r.geometry.location.lng },
    formattedAddress: r.formatted_address,
  };
}

/**
 * Search for nearby Catholic churches using the Places API (New) text search,
 * which returns more relevant results for our query than Nearby Search +
 * type filtering.
 */
export async function searchNearbyChurches(
  center: Coords,
  radiusMeters = 5000,
): Promise<Church[]> {
  const fields = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.nationalPhoneNumber",
    "places.internationalPhoneNumber",
    "places.websiteUri",
    "places.rating",
    "places.userRatingCount",
    "places.regularOpeningHours",
    "places.googleMapsUri",
  ].join(",");

  const res = await fetch(PLACES_TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": getApiKey(),
      "X-Goog-FieldMask": fields,
    },
    body: JSON.stringify({
      textQuery: "iglesia católica parroquia",
      languageCode: "es",
      maxResultCount: 20,
      locationBias: {
        circle: {
          center: { latitude: center.lat, longitude: center.lng },
          radius: radiusMeters,
        },
      },
      rankPreference: "DISTANCE",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Places API ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    places?: Array<{
      id: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude: number; longitude: number };
      nationalPhoneNumber?: string;
      internationalPhoneNumber?: string;
      websiteUri?: string;
      rating?: number;
      userRatingCount?: number;
      regularOpeningHours?: { weekdayDescriptions?: string[] };
      googleMapsUri?: string;
    }>;
  };

  const churches: Church[] = (data.places ?? [])
    .filter(
      (p) =>
        p.location &&
        p.displayName?.text &&
        // Cheap heuristic: filter out non-Catholic results that sometimes leak
        // into "iglesia católica" queries (templos evangélicos / cristianos).
        !/evangéli|cristian.{1,8}misionero|adventist|mormó|testigo|protestant/i.test(
          p.displayName.text + " " + (p.formattedAddress ?? ""),
        ),
    )
    .map((p) => {
      const loc = p.location!;
      return {
        id: p.id,
        name: p.displayName!.text!,
        address: p.formattedAddress ?? "",
        location: { lat: loc.latitude, lng: loc.longitude },
        distanceMeters: haversine(center, {
          lat: loc.latitude,
          lng: loc.longitude,
        }),
        phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
        website: p.websiteUri ?? null,
        rating: p.rating ?? null,
        userRatingCount: p.userRatingCount ?? null,
        openingHours: p.regularOpeningHours?.weekdayDescriptions ?? null,
        mapsUrl:
          p.googleMapsUri ||
          `https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}&query_place_id=${p.id}`,
      };
    });

  churches.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return churches;
}

function haversine(a: Coords, b: Coords): number {
  const R = 6371000; // meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}
