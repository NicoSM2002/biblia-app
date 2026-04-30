/**
 * GET /api/places-photo?name=places/XYZ/photos/ABC&w=400
 *
 * Streams a Google Places (New) photo through our server so the client never
 * sees the API key. Images are immutable per resource name, so we cache
 * aggressively at the CDN layer (1 day).
 */

import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return new Response("Places not configured", { status: 503 });
  }

  const url = new URL(req.url);
  const name = url.searchParams.get("name");
  const widthRaw = url.searchParams.get("w");
  const width = clamp(widthRaw ? parseInt(widthRaw, 10) : 600, 100, 1600);

  if (!name || !/^places\/[^/]+\/photos\/[^/?#]+$/.test(name)) {
    return new Response("Invalid name", { status: 400 });
  }

  const upstream = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${width}&skipHttpRedirect=false`;

  const upstreamRes = await fetch(upstream, {
    headers: { "X-Goog-Api-Key": apiKey },
    // Vercel will cache the *response* of this route via the headers below;
    // we don't need fetch-level caching of the upstream call.
    cache: "no-store",
  });

  if (!upstreamRes.ok) {
    return new Response(`Upstream ${upstreamRes.status}`, {
      status: upstreamRes.status,
    });
  }

  const contentType = upstreamRes.headers.get("content-type") ?? "image/jpeg";
  const body = await upstreamRes.arrayBuffer();

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
    },
  });
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
