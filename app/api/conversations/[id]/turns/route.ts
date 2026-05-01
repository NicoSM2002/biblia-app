/**
 * POST  /api/conversations/[id]/turns
 *   body: { ord, question, verse_reference?, verse_text?, response }
 *   Appends a turn to the conversation.
 *
 * PATCH /api/conversations/[id]/turns
 *   body: { ord, liked }
 *   Toggles the `liked` flag on a specific turn (identified by its
 *   ord within the conversation). Used by the heart button under
 *   each turn.
 *
 * RLS ensures only the conversation's owner can write either way.
 * If the conversation has no title yet, the first question is used
 * as the title (truncated).
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type TurnInsert = {
  ord: number;
  question: string;
  verse_reference?: string | null;
  verse_text?: string | null;
  response: string;
};

type TurnPatch = {
  ord: number;
  liked: boolean;
};

export async function POST(
  req: NextRequest,
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

  const body = (await req.json()) as TurnInsert;
  if (!body || typeof body.question !== "string" || typeof body.response !== "string") {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { error } = await supabase.from("turns").insert({
    conversation_id: id,
    ord: body.ord,
    question: body.question.slice(0, 4000),
    verse_reference: body.verse_reference ?? null,
    verse_text: body.verse_text ?? null,
    response: body.response.slice(0, 8000),
  });
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // If this is the first turn, seed the conversation title from the question.
  if (body.ord === 0) {
    const title = body.question.slice(0, 80);
    await supabase
      .from("conversations")
      .update({ title })
      .eq("id", id)
      .is("title", null);
  }

  return Response.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
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

  const body = (await req.json()) as TurnPatch;
  if (
    !body ||
    typeof body.ord !== "number" ||
    typeof body.liked !== "boolean"
  ) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { error } = await supabase
    .from("turns")
    .update({ liked: body.liked })
    .eq("conversation_id", id)
    .eq("ord", body.ord);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
