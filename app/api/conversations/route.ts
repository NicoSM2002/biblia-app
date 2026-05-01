/**
 * POST /api/conversations           — create a new empty conversation
 * GET  /api/conversations           — list the signed-in user's conversations
 *
 * RLS in the database guarantees users only see their own rows even if a
 * client tried to forge a different user_id; we still set user_id on insert
 * so the row gets attributed correctly.
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = createClient(req);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "not authenticated" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { title?: string };
  const title = (body.title ?? "").slice(0, 200) || null;

  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: user.id, title })
    .select("id, title, created_at, updated_at")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ conversation: data });
}

export async function GET(req: NextRequest) {
  const supabase = createClient(req);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ conversations: data });
}
