/**
 * GET /api/conversations/[id]
 *   Returns the conversation metadata + its turns in order. RLS guarantees
 *   only the owner can read.
 */

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "not authenticated" }, { status: 401 });
  }

  const { data: conv, error: e1 } = await supabase
    .from("conversations")
    .select("id, title, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (e1) return Response.json({ error: e1.message }, { status: 500 });
  if (!conv) return Response.json({ error: "not found" }, { status: 404 });

  const { data: turns, error: e2 } = await supabase
    .from("turns")
    .select("ord, question, verse_reference, verse_text, response")
    .eq("conversation_id", id)
    .order("ord", { ascending: true });
  if (e2) return Response.json({ error: e2.message }, { status: 500 });

  return Response.json({ conversation: conv, turns: turns ?? [] });
}
