"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Header } from "@/components/Header";
import { VerseCard } from "@/components/VerseCard";
import { ResponseText } from "@/components/ResponseText";
import { QuestionLine } from "@/components/QuestionLine";
import { Loading } from "@/components/Loading";
import { ChatInput } from "@/components/ChatInput";
import { HistorySheet } from "@/components/HistorySheet";
import { DailyVerse } from "@/components/DailyVerse";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Turn = {
  id: string;
  question: string;
  verse?: { reference: string; text: string } | null;
  response?: string;
  status: "loading" | "streaming" | "done" | "error";
  error?: string;
};

export default function Page() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const conversationRef = useRef<HTMLDivElement>(null);
  const lastTurnRef = useRef<HTMLElement | null>(null);
  const prevTurnCountRef = useRef(0);
  const scrolledForVerseRef = useRef<Set<string>>(new Set());

  // Tracks the server-side conversation row for the signed-in user. Created
  // lazily on the first turn and reused for subsequent turns. null means the
  // user is not signed in or the conversation hasn't been created yet.
  const conversationIdRef = useRef<string | null>(null);
  const savedTurnIdsRef = useRef<Set<string>>(new Set());
  const [signedIn, setSignedIn] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null,
  );

  // Daily verse welcome — shown once per session per day. Stored in
  // sessionStorage so the user only sees it on their first visit and
  // doesn't get reminded on every reload.
  const [showDailyVerse, setShowDailyVerse] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const seen = sessionStorage.getItem("dailyVerseSeen");
      setShowDailyVerse(seen !== today);
    } catch {
      setShowDailyVerse(false);
    }
  }, []);
  function dismissDailyVerse() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      sessionStorage.setItem("dailyVerseSeen", today);
    } catch {
      // ignore
    }
    setShowDailyVerse(false);
  }

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Scroll precisely twice per turn:
  //   1. When the new turn is added (immediate feedback that the question
  //      went through — the loading dots become visible at the top).
  //   2. When the verse first appears (corrects for any mobile viewport
  //      shift caused by the keyboard dismissing, and brings the verse
  //      itself into view rather than leaving it hidden below the fold).
  // Once the response starts streaming, we never auto-scroll again — the
  // user reads at their own pace.
  useEffect(() => {
    if (turns.length > prevTurnCountRef.current) {
      lastTurnRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      prevTurnCountRef.current = turns.length;
    }
    const last = turns[turns.length - 1];
    if (last?.verse && !scrolledForVerseRef.current.has(last.id)) {
      scrolledForVerseRef.current.add(last.id);
      // One frame later so the verse element is in the DOM before we scroll.
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
  }

  // Load a past conversation back into the chat so the user can continue it.
  async function loadConversation(id: string) {
    if (pending) return;
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as {
        conversation: { id: string };
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

      // Mark all loaded turns as already saved so the persistTurn effect
      // doesn't try to re-write them. Also pre-mark them as already
      // scrolled-for-verse so we don't scroll-jump to old turns.
      savedTurnIdsRef.current = new Set(loadedTurns.map((t) => t.id));
      scrolledForVerseRef.current = new Set(loadedTurns.map((t) => t.id));
      prevTurnCountRef.current = loadedTurns.length;
      conversationIdRef.current = data.conversation.id;
      setActiveConversationId(data.conversation.id);
      setTurns(loadedTurns);
      setHistoryOpen(false);
    } catch (err) {
      console.warn("Failed to load conversation:", err);
    }
  }

  // When a turn finishes, persist it to Supabase if the user is signed in.
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
      // Lazily create the conversation on the first turn.
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
      await fetch(
        `/api/conversations/${conversationIdRef.current}/turns`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ord,
            question: turn.question,
            verse_reference: turn.verse?.reference ?? null,
            verse_text: turn.verse?.text ?? null,
            response: turn.response,
          }),
        },
      );
    } catch (err) {
      // Saving is best-effort — we don't surface the failure to the user.
      // The chat UX continues working in-memory.
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
                t.id === id
                  ? { ...t, verse: v, status: "streaming" }
                  : t,
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
      <AnimatePresence>
        {showDailyVerse && <DailyVerse onContinue={dismissDailyVerse} />}
      </AnimatePresence>

      <main className="relative z-10 flex-1 flex flex-col min-h-0">
        <div ref={conversationRef} className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-10 min-h-0">
          <div className="max-w-2xl mx-auto py-4 sm:py-6">
            <PrintHeader />
            {empty ? (
              <EmptyState onPick={ask} />
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
                    <div className="anim-fade-in mt-3">
                      <p className="font-sans text-[0.92rem] text-[var(--vino)]">
                        {t.error ?? "Algo salió mal. Intenta de nuevo."}
                      </p>
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
              autoFocus
              placeholder={empty ? "¿Qué quieres preguntar?" : "Sigue hablando…"}
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
      <p className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--gold)] mt-1">
        {date}
      </p>
      <hr className="hairline-gold mt-3 mx-auto max-w-[10rem]" />
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="anim-fade-rise space-y-4 lg:space-y-6 pb-4 lg:pt-4">
      {/* Decorative ornament — only on desktop */}
      <div className="hidden lg:flex items-center justify-center gap-3 pb-1">
        <span aria-hidden="true" className="h-px w-12 bg-[var(--gold)] opacity-50" />
        <Quatrefoil className="text-[var(--gold)] opacity-70" />
        <span aria-hidden="true" className="h-px w-12 bg-[var(--gold)] opacity-50" />
      </div>

      <div className="card-welcome lg:py-7 lg:px-8">
        <h2 className="font-serif italic text-[1.2rem] sm:text-[1.4rem] lg:text-[1.7rem] text-[var(--ink)] leading-[1.35] mb-2 lg:mb-3 lg:text-center">
          Pregúntale a la Sagrada Escritura.
        </h2>
        <p className="font-sans text-[0.9rem] sm:text-[0.96rem] lg:text-[1rem] text-[var(--ink-soft)] leading-[1.6] lg:text-center lg:max-w-[44ch] lg:mx-auto">
          Una duda, un dolor, una alegría. La Palabra responde con un versículo y una explicación cercana.
        </p>
      </div>

      <div className="lg:pt-2">
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

      <div className="pt-2 flex items-center justify-center gap-2">
        <span aria-hidden="true" className="h-px w-6 bg-[var(--rule)]" />
        <p className="text-center font-sans text-[0.7rem] tracking-[0.04em] text-[var(--ink-faint)]">
          Sagrada Biblia · Versión oficial de la Conferencia Episcopal Española
        </p>
        <span aria-hidden="true" className="h-px w-6 bg-[var(--rule)]" />
      </div>
    </div>
  );
}

/** Quatrefoil — a four-lobed Gothic motif used in stained glass and missals. */
function Quatrefoil({ className = "" }: { className?: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 6 C26 6 26 14 20 14 C14 14 14 6 20 6 Z" />
      <path d="M20 26 C26 26 26 34 20 34 C14 34 14 26 20 26 Z" />
      <path d="M6 20 C6 14 14 14 14 20 C14 26 6 26 6 20 Z" />
      <path d="M26 20 C26 14 34 14 34 20 C34 26 26 26 26 20 Z" />
      <circle cx="20" cy="20" r="1.5" fill="currentColor" />
    </svg>
  );
}
