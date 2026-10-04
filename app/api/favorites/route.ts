/**
 * GET /api/favorites — every response the signed-in user hearted, newest
 * first, across all their conversations. Backs the "Mis favoritas" page.
 *
 * RLS on turns/conversations already limits rows to the caller's own; the
 * explicit auth check just turns "no session" into a clean 401.
 * Un-hearting reuses PATCH /api/conversations/[id]/turns.
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = createClient(req);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("turns")
    .select(
      "ord, question, verse_reference, verse_text, response, created_at, conversation_id",
    )
    .eq("liked", true)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ favorites: data });
}
