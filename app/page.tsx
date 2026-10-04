"use client";

import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { LatinCross } from "@/components/Cross";
import { formatReference, splitVersal } from "@/components/VerseCard";
import { localDateKey } from "@/lib/daily-verses";
import type { DailyGospel } from "@/lib/daily-gospel";
import { speakable, toggle, useTts } from "@/lib/tts";
import { PauseIcon, ReadAloudPlayer, SpeakerIcon } from "@/components/ReadAloudPlayer";
import { HomeAvatar } from "@/components/HomeAvatar";
import { BottomNav, NAV_H } from "@/components/BottomNav";
import { Splash } from "@/components/Splash";
import { SettingsButton } from "@/components/SettingsSheet";
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
type Daily = { verse: Verse; gospel?: DailyGospel };

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [daily, setDaily] = useState<Daily | null>(null);
  const mainRef = useRef<HTMLElement>(null);
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

  // Evangelio del día — cached in sessionStorage so the SECOND time the user
  // navigates to the home in the same session it appears instantly. The
  // network round-trip used to make the verse "pop in late" every visit.
  // Cache keyed by the user's local date so it auto-invalidates at their
  // midnight (toISOString() would be UTC — hours off in the Americas).
  useEffect(() => {
    const today = localDateKey();
    try {
      const cached = sessionStorage.getItem("dailyGospelCache");
      if (cached) {
        const parsed = JSON.parse(cached) as { date: string; daily: Daily };
        if (parsed.date === today && parsed.daily?.verse) {
          setDaily(parsed.daily);
          return;
        }
      }
    } catch {
      // ignore
    }
    fetch(apiUrl(`/api/daily-verse?date=${today}`))
      .then((r) => r.json())
      .then((d: { verse?: Verse; gospel?: DailyGospel }) => {
        if (d.verse) {
          const next: Daily = { verse: d.verse, gospel: d.gospel };
          setDaily(next);
          // Only cache the real Gospel; a fallback verse should be retried
          // on the next visit in case the liturgical feed is back.
          if (!d.gospel) return;
          try {
            sessionStorage.setItem(
              "dailyGospelCache",
              JSON.stringify({ date: today, daily: next }),
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
      {/* relative z-20: the header's fade-in makes it a stacking context, so
          the avatar menu's own z-index can't escape it — without this the
          menu opened BEHIND the Gospel card. */}
      <header className="page-head-fade relative z-20 px-5 sm:px-6 pt-3.5 pb-2 border-b border-[var(--rule)] bg-[var(--paper)]">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <LatinCross className="text-[var(--gold)] shrink-0" size={16} />
            <h1 className="font-sans text-[0.98rem] font-medium text-[var(--ink)] truncate">
              Habla con la Palabra
            </h1>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <SettingsButton />
            <HomeAvatar />
          </div>
        </div>
      </header>

      <ReadAloudPlayer />

      {/* pb reserves exactly the nav (52px + 6px top pad + safe area) plus a
          breath, instead of the old pb-32 which reserved 128px of nothing. */}
      <main
        ref={mainRef}
        className="page-content-fade flex-1 overflow-y-auto"
        style={{ paddingBottom: `calc(${NAV_H} + 8px)` }}
      >
        <div className="max-w-2xl mx-auto px-5 sm:px-6 pt-3.5 min-h-full flex flex-col">
          <Greeting name={name} />

          {/* Evangelio del día — now the first thing on the page and the only
              thing on it shaped like a window. When you open a devotional app,
              receiving comes before asking; putting the verse third, in the
              same 12px rectangle as the parish CTA, buried the one moment
              worth remembering. Skeleton while loading so the layout doesn't
              shift when the fetch comes back; on subsequent visits in the same
              session it's instant via sessionStorage cache. If the liturgical
              feed is down we get a single pool verse instead. */}
          <div className="mt-2.5">
            {daily?.gospel ? (
              <DailyGospelSection gospel={daily.gospel} />
            ) : daily ? (
              <DailyVerseSection verse={daily.verse} />
            ) : (
              <DailyVerseSkeleton />
            )}
          </div>

          <div>
            {/* text-wrap: balance splits the question into two even lines
                instead of "¿Qué quieres" alone on top and the rest below. */}
            <h2
              className="mt-4 text-center font-display text-[1.24rem] sm:text-page leading-[1.2] text-[var(--ink)] mb-2.5"
              style={{ textWrap: "balance" as React.CSSProperties["textWrap"] }}
            >
              ¿Qué quieres preguntarle a la Palabra de Dios hoy?
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

        </div>
      </main>

      <ScrollHint target={mainRef} />

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

function cleanVerse(text: string): string {
  return text
    .replace(ACROSTIC, "")
    .replace(/\s*\|\s*/g, " — ")
    .trim();
}

/**
 * Collapsed Gospel text: ~3 lines at phone width, cut on a word boundary, so
 * the card leaves room for the input and the "what is this app" note below.
 * Trailing punctuation is swapped for the ellipsis ("país.…" → "país…").
 */
function teaser(text: string, continues: boolean, max = 115): string {
  if (text.length <= max + 20) {
    return continues ? `${text.replace(/[.,;:]\s*$/, "")}…` : text;
  }
  const cut = text.slice(0, text.lastIndexOf(" ", max));
  return `${cut.replace(/[.,;:—\s]+$/, "")}…`;
}

/**
 * The Gospel of the day. Collapsed it shows only the opening verse — the home
 * has to keep the question box above the fold — and expands in place to the
 * whole pericope, so reading it never takes you away from the page.
 */
const PILL =
  "flex items-center gap-1.5 min-h-[40px] px-4 whitespace-nowrap rounded-full border border-[color-mix(in_srgb,var(--gold)_45%,transparent)] bg-[var(--surface)] font-sans text-[0.84rem] font-medium text-[var(--gold-text)] shadow-[0_1px_0_var(--emboss)_inset,0_1px_3px_rgba(0,0,0,0.06)] hover:border-[var(--gold)] active:scale-95 transition-all";

/** What "Escuchar" reads: the liturgical frame around the pericope. */
function gospelSpeech(gospel: DailyGospel): string {
  const book = gospel.reference.split(" ")[0];
  const body = gospel.verses.map((v) => cleanVerse(v.texto)).join(" ");
  return speakable(
    `Lectura del santo Evangelio según san ${book}. ${body} Palabra del Señor.`,
  );
}

function DailyGospelSection({ gospel }: { gospel: DailyGospel }) {
  const [open, setOpen] = useState(false);
  const tts = useTts();
  const ttsId = `gospel:${gospel.reference}`;
  const reading = tts.id === ttsId ? tts.status : "idle";
  const [first, ...more] = gospel.verses;
  const { initial, rest } = splitVersal(cleanVerse(first.texto));

  return (
    <section aria-label="Evangelio del día">
      <div className="arch-panel">
        <div className="arch-body">
          <p className="text-center font-sans text-[0.68rem] font-semibold tracking-[0.2em] uppercase text-[var(--gold-text)]">
            Evangelio del día
          </p>
          <p className="mt-0.5 mb-2.5 text-center font-sans text-[0.8rem] text-[var(--ink-soft)]">
            {gospel.title}
          </p>
          {initial && (
            <span aria-hidden="true" className="versal">
              {initial}
            </span>
          )}
          <blockquote
            cite={gospel.reference}
            className="font-serif text-[1.08rem] sm:text-[1.24rem] leading-[1.44] text-[var(--ink)]"
            style={{ textWrap: "pretty" as React.CSSProperties["textWrap"] }}
          >
            <span className="sr-only">{initial}</span>
            {open ? rest : teaser(rest, more.length > 0)}
            {open &&
              more.map((v) => (
                <span key={`${v.capitulo}:${v.versiculo}`}>
                  {" "}
                  <sup className="font-sans text-[0.62em] text-[var(--gold-text)]">
                    {v.versiculo}
                  </sup>
                  {" "}
                  {cleanVerse(v.texto)}
                </span>
              ))}
          </blockquote>
          <p className="ref-rule">{gospel.reference}</p>
          {/* Bordered pills with icons, not bare text — gold text alone read
              as a caption, and nobody tapped it. */}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {tts.supported && (
              <button
                type="button"
                onClick={() => toggle(ttsId, "Evangelio del día", gospelSpeech(gospel))}
                aria-label={
                  reading === "playing" ? "Pausar la lectura del Evangelio" : "Escuchar el Evangelio"
                }
                className={PILL}
              >
                {reading === "playing" ? <PauseIcon size={14} /> : <SpeakerIcon size={16} />}
                {reading === "playing" ? "Pausar" : reading === "paused" ? "Continuar" : "Escuchar"}
              </button>
            )}
            {more.length > 0 && (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className={PILL}
              >
                {open ? "Mostrar menos" : tts.supported ? "Leer completo" : "Leer el Evangelio completo"}
                <ChevronDown
                  className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}
                />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function DailyVerseSection({ verse }: { verse: Verse }) {
  const display = cleanVerse(verse.text);
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

/**
 * Blinking chevron above the bottom nav that says "there's more below".
 * Shown only while the page actually has content past the fold (the expanded
 * Gospel, or small phones), hidden once you're near the end. Tapping it
 * scrolls most of a screen down. ResizeObserver catches content growing
 * (expanding the Gospel) without a scroll event; it also fires once on
 * observe, which gives us the initial measurement.
 */
function ScrollHint({ target }: { target: RefObject<HTMLElement | null> }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const update = () =>
      setShow(el.scrollHeight - el.clientHeight - el.scrollTop > 48);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [target]);

  return (
    <button
      type="button"
      aria-label="Seguir bajando"
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      onClick={() =>
        target.current?.scrollBy({
          top: target.current.clientHeight * 0.7,
          behavior: "smooth",
        })
      }
      className={`fixed left-1/2 -translate-x-1/2 z-30 grid place-items-center w-10 h-10 rounded-full border border-[color-mix(in_srgb,var(--gold)_45%,transparent)] bg-[var(--surface)] text-[var(--gold-text)] shadow-[0_2px_10px_rgba(0,0,0,0.12)] transition-opacity duration-300 ${
        show ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      // Sits just above BottomNav (same height formula as its padding).
      style={{ bottom: `calc(${NAV_H} + 12px)` }}
    >
      <span className="scroll-hint-bob">
        <ChevronDown size={18} />
      </span>
    </button>
  );
}

function ChevronDown({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

