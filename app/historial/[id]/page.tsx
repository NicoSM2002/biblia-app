/**
 * /historial/[id] — view a single past conversation, read-only.
 */

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LatinCross } from "@/components/Cross";
import { VerseCard } from "@/components/VerseCard";
import { ResponseText } from "@/components/ResponseText";
import { QuestionLine } from "@/components/QuestionLine";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/auth?next=/historial/${id}`);
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, title, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (!conversation) {
    notFound();
  }

  const { data: turns } = await supabase
    .from("turns")
    .select("ord, question, verse_reference, verse_text, response")
    .eq("conversation_id", id)
    .order("ord", { ascending: true });

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[var(--paper)]">
      <header className="px-5 sm:px-8 py-5 border-b border-[var(--rule)]">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <Link href="/historial" className="flex items-center gap-3">
            <LatinCross className="text-[var(--gold)]" size={14} />
            <h1 className="font-sans text-[1rem] font-medium text-[var(--ink)]">
              Habla con la Palabra
            </h1>
          </Link>
          <Link
            href="/historial"
            className="font-sans text-[0.78rem] tracking-[0.12em] uppercase text-[var(--ink-faint)] hover:text-[var(--gold)] transition-colors"
          >
            ← Historial
          </Link>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-8 py-8">
        <div className="max-w-2xl mx-auto">
          <p className="font-sans text-[0.7rem] tracking-[0.18em] uppercase text-[var(--gold)] mb-2">
            {new Date(conversation.created_at).toLocaleDateString("es-ES", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <h2 className="font-serif italic text-[1.5rem] sm:text-[1.7rem] text-[var(--ink)] mb-8">
            {conversation.title || "Conversación"}
          </h2>

          {(turns ?? []).map((t, i) => (
            <article key={i} className="mb-8">
              <QuestionLine text={t.question} />
              {t.verse_reference && t.verse_text && (
                <VerseCard reference={t.verse_reference} text={t.verse_text} />
              )}
              <ResponseText text={t.response} />
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
