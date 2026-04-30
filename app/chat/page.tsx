"use client";

import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { VerseCard } from "@/components/VerseCard";
import { ResponseText } from "@/components/ResponseText";
import { QuestionLine } from "@/components/QuestionLine";
import { Loading } from "@/components/Loading";
import { ChatInput } from "@/components/ChatInput";
import { HistorySheet } from "@/components/HistorySheet";
import {
  createClient,
  hasSessionCookie,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

type Turn = {
  id: string;
  question: string;
  verse?: { reference: string; text: string } | null;
  response?: string;
  status: "loading" | "streaming" | "done" | "error";
  error?: string;
};

export default function ChatPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const conversationRef = useRef<HTMLDivElement>(null);
  const lastTurnRef = useRef<HTMLElement | null>(null);
  const prevTurnCountRef = useRef(0);
  const scrolledForVerseRef = useRef<Set<string>>(new Set());

  const conversationIdRef = useRef<string | null>(null);
  const savedTurnIdsRef = useRef<Set<string>>(new Set());
  // Seed signed-in state from the Supabase auth-token cookie so the header
  // doesn't flicker between renders (history button appearing late after
  // the async getUser() check).
  const [signedIn, setSignedIn] = useState<boolean>(() => hasSessionCookie());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null,
  );
  const [activeConversationTitle, setActiveConversationTitle] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (turns.length > prevTurnCountRef.current) {
      lastTurnRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      prevTurnCountRef.current = turns.length;
    }
    const last = turns[turns.length - 1];
    if (last?.verse && !scrolledForVerseRef.current.has(last.id)) {
      scrolledForVerseRef.current.add(last.id);
      requestAnimationFrame(() => {
        lastTurnRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [turns]);

  function reset() {
    if (pending) return;
    setTurns([]);
    conversationIdRef.current = null;
    savedTurnIdsRef.current.clear();
    setActiveConversationId(null);
    setActiveConversationTitle(null);
  }

  async function loadConversation(id: string) {
    if (pending) return;
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as {
        conversation: { id: string; title: string | null };
        turns: Array<{
          ord: number;
          question: string;
          verse_reference: string | null;
          verse_text: string | null;
          response: string;
        }>;
      };

      const loadedTurns: Turn[] = data.turns.map((t) => ({
        id: crypto.randomUUID(),
        question: t.question,
        verse:
          t.verse_reference && t.verse_text
            ? { reference: t.verse_reference, text: t.verse_text }
            : null,
        response: t.response,
        status: "done" as const,
      }));

      savedTurnIdsRef.current = new Set(loadedTurns.map((t) => t.id));
      scrolledForVerseRef.current = new Set(loadedTurns.map((t) => t.id));
      prevTurnCountRef.current = loadedTurns.length;
      conversationIdRef.current = data.conversation.id;
      setActiveConversationId(data.conversation.id);
      setActiveConversationTitle(data.conversation.title);
      setTurns(loadedTurns);
      setHistoryOpen(false);
    } catch (err) {
      console.warn("Failed to load conversation:", err);
    }
  }

  useEffect(() => {
    if (!signedIn) return;
    const done = turns.find(
      (t) =>
        t.status === "done" &&
        t.response &&
        !savedTurnIdsRef.current.has(t.id),
    );
    if (!done) return;
    savedTurnIdsRef.current.add(done.id);
    void persistTurn(done, turns.findIndex((t) => t.id === done.id));
  }, [turns, signedIn]);

  async function persistTurn(turn: Turn, ord: number) {
    try {
      if (!conversationIdRef.current) {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error(`create conversation ${res.status}`);
        const data = (await res.json()) as { conversation: { id: string } };
        conversationIdRef.current = data.conversation.id;
      }
      await fetch(`/api/conversations/${conversationIdRef.current}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ord,
          question: turn.question,
          verse_reference: turn.verse?.reference ?? null,
          verse_text: turn.verse?.text ?? null,
          response: turn.response,
        }),
      });
    } catch (err) {
      console.warn("Failed to persist turn:", err);
    }
  }

  async function ask(question: string) {
    if (pending) return;
    const id = crypto.randomUUID();
    const newTurn: Turn = { id, question, status: "loading" };
    setTurns((prev) => [...prev, newTurn]);
    setPending(true);

    const history = turns
      .filter((t) => t.status === "done" && t.response)
      .flatMap((t) => [
        { role: "user" as const, content: t.question },
        {
          role: "assistant" as const,
          content: JSON.stringify({
            verse: t.verse ?? null,
            response: t.response,
          }),
        },
      ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`Error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let resultReceived = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split("\n");
          let eventName = "message";
          let dataLine = "";
          for (const line of lines) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLine = line.slice(5).trim();
          }
          if (!dataLine) continue;
          let data: unknown;
          try {
            data = JSON.parse(dataLine);
          } catch {
            continue;
          }
          if (eventName === "verse") {
            const v = data as { reference: string; text: string };
            setTurns((prev) =>
              prev.map((t) =>
                t.id === id ? { ...t, verse: v, status: "streaming" } : t,
              ),
            );
          } else if (eventName === "response_delta") {
            const d = data as { text: string };
            setTurns((prev) =>
              prev.map((t) =>
                t.id === id
                  ? {
                      ...t,
                      response: (t.response ?? "") + d.text,
                      status: "streaming",
                    }
                  : t,
              ),
            );
          } else if (eventName === "result") {
            resultReceived = true;
            const r = data as {
              verse?: { reference: string; text: string } | null;
              response: string;
            };
            setTurns((prev) =>
              prev.map((t) =>
                t.id === id
                  ? {
                      ...t,
                      verse: r.verse ?? null,
                      response: r.response,
                      status: "done",
                    }
                  : t,
              ),
            );
          } else if (eventName === "error") {
            setTurns((prev) =>
              prev.map((t) =>
                t.id === id
                  ? {
                      ...t,
                      status: "error",
                      error:
                        (data as { message?: string })?.message ??
                        "Algo salió mal.",
                    }
                  : t,
              ),
            );
          }
        }
      }

      if (!resultReceived) {
        setTurns((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: "error",
                  error: "No se recibió respuesta. Intenta de nuevo.",
                }
              : t,
          ),
        );
      }
    } catch (err) {
      setTurns((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, status: "error", error: (err as Error).message }
            : t,
        ),
      );
    } finally {
      setPending(false);
    }
  }

  const empty = turns.length === 0;

  return (
    <div className="relative h-[100dvh] flex flex-col overflow-hidden">
      <div className="missal-page">
        <Header
          onReset={reset}
          onOpenHistory={signedIn ? () => setHistoryOpen(true) : undefined}
          conversationTitle={activeConversationTitle}
          exportableTurns={turns
            .filter((t) => t.status === "done" && (t.response || t.verse))
            .map((t) => ({
              question: t.question,
              verse: t.verse ?? null,
              response: t.response,
            }))}
        />
        <HistorySheet
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onSelect={loadConversation}
          activeId={activeConversationId}
        />

        <main className="relative z-10 flex-1 flex flex-col min-h-0">
          <div
            ref={conversationRef}
            className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-10 min-h-0"
          >
            <div className="max-w-2xl mx-auto py-4 sm:py-6">
              <PrintHeader />
              {empty ? (
                <ChatEmptyState onPick={ask} />
              ) : (
                turns.map((t, i) => (
                  <article
                    key={t.id}
                    ref={i === turns.length - 1 ? lastTurnRef : undefined}
                    className="mb-8 scroll-mt-4"
                  >
                    <QuestionLine text={t.question} />
                    {t.status === "loading" && <Loading />}
                    {(t.status === "streaming" || t.status === "done") && (
                      <>
                        {t.verse && (
                          <VerseCard
                            reference={t.verse.reference}
                            text={t.verse.text}
                          />
                        )}
                        {t.response && (
                          <ResponseText
                            text={t.response}
                            streaming={t.status === "streaming"}
                          />
                        )}
                        {t.status === "streaming" && !t.verse && !t.response && (
                          <Loading />
                        )}
                      </>
                    )}
                    {t.status === "error" && (
                      <div
                        className="anim-fade-in mt-3 rounded-lg border border-[var(--vino)]/25 bg-[var(--vino)]/[0.04] px-4 py-3"
                        role="alert"
                      >
                        <p className="font-sans text-[0.92rem] text-[var(--vino)] leading-relaxed">
                          {t.error ?? "Algo salió mal. Intenta de nuevo."}
                        </p>
                        <button
                          type="button"
                          onClick={() => ask(t.question)}
                          className="mt-2 inline-flex items-center gap-1.5 font-sans text-[0.86rem] font-medium text-[var(--vino)] hover:underline"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M3 12a9 9 0 0 1 15.5-6.4L21 8" />
                            <polyline points="21 3 21 8 16 8" />
                          </svg>
                          Volver a intentar
                        </button>
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="relative z-10 px-4 sm:px-8 lg:px-10 pt-3 pb-5 sm:pb-7 border-t border-[var(--rule)] bg-[var(--paper)]">
            <div className="max-w-2xl mx-auto">
              <ChatInput
                onSubmit={ask}
                disabled={pending}
                placeholder={
                  empty ? "¿Qué quieres preguntar?" : "Sigue hablando…"
                }
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

const EXAMPLES = [
  "Me siento solo, ¿qué hago?",
  "Tengo miedo del futuro",
  "¿Cómo perdono a alguien?",
  "Acabo de perder a un ser querido",
  "Necesito esperanza hoy",
];

function PrintHeader() {
  const date = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <div className="print-only mb-8 text-center">
      <h1 className="font-serif italic text-2xl text-[var(--ink)]">
        Habla con la Palabra
      </h1>
      <p className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--gold-text)] mt-1">
        {date}
      </p>
      <hr className="hairline-gold mt-3 mx-auto max-w-[10rem]" />
    </div>
  );
}

function ChatEmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="space-y-4 lg:space-y-6 pb-4 lg:pt-2">
      <div className="card-welcome lg:py-6 lg:px-8">
        <h2 className="font-serif italic text-[1.2rem] sm:text-[1.4rem] lg:text-[1.55rem] text-[var(--ink)] leading-[1.35] mb-2 lg:text-center">
          Pregúntale a la Sagrada Escritura.
        </h2>
        <p className="font-sans text-[0.9rem] sm:text-[0.96rem] lg:text-[1rem] text-[var(--ink-soft)] leading-[1.6] lg:text-center lg:max-w-[44ch] lg:mx-auto">
          Una duda, un dolor, una alegría. La Palabra responde con un
          versículo y una explicación cercana.
        </p>
      </div>

      <div className="lg:pt-1">
        <p className="label-section lg:justify-center lg:flex">Prueba con</p>
        <div className="flex flex-wrap gap-2 lg:justify-center">
          {EXAMPLES.map((q) => (
            <button
              key={q}
              onClick={() => onPick(q)}
              className="chip-example"
              type="button"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
