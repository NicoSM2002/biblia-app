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

    // Cap how much past context we ship to the LLM. The user keeps every
    // turn visible on screen, but only the most recent N go into the
    // prompt — sending the full history of a long conversation makes
    // every send slower and more expensive without meaningfully helping
    // the answer (Claude rarely needs to recall turn #2 of 80).
    const RECENT_HISTORY_TURNS = 10;
    const history = turns
      .filter((t) => t.status === "done" && t.response)
      .slice(-RECENT_HISTORY_TURNS)
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

        <main className="page-content-fade relative z-10 flex-1 flex flex-col min-h-0">
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
      <h1 className="font-display text-2xl text-[var(--ink)]">
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
      {/* The same window as the verse, so the empty state already teaches the
          shape the answer will arrive in. */}
      <div className="arch-panel arch-panel-sm mb-7">
        <div className="arch-body text-center">
          <p className="font-display text-quote text-[var(--ink)] leading-[1.25]">
            Dile a Dios lo que hay en tu corazón.
            <br />
            Él siempre te escucha.
          </p>
        </div>
      </div>

      <p className="font-sans text-[0.7rem] tracking-[0.18em] uppercase text-[var(--gold-text)] font-semibold mb-3">
        Prueba con
      </p>
      <ul className="space-y-2">
        {EXAMPLES.map((q) => (
          <li key={q}>
            <button
              onClick={() => onPick(q)}
              type="button"
              className="group w-full text-left bg-[var(--surface)] border border-[var(--rule)] rounded-full px-5 py-3 font-sans text-[0.92rem] text-[var(--ink)] shadow-[0_1px_0_var(--emboss)_inset] hover:border-[var(--marian)] hover:text-[var(--marian)] transition-colors flex items-center justify-between gap-3"
            >
              <span>{q}</span>
              <span
                aria-hidden="true"
                className="text-[var(--ink-faint)] group-hover:text-[var(--marian)] shrink-0 transition-all duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
              >
                <ArrowRight />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}


function ArrowRight() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="18" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </svg>
  );
}
