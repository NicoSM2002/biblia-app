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

  useEffect(() => {
    const el = conversationRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
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
    <div className="relative h-[100dvh] flex flex-col bg-[var(--paper)] overflow-hidden">
      <Header onReset={reset} />

      <main className="relative z-10 flex-1 flex flex-col min-h-0">
        <div ref={conversationRef} className="flex-1 overflow-y-auto px-4 sm:px-8 min-h-0">
          <div className="max-w-2xl mx-auto py-4 sm:py-6">
            {empty ? (
              <EmptyState onPick={ask} />
            ) : (
              turns.map((t) => (
                <article key={t.id} className="mb-8">
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

        <div className="relative z-10 px-4 sm:px-8 pt-3 pb-5 sm:pb-7 border-t border-[var(--rule)] bg-[var(--paper)]">
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
    <div className="anim-fade-rise space-y-4 pb-4">
      <div className="card-welcome">
        <h2 className="font-serif italic text-[1.2rem] sm:text-[1.4rem] text-[var(--ink)] leading-[1.35] mb-2">
          Pregúntale a la Sagrada Escritura.
        </h2>
        <p className="font-sans text-[0.9rem] sm:text-[0.96rem] text-[var(--ink-soft)] leading-[1.55]">
          Una duda, un dolor, una alegría. La Palabra responde con un versículo y una explicación cercana.
        </p>
      </div>

      <div>
        <p className="label-section">Prueba con</p>
        <div className="flex flex-wrap gap-2">
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
