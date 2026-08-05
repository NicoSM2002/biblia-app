"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { formatReference } from "@/components/VerseCard";
import { apiUrl } from "@/lib/api-url";

const NAV_RESERVE_PX = 88;

type Verse = { reference: string; text: string };

type Phase = "select" | "praying" | "ended";

const DURATIONS = [1, 3, 5, 10] as const; // minutes

const ACROSTIC =
  /\((?:Alef|Bet|Guímel|Guimel|Dálet|Dalet|He|Vau|Zain|Jet|Tet|Yod|Kaf|Lámed|Lamed|Mem|Nun|Sámec|Samec|Ain|Pe|Sade|Kof|Cof|Res|Sin|Sín|Shin|Tau)\)\s*/gi;

/**
 * Modo Oración — a quiet, distraction-free surface for silent prayer.
 *
 * The page now respects the active theme (light or dark) instead of
 * forcing a hardcoded dark "chapel" palette. The user asked for that
 * explicitly: if I'm in light mode, this should be light too.
 */
export default function OracionPage() {
  const [phase, setPhase] = useState<Phase>("select");
  const [durationMin, setDurationMin] = useState<number>(1);
  const [secondsLeft, setSecondsLeft] = useState<number>(60);
  const [paused, setPaused] = useState(false);
  const [verse, setVerse] = useState<Verse | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/daily-verse"))
      .then((r) => r.json())
      .then((d: { verse?: Verse }) => {
        if (d.verse) setVerse(d.verse);
      })
      .catch(() => {
        // verse is optional
      });
  }, []);

  useEffect(() => {
    if (phase !== "praying" || paused) return;
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setPhase("ended");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phase, paused]);

  function start(min: number) {
    setDurationMin(min);
    setSecondsLeft(min * 60);
    setPaused(false);
    setPhase("praying");
  }

  function extend() {
    setSecondsLeft((s) => s + 60);
    setPhase("praying");
    setPaused(false);
  }

  const display = verse
    ? `“${verse.text.replace(ACROSTIC, "").replace(/\s*\|\s*/g, " — ").trim()}”`
    : "";

  return (
    <div className="relative h-[100dvh] flex flex-col overflow-hidden no-print bg-[var(--paper)] text-[var(--ink)]">
      {/* Soft gold radial behind the prayer area — works in both light
          and dark themes because rgba(184,146,74) is the brand gold. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 35%, rgba(184, 146, 74, 0.10) 0%, transparent 65%)",
        }}
      />

      {/* A soft vignette closes the screen like a chapel in half-light — in
          light mode too, which is where the prayer screen most needed it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 72% 54% at 50% 42%, transparent 40%, color-mix(in srgb, var(--ink) 9%, transparent) 100%)",
        }}
      />

      <header className="relative z-10 px-5 sm:px-6 pt-6 pb-6 flex items-center justify-center">
        <p className="font-sans text-[0.78rem] tracking-[0.28em] uppercase text-[var(--gold-text)] font-semibold">
          Modo oración
        </p>
      </header>

      <main
        className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center min-h-0"
        style={{ paddingBottom: `calc(${NAV_RESERVE_PX}px + env(safe-area-inset-bottom))` }}
      >
        {phase === "select" && <SelectPhase onStart={start} />}
        {phase === "praying" && (
          <PrayingPhase
            secondsLeft={secondsLeft}
            durationMin={durationMin}
            paused={paused}
            onTogglePause={() => setPaused((p) => !p)}
            onEnd={() => setPhase("ended")}
            verse={verse}
            verseDisplay={display}
          />
        )}
        {phase === "ended" && (
          <EndedPhase
            verse={verse}
            verseDisplay={display}
            onExtend={extend}
          />
        )}
      </main>

      <BottomNav />
    </div>
  );
}

function SelectPhase({ onStart }: { onStart: (min: number) => void }) {
  return (
    <div className="max-w-md w-full">
      <div
        className="mb-7 grid place-items-center detail-fade-in"
        style={{ animationDelay: "0ms" }}
      >
        <PrayingHandsIcon />
      </div>
      <h1
        className="font-display font-display-lg text-page sm:text-hero leading-[1.2] text-[var(--ink)] mb-3 detail-fade-in"
        style={{ animationDelay: "60ms" }}
      >
        Tómate un momento para hablar con Él.
      </h1>
      <p
        className="font-sans text-[1rem] text-[var(--ink-soft)] leading-relaxed mb-8 detail-fade-in"
        style={{ animationDelay: "120ms" }}
      >
        Elige cuánto tiempo quieres dedicar al silencio.
      </p>
      <div
        className="grid grid-cols-2 gap-3 max-w-xs mx-auto detail-fade-in"
        style={{ animationDelay: "180ms" }}
      >
        {DURATIONS.map((min) => (
          <button
            key={min}
            onClick={() => onStart(min)}
            className="py-3.5 rounded-full border border-[var(--rule)] bg-[var(--surface)] text-[var(--ink)] shadow-[0_1px_0_var(--emboss)_inset] hover:border-[var(--marian)] hover:text-[var(--marian)] transition-colors font-sans font-medium text-[1rem] active:scale-95"
            style={{ touchAction: "manipulation" }}
          >
            {min} min
          </button>
        ))}
      </div>
    </div>
  );
}

function PrayingPhase({
  secondsLeft,
  durationMin,
  paused,
  onTogglePause,
  onEnd,
  verse,
  verseDisplay,
}: {
  secondsLeft: number;
  durationMin: number;
  paused: boolean;
  onTogglePause: () => void;
  onEnd: () => void;
  verse: Verse | null;
  verseDisplay: string;
}) {
  const totalSeconds = durationMin * 60;
  const progress = 1 - secondsLeft / totalSeconds;

  const min = Math.floor(secondsLeft / 60);
  const sec = secondsLeft % 60;
  const timeText = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;

  return (
    <div className="w-full max-w-md flex flex-col items-center">
      <p className="font-display text-title leading-[1.25] text-[var(--ink)] mb-6">
        Respira. Dios está contigo.
      </p>

      <ProgressRing progress={progress} size={190}>
        <div className="text-center">
          <p className="font-display-num text-display leading-none text-[var(--ink)]">
            {timeText}
          </p>
          <p className="font-sans font-semibold text-[0.7rem] tracking-[0.2em] uppercase text-[var(--gold-text)] mt-1.5">
            {paused ? "Pausado" : "Silencio"}
          </p>
        </div>
      </ProgressRing>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={onTogglePause}
          aria-label={paused ? "Reanudar" : "Pausar"}
          className="grid place-items-center w-14 h-14 rounded-full bg-[var(--gold)] text-[var(--button-on-gold)] hover:bg-[var(--gold-soft)] active:scale-95 transition-all"
          style={{ touchAction: "manipulation" }}
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
        </button>
        <button
          onClick={onEnd}
          aria-label="Terminar"
          className="grid place-items-center w-12 h-12 rounded-full border border-[color-mix(in_srgb,var(--marian)_32%,transparent)] text-[var(--marian)] hover:bg-[color-mix(in_srgb,var(--marian)_10%,transparent)] active:scale-95 transition-all"
          style={{ touchAction: "manipulation" }}
        >
          <StopIcon />
        </button>
      </div>

      {/* No card. On a screen whose whole job is to remove distraction, a
          bordered rectangle is a distraction. Text and reference, nothing
          else. */}
      {verse && (
        <div className="mt-7 max-w-[28ch]">
          <p className="font-serif text-[1.06rem] leading-[1.5] text-[var(--ink)]">
            {verseDisplay}
          </p>
          <p className="ref-rule justify-center">
            {formatReference(verse.reference)}
          </p>
        </div>
      )}
    </div>
  );
}

function EndedPhase({
  verse,
  verseDisplay,
  onExtend,
}: {
  verse: Verse | null;
  verseDisplay: string;
  onExtend: () => void;
}) {
  return (
    <div className="max-w-md w-full">
      <div className="mb-5 grid place-items-center">
        <PrayingHandsIcon />
      </div>
      <p className="font-sans font-semibold text-[0.7rem] tracking-[0.24em] uppercase text-[var(--gold-text)] mb-2">
        El silencio fue oración
      </p>
      <h2 className="font-display font-display-lg text-page leading-[1.2] text-[var(--ink)] mb-6">
        Dios te escuchó.
      </h2>

      {verse && (
        <div className="mb-7 max-w-[30ch] mx-auto">
          <p className="font-serif text-[1.06rem] leading-[1.5] text-[var(--ink)]">
            {verseDisplay}
          </p>
          <p className="ref-rule justify-center">
            {formatReference(verse.reference)}
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch gap-3 max-w-sm mx-auto">
        <button
          onClick={onExtend}
          className="flex-1 py-3 rounded-full border border-[var(--rule)] bg-[var(--surface)] text-[var(--ink)] shadow-[0_1px_0_var(--emboss)_inset] hover:border-[var(--marian)] hover:text-[var(--marian)] transition-colors font-sans text-[0.95rem] font-medium active:scale-95"
          style={{ touchAction: "manipulation" }}
        >
          Extender 1 minuto
        </button>
        <Link
          href="/"
          className="flex-1 py-3 rounded-full bg-[var(--gold)] text-[var(--button-on-gold)] hover:bg-[var(--gold-soft)] active:scale-95 transition-all font-sans text-[0.95rem] font-medium text-center"
          style={{ touchAction: "manipulation" }}
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

/**
 * The timer ring — a candle burning down rather than a progress bar.
 *
 * It was a 2px circular progress bar: correct, and mute. Three things make it
 * say something instead:
 *   - 3px stroke, so the arc reads as a body of light and not a hairline;
 *   - a glowing point at the head of the arc — the flame, which is where the
 *     wax is being spent right now;
 *   - a halo inside that breathes on a 4.8s cycle, slower than a resting
 *     breath, so it leads the user down rather than along.
 *
 * The head dot is placed with plain trigonometry rather than a rotated group
 * so it stays put when the SVG is scaled.
 */
function ProgressRing({
  progress,
  size,
  children,
}: {
  progress: number;
  size: number;
  children: React.ReactNode;
}) {
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  const offset = c * (1 - p);

  // Head of the arc, measured from 12 o'clock going clockwise.
  const angle = (p * 360 - 90) * (Math.PI / 180);
  const headX = size / 2 + r * Math.cos(angle);
  const headY = size / 2 + r * Math.sin(angle);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <span
        aria-hidden="true"
        className="halo-breathe absolute rounded-full"
        style={{
          inset: size * 0.13,
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--gold) 24%, transparent), transparent 70%)",
        }}
      />
      <svg
        width={size}
        height={size}
        className="absolute inset-0"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--rule)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--gold)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 1000ms linear" }}
        />
        {p > 0.005 && (
          <circle
            cx={headX}
            cy={headY}
            r={stroke * 1.6}
            fill="var(--gold)"
            style={{
              filter: "drop-shadow(0 0 7px var(--gold))",
              transition: "cx 1000ms linear, cy 1000ms linear",
            }}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

function PrayingHandsIcon() {
  return (
    <div
      className="grid place-items-center w-16 h-16 rounded-full"
      style={{
        background: "rgba(184, 146, 74, 0.12)",
        border: "1px solid rgba(184, 146, 74, 0.3)",
      }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 21V8.5a2 2 0 0 0-2-2 2 2 0 0 0-2 2V14l-2-1.5" />
        <path d="M13 21V8.5a2 2 0 0 1 2-2 2 2 0 0 1 2 2V14l2-1.5" />
        <path d="M9 21h6" />
      </svg>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}
