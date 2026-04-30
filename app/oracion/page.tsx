"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";

// Heights — keep in sync with BottomNav so the prayer surface knows how
// much vertical room to leave at the bottom.
const NAV_RESERVE_PX = 88;

type Verse = { reference: string; text: string };

type Phase = "select" | "praying" | "ended";

const DURATIONS = [1, 3, 5, 10] as const; // minutes

const ACROSTIC =
  /\((?:Alef|Bet|Guímel|Guimel|Dálet|Dalet|He|Vau|Zain|Jet|Tet|Yod|Kaf|Lámed|Lamed|Mem|Nun|Sámec|Samec|Ain|Pe|Sade|Kof|Cof|Res|Sin|Sín|Shin|Tau)\)\s*/gi;

/**
 * Modo Oración — a quiet, dark, distraction-free surface for silent
 * prayer. The user picks a duration, starts the timer, and meditates on
 * a Scripture verse. When the time elapses they're invited to extend
 * (+1 min) or come back to the home.
 *
 * Design choices:
 * - Always dark, regardless of the app's light/dark theme. The chapel
 *   atmosphere needs the dark backdrop.
 * - The bottom nav is hidden during the actual prayer, so nothing
 *   competes with the silence.
 */
export default function OracionPage() {
  const [phase, setPhase] = useState<Phase>("select");
  const [durationMin, setDurationMin] = useState<number>(1);
  const [secondsLeft, setSecondsLeft] = useState<number>(60);
  const [paused, setPaused] = useState(false);
  const [verse, setVerse] = useState<Verse | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Fetch a verse to meditate on as soon as the user enters the page
  useEffect(() => {
    fetch("/api/daily-verse")
      .then((r) => r.json())
      .then((d: { verse?: Verse }) => {
        if (d.verse) setVerse(d.verse);
      })
      .catch(() => {
        // verse is optional — silence is the point
      });
  }, []);

  // Timer
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
    <div
      className="relative h-[100dvh] flex flex-col overflow-hidden no-print"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 30%, #2a1f12 0%, #120a06 60%, #0a0604 100%)",
        color: "#F2EBD9",
      }}
    >
      {/* Soft candle-flicker glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 80%, rgba(255, 180, 90, 0.18) 0%, transparent 45%)",
        }}
      />

      {/* Header — no close button. The bottom nav already gives a way out
          (Inicio / Conversación / Parroquias), so a redundant X just adds
          chrome to a surface that should feel like a quiet chapel. */}
      <header className="relative z-10 px-5 pt-6 pb-2 flex items-center justify-center">
        <p className="font-sans text-[0.68rem] tracking-[0.28em] uppercase text-[#D4AC6A]">
          Modo oración
        </p>
      </header>

      <main
        className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center min-h-0"
        style={{ paddingBottom: `calc(${NAV_RESERVE_PX}px + env(safe-area-inset-bottom))` }}
      >
        {phase === "select" && (
          <SelectPhase onStart={start} />
        )}
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
      <div className="mb-7 grid place-items-center">
        <PrayingHandsIcon />
      </div>
      <h1 className="font-serif italic text-[1.6rem] sm:text-[1.85rem] leading-[1.3] mb-3">
        Tómate un momento para hablar con Él.
      </h1>
      <p className="font-sans text-[0.95rem] text-[#F2EBD9]/70 leading-relaxed mb-8">
        Elige cuánto tiempo quieres dedicar al silencio.
      </p>
      <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
        {DURATIONS.map((min) => (
          <button
            key={min}
            onClick={() => onStart(min)}
            className="py-3.5 rounded-full border border-[#D4AC6A]/40 text-[#F2EBD9] hover:bg-[#D4AC6A]/15 hover:border-[#D4AC6A] transition-colors font-sans text-[0.95rem]"
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
      <p className="font-serif italic text-[1.4rem] sm:text-[1.55rem] leading-[1.3] mb-2">
        Respira. Dios está contigo.
      </p>
      <p className="font-sans text-[0.92rem] text-[#F2EBD9]/65 leading-relaxed mb-8">
        Tómate un momento para hablar con Él.
      </p>

      <ProgressRing progress={progress} size={220}>
        <div className="text-center">
          <p className="font-serif italic text-[2.6rem] leading-none tabular-nums">
            {timeText}
          </p>
          <p className="font-sans text-[0.7rem] tracking-[0.2em] uppercase text-[#D4AC6A] mt-2">
            {paused ? "Pausado" : "Silencio"}
          </p>
        </div>
      </ProgressRing>

      <div className="mt-7 flex items-center gap-3">
        <button
          onClick={onTogglePause}
          aria-label={paused ? "Reanudar" : "Pausar"}
          className="grid place-items-center w-14 h-14 rounded-full bg-[#D4AC6A] text-[#1F1B16] hover:bg-[#E2BE82] transition-colors"
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
        </button>
        <button
          onClick={onEnd}
          aria-label="Terminar"
          className="grid place-items-center w-12 h-12 rounded-full border border-[#F2EBD9]/30 text-[#F2EBD9]/70 hover:text-[#F2EBD9] hover:bg-white/5 transition-colors"
        >
          <StopIcon />
        </button>
      </div>

      {verse && (
        <div
          className="mt-9 rounded-xl px-5 py-4 max-w-md w-full"
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(212, 172, 106, 0.25)",
          }}
        >
          <p className="font-sans text-[0.66rem] tracking-[0.24em] uppercase text-[#D4AC6A] mb-2">
            Palabra para orar
          </p>
          <p className="font-sans text-[0.78rem] tracking-[0.12em] uppercase text-[#F2EBD9]/85 mb-2">
            {verse.reference}
          </p>
          <p className="font-serif italic text-[1.02rem] leading-[1.55] text-[#F2EBD9]/90">
            {verseDisplay}
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
      <div className="mb-6 grid place-items-center">
        <PrayingHandsIcon />
      </div>
      <p className="font-sans text-[0.7rem] tracking-[0.24em] uppercase text-[#D4AC6A] mb-3">
        El silencio fue oración
      </p>
      <h2 className="font-serif italic text-[1.55rem] sm:text-[1.75rem] leading-[1.3] mb-3">
        Dios te escuchó.
      </h2>
      <p className="font-sans text-[0.95rem] text-[#F2EBD9]/70 leading-relaxed mb-7">
        Lleva su Palabra contigo el resto del día.
      </p>

      {verse && (
        <div
          className="rounded-xl px-5 py-4 mb-7 text-left"
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(212, 172, 106, 0.25)",
          }}
        >
          <p className="font-sans text-[0.78rem] tracking-[0.12em] uppercase text-[#D4AC6A] mb-2">
            {verse.reference}
          </p>
          <p className="font-serif italic text-[1.02rem] leading-[1.55] text-[#F2EBD9]/90">
            {verseDisplay}
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch gap-3 max-w-sm mx-auto">
        <button
          onClick={onExtend}
          className="flex-1 py-3 rounded-full border border-[#D4AC6A]/40 text-[#F2EBD9] hover:bg-[#D4AC6A]/15 hover:border-[#D4AC6A] transition-colors font-sans text-[0.92rem] font-medium"
        >
          Extender 1 minuto
        </button>
        <Link
          href="/"
          className="flex-1 py-3 rounded-full bg-[#D4AC6A] text-[#1F1B16] hover:bg-[#E2BE82] transition-colors font-sans text-[0.92rem] font-medium text-center"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

function ProgressRing({
  progress,
  size,
  children,
}: {
  progress: number;
  size: number;
  children: React.ReactNode;
}) {
  const stroke = 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(1, progress)));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="absolute inset-0 -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(212, 172, 106, 0.18)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#D4AC6A"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1000ms linear" }}
        />
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
        background: "rgba(212, 172, 106, 0.12)",
        border: "1px solid rgba(212, 172, 106, 0.3)",
      }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D4AC6A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
