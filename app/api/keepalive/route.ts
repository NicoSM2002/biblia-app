/**
 * GET /api/keepalive — keeps the Supabase project from being paused.
 *
 * Supabase's free plan pauses a project after ~7 days without database
 * activity, which takes sign-in, history and favorites offline until someone
 * restores it by hand. A Vercel Cron (vercel.json) calls this once a day and
 * it runs one tiny real query, so the database never looks idle.
 *
 * Uses its own anon client on purpose: lib/supabase/server.ts forwards the
 * request's Authorization header to Supabase, but Vercel Cron signs its call
 * with `Authorization: Bearer <CRON_SECRET>`, which Supabase would reject as
 * a bad JWT. RLS means the anon query sees zero rows — that's fine, it still
 * executes against Postgres, which is what counts as activity.
 *
 * If CRON_SECRET is set in Vercel, only the cron can call this; otherwise
 * it's open, which is harmless (a HEAD-style count, no data returned).
 */

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return Response.json({ error: "supabase not configured" }, { status: 500 });
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true });

  if (error) {
    // Surfaces in Vercel's cron logs — e.g. the project is already paused.
    // A paused/restoring project answers 5xx with an empty message.
    const detail = error.message || error.code || "Supabase unreachable (paused or restoring?)";
    return Response.json({ ok: false, error: detail }, { status: 502 });
  }
  return Response.json(
    { ok: true, at: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
