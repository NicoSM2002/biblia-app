/**
 * GET    /api/conversations/[id] — load metadata + ordered turns.
 * DELETE /api/conversations/[id] — delete the conversation (cascades to
 *                                  turns via the FK).
 *
 * RLS guarantees only the owner can read or delete.
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

export async function DELETE(
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

  // RLS will block any row that doesn't belong to this user. The turns
  // rows are removed by the ON DELETE CASCADE on conversation_id.
  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
