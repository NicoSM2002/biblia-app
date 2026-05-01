"use client";

import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { VerseCard } from "@/components/VerseCard";
import { ResponseText } from "@/components/ResponseText";
import { QuestionLine } from "@/components/QuestionLine";
import { Loading } from "@/components/Loading";
import { ChatInput } from "@/components/ChatInput";
import { HistorySheet } from "@/components/HistorySheet";
import { BottomNav } from "@/components/BottomNav";
import { TurnActions } from "@/components/TurnActions";
import { apiUrl } from "@/lib/api-url";
import { authFetch } from "@/lib/auth-fetch";
import {
  createClient,
  hasLocalSession,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

type Turn = {
  id: string;
  question: string;
  verse?: { reference: string; text: string } | null;
  response?: string;
  status: "loading" | "streaming" | "done" | "error";
  error?: string;
  /** Whether the user marked this turn with a heart. Only persisted for
   *  signed-in users (in the turns table). */
  liked?: boolean;
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
  const [signedIn, setSignedIn] = useState<boolean>(() => hasLocalSession());
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

  // If the user typed a question on the home and pressed Enter (or tapped a
  // suggestion chip), it's stashed in sessionStorage. Pick it up on mount
  // and send it as the first turn so they land directly inside the answer.
  const pendingHandledRef = useRef(false);
  useEffect(() => {
    if (pendingHandledRef.current) return;
    pendingHandledRef.current = true;
    try {
      const pending = sessionStorage.getItem("pendingQuestion");
      if (pending) {
        sessionStorage.removeItem("pendingQuestion");
        void ask(pending);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /**
   * Toggle the heart on a turn. Optimistic update so the UI flips
   * instantly, then sync to the database in the background. If the user
   * isn't signed in we just keep the like in local state — it'll vanish
   * with the conversation when they navigate away (which is fine; the
   * heart only really makes sense for persisted convos).
   */
  function toggleLike(turnId: string, ord: number) {
    let nextLiked = false;
    setTurns((prev) =>
      prev.map((t) => {
        if (t.id !== turnId) return t;
        nextLiked = !t.liked;
        return { ...t, liked: nextLiked };
      }),
    );

    if (!signedIn) return;
    const conversationId = conversationIdRef.current;
    if (!conversationId) return; // turn not yet persisted, nothing to PATCH

    void authFetch(apiUrl(`/api/conversations/${conversationId}/turns`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ord, liked: nextLiked }),
    }).catch(() => {
      // On failure, roll back the optimistic update so UI matches reality
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId ? { ...t, liked: !nextLiked } : t,
        ),
      );
    });
  }

  async function loadConversation(id: string) {
    if (pending) return;
    try {
      const res = await authFetch(apiUrl(`/api/conversations/${id}`));
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as {
        conversation: { id: string; title: string | null };
        turns: Array<{
          ord: number;
          question: string;
          verse_reference: string | null;
          verse_text: string | null;
          response: string;
          liked?: boolean;
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
        liked: t.liked ?? false,
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
        const res = await authFetch(apiUrl("/api/conversations"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error(`create conversation ${res.status}`);
        const data = (await res.json()) as { conversation: { id: string } };
        conversationIdRef.current = data.conversation.id;
      }
      await authFetch(apiUrl(`/api/conversations/${conversationIdRef.current}/turns`), {
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
      const res = await fetch(apiUrl("/api/chat"), {
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
    <div
      className="relative h-[100dvh] flex flex-col overflow-hidden"
      // Reserve exactly the bottom-nav height (52px content + 6px top
      // padding + safe-area), so the input area sits flush against the
      // top of the nav with no visible gap. pb-[88px] was leaving a
      // visible cream stripe between the input and the nav on devices
      // without safe-area, and getting tapped by the nav on those with
      // it. The calc handles both correctly.
      style={{ paddingBottom: "calc(58px + env(safe-area-inset-bottom))" }}
    >
      <div className="missal-page">
        <Header
          onOpenHistory={signedIn ? () => setHistoryOpen(true) : undefined}
          onReset={turns.length > 0 ? reset : undefined}
          conversationTitle={activeConversationTitle}
          shareableTurns={turns
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
          onDeleted={(id) => {
            // If the user just deleted the conversation they were viewing,
            // wipe the local chat state so they're not staring at orphaned
            // turns from a row that no longer exists.
            if (id === activeConversationId) reset();
          }}
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
                        {t.status === "done" && (t.verse || t.response) && (
                          <TurnActions
                            question={t.question}
                            verse={t.verse ?? null}
                            response={t.response}
                            liked={t.liked ?? false}
                            onToggleLike={() => toggleLike(t.id, i)}
                          />
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

          <div className="relative z-10 px-4 sm:px-8 lg:px-10 pt-2 pb-2 border-t border-[var(--rule)] bg-[var(--paper)]">
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
      <BottomNav />
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
    <div className="pt-2 pb-6">
      {/* Hero card — gold-tinged background with leaf icon, evoking calm */}
      <div
        className="rounded-2xl px-5 py-6 sm:px-6 sm:py-7 mb-7 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(184,146,74,0.08) 0%, rgba(184,146,74,0.04) 100%)",
          border: "1px solid rgba(184, 146, 74, 0.18)",
        }}
      >
        <div className="flex items-start gap-4">
          <p className="font-serif italic text-quote text-[var(--ink)] leading-[1.35] flex-1">
            Dile a Dios lo que hay en tu corazón.
            <br />
            Él siempre te escucha.
          </p>
          <span aria-hidden="true" className="text-[var(--gold-text)] shrink-0 mt-1">
            <LeafIcon />
          </span>
        </div>
      </div>

      <p className="font-sans text-[0.72rem] tracking-[0.18em] uppercase text-[var(--gold-text)] font-semibold mb-3">
        Prueba con
      </p>
      <ul className="space-y-2">
        {EXAMPLES.map((q) => (
          <li key={q}>
            <button
              onClick={() => onPick(q)}
              type="button"
              className="w-full text-left bg-[var(--surface)] border border-[var(--rule)] rounded-full px-5 py-3 font-sans text-[0.92rem] text-[var(--ink)] hover:border-[var(--gold)] hover:bg-[var(--vellum)] transition-colors flex items-center justify-between gap-3"
            >
              <span>{q}</span>
              <span aria-hidden="true" className="text-[var(--ink-faint)] shrink-0">
                <ArrowRight />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LeafIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2c1 1.5 2 4.79 1.5 7-1 3.5-3 5-3 5l-3 3" />
      <path d="M2 22 17 7" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
