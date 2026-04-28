"use client";

import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { VerseCard } from "@/components/VerseCard";
import { ResponseText } from "@/components/ResponseText";
import { QuestionLine } from "@/components/QuestionLine";
import { Loading } from "@/components/Loading";
import { ChatInput } from "@/components/ChatInput";

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
      <Header onReset={reset} />

      <main className="relative z-10 flex-1 flex flex-col min-h-0">
        <div ref={conversationRef} className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-10 min-h-0">
          <div className="max-w-2xl mx-auto py-4 sm:py-6">
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
