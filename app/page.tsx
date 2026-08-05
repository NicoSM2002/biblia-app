"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LatinCross } from "@/components/Cross";
import { formatReference, splitVersal } from "@/components/VerseCard";
import { HomeAvatar } from "@/components/HomeAvatar";
import { BottomNav } from "@/components/BottomNav";
import { Splash } from "@/components/Splash";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { apiUrl } from "@/lib/api-url";
import {
  createClient,
  hasLocalSession,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

const ACROSTIC =
  /\((?:Alef|Bet|Guímel|Guimel|Dálet|Dalet|He|Vau|Zain|Jet|Tet|Yod|Kaf|Lámed|Lamed|Mem|Nun|Sámec|Samec|Ain|Pe|Sade|Kof|Cof|Res|Sin|Sín|Shin|Tau)\)\s*/gi;

type Verse = { reference: string; text: string };

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [verse, setVerse] = useState<Verse | null>(null);
  const speech = useSpeechRecognition({ lang: "es-ES" });

  // Mirror the live transcript into the input as the user speaks. We
  // store it as `question` so the form submits the same field whether
  // the user typed or dictated.
  useEffect(() => {
    if (speech.listening || speech.transcript) {
      setQuestion(speech.transcript);
    }
  }, [speech.transcript, speech.listening]);

  // Read user name (if signed in) for the personalized greeting.
  useEffect(() => {
    if (!isSupabaseConfigured() || !hasLocalSession()) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata as
        | { full_name?: string; name?: string }
        | undefined;
      const n = meta?.full_name ?? meta?.name ?? null;
      if (n) setName(firstName(n));
    });
  }, []);

  // Daily verse — cached in sessionStorage so the SECOND time the user
  // navigates to the home in the same session it appears instantly. The
  // network round-trip used to make the verse "pop in late" every visit.
  // Cache keyed by today's date so it auto-invalidates on a new day.
  useEffect(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const cached = sessionStorage.getItem("dailyVerseCache");
      if (cached) {
        const parsed = JSON.parse(cached) as { date: string; verse: Verse };
        if (parsed.date === today && parsed.verse) {
          setVerse(parsed.verse);
          return;
        }
      }
    } catch {
      // ignore
    }
    fetch(apiUrl("/api/daily-verse"))
      .then((r) => r.json())
      .then((d: { verse?: Verse }) => {
        if (d.verse) {
          setVerse(d.verse);
          try {
            const today = new Date().toISOString().slice(0, 10);
            sessionStorage.setItem(
              "dailyVerseCache",
              JSON.stringify({ date: today, verse: d.verse }),
            );
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {
        // optional — the rest of the home still works
      });
  }, []);

  function goToChat(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    try {
      sessionStorage.setItem("pendingQuestion", trimmed);
    } catch {
      // ignore
    }
    router.push("/chat");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    goToChat(question);
  }

  return (
    <div className="relative h-[100dvh] flex flex-col overflow-hidden">
      <header className="page-head-fade px-5 sm:px-6 pt-3.5 pb-2 border-b border-[var(--rule)] bg-[var(--paper)]">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <LatinCross className="text-[var(--gold)] shrink-0" size={16} />
            <h1 className="font-sans text-[0.98rem] font-medium text-[var(--ink)] truncate">
              Habla con la Palabra
            </h1>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <ThemeToggle />
            <HomeAvatar />
          </div>
        </div>
      </header>

      {/* pb reserves exactly the nav (52px + 6px top pad + safe area) plus a
          breath, instead of the old pb-32 which reserved 128px of nothing. */}
      <main
        className="page-content-fade flex-1 overflow-y-auto"
        style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-2xl mx-auto px-5 sm:px-6 pt-3.5">
          <Greeting name={name} />

          {/* Versículo del día — now the first thing on the page and the only
              thing on it shaped like a window. When you open a devotional app,
              receiving comes before asking; putting the verse third, in the
              same 12px rectangle as the parish CTA, buried the one moment
              worth remembering. Skeleton while loading so the layout doesn't
              shift when the fetch comes back; on subsequent visits in the same
              session it's instant via sessionStorage cache. */}
          <div className="mt-2.5">
            {verse ? (
              <DailyVerseSection verse={verse} />
            ) : (
              <DailyVerseSkeleton />
            )}
          </div>

          <div>
            <h2 className="mt-4 font-display text-[1.36rem] sm:text-page leading-[1.18] text-[var(--ink)] mb-2.5">
              ¿Qué quieres preguntarle a Dios hoy?
            </h2>

            <form onSubmit={onSubmit}>
              <div className="flex items-center gap-2 bg-[var(--surface)] border-[1.5px] border-[var(--rule)] rounded-full pl-5 pr-1.5 py-1 transition-all shadow-[0_1px_0_var(--emboss)_inset] focus-within:border-[var(--marian)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--marian)_14%,transparent)]">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => {
                    setQuestion(e.target.value);
                    if (speech.listening) speech.stop();
                    if (!e.target.value) speech.reset();
                  }}
                  placeholder={
                    speech.listening ? "Escuchando…" : "Escribe o dicta tu pregunta…"
                  }
                  className="flex-1 bg-transparent outline-none font-sans text-[0.96rem] text-[var(--ink)] placeholder:text-[var(--ink-faint)] py-2"
                  aria-label="Escribe tu pregunta"
                />
                <ActionButton
                  speech={speech}
                  hasText={question.trim().length > 0}
                  onSend={() => goToChat(question)}
                  onStartVoice={() => {
                    speech.reset();
                    setQuestion("");
                    speech.start();
                  }}
                  onStopVoice={() => speech.stop()}
                />
              </div>
            </form>
          </div>

          <section className="mt-3.5">
            <Link
              href="/misas"
              className="lift-on-hover flex items-center gap-3 bg-[var(--surface)] border border-[var(--rule)] rounded-2xl p-3 shadow-[0_1px_0_var(--emboss)_inset] hover:border-[var(--marian)]"
            >
              <div
                className="grid place-items-center w-10 h-10 rounded-xl shrink-0"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--marian) 11%, transparent)",
                  color: "var(--marian)",
                }}
              >
                <PinIcon />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-sans font-semibold text-[0.95rem] text-[var(--ink)] leading-snug">
                  Misa cerca de ti
                </p>
                <p className="mt-0.5 font-sans text-[0.82rem] text-[var(--ink-soft)]">
                  Horarios y cómo llegar.
                </p>
              </div>
            </Link>
          </section>
        </div>
      </main>

      <BottomNav />

      <Splash />
    </div>
  );
}

/** Same arch, same padding, so nothing shifts when the verse arrives. */
function DailyVerseSkeleton() {
  return (
    <section aria-label="Cargando el versículo del día">
      <div className="arch-panel">
        <div className="arch-body space-y-2.5">
          <div className="h-5 skeleton-shimmer w-full" />
          <div className="h-5 skeleton-shimmer w-[92%]" />
          <div className="h-5 skeleton-shimmer w-[68%]" />
          <div className="h-3 skeleton-shimmer w-28 mx-auto !mt-5" />
        </div>
      </div>
    </section>
  );
}

function DailyVerseSection({ verse }: { verse: Verse }) {
  const display = verse.text
    .replace(ACROSTIC, "")
    .replace(/\s*\|\s*/g, " — ")
    .trim();
  const { initial, rest } = splitVersal(display);

  return (
    <section aria-label="Versículo del día">
      <div className="arch-panel">
        <div className="arch-body">
          {initial && (
            <span aria-hidden="true" className="versal">
              {initial}
            </span>
          )}
          <blockquote
            cite={verse.reference}
            className="font-serif text-[1.08rem] sm:text-[1.24rem] leading-[1.44] text-[var(--ink)]"
            style={{ textWrap: "pretty" as React.CSSProperties["textWrap"] }}
          >
            <span className="sr-only">{initial}</span>
            {rest}
          </blockquote>
          <p className="ref-rule">{formatReference(verse.reference)}</p>
        </div>
      </div>
    </section>
  );
}

function Greeting({ name }: { name: string | null }) {
  const period = useGreetingPeriod();
  const text =
    period === "morning"
      ? "¡Buenos días"
      : period === "afternoon"
        ? "¡Buenas tardes"
        : "¡Buenas noches";
  return (
    <p className="font-sans text-[0.88rem] text-[var(--ink-soft)]">
      {text}
      {name ? `, ${name}` : ""}!
    </p>
  );
}

function useGreetingPeriod(): "morning" | "afternoon" | "night" {
  const [period, setPeriod] = useState<"morning" | "afternoon" | "night">(
    "morning",
  );
  useEffect(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) setPeriod("morning");
    else if (h >= 12 && h < 19) setPeriod("afternoon");
    else setPeriod("night");
  }, []);
  return period;
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="9" y1="22" x2="15" y2="22" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

/**
 * The single round button at the right edge of the input. Its meaning
 * depends on context:
 *   - listening   → stop dictation
 *   - has text    → send (submit)
 *   - empty + idle → start dictation
 * If the browser doesn't support speech recognition, it falls back to
 * a permanent "send" button (typing only).
 */
function ActionButton({
  speech,
  hasText,
  onSend,
  onStartVoice,
  onStopVoice,
}: {
  speech: ReturnType<typeof useSpeechRecognition>;
  hasText: boolean;
  onSend: () => void;
  onStartVoice: () => void;
  onStopVoice: () => void;
}) {
  if (speech.listening) {
    return (
      <button
        type="button"
        onClick={onStopVoice}
        aria-label="Detener dictado"
        className="relative grid place-items-center w-11 h-11 rounded-full bg-[var(--vino)] text-white hover:opacity-90 active:scale-95 transition-all"
      >
        <span aria-hidden="true" className="absolute inset-0 rounded-full bg-[var(--vino)] opacity-40 animate-ping" />
        <span className="relative">
          <StopIcon />
        </span>
      </button>
    );
  }
  if (hasText) {
    return (
      <button
        type="submit"
        aria-label="Enviar pregunta"
        className="grid place-items-center w-11 h-11 rounded-full bg-[var(--gold)] text-[var(--button-on-gold)] hover:bg-[var(--gold-soft)] active:scale-95 transition-all"
        onClick={(e) => {
          // Use submit handler if inside form; otherwise call directly
          if (!e.currentTarget.form) {
            e.preventDefault();
            onSend();
          }
        }}
      >
        <SendIcon />
      </button>
    );
  }
  if (!speech.supported) {
    // Browser doesn't support speech recognition — only the keyboard
    // works. Show a passive send icon (no action since there's no text).
    return (
      <span
        aria-hidden="true"
        className="grid place-items-center w-11 h-11 rounded-full bg-[var(--rule)] text-[var(--ink-faint)]"
      >
        <SendIcon />
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onStartVoice}
      aria-label="Dictar pregunta"
      className="grid place-items-center w-11 h-11 rounded-full bg-[var(--gold)] text-[var(--button-on-gold)] hover:bg-[var(--gold-soft)] active:scale-95 transition-all"
    >
      <MicIcon />
    </button>
  );
}

function PinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
