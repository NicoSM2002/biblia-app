"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { NAV_H } from "@/components/BottomNav";
import { ReadAloudPlayer } from "@/components/ReadAloudPlayer";
import { formatReference } from "@/components/VerseCard";
import { apiUrl } from "@/lib/api-url";
import { localDateKey } from "@/lib/daily-verses";


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
  // Wall-clock timer: while running we know WHEN it ends (endsAt); while
  // paused we keep what was left (remainingMs). The old version decremented
  // a counter once a second and animated the ring with 1 s CSS transitions:
  // it moved in jumps, iOS Safari didn't animate the head dot at all, and a
  // queued transition kept the ring growing after "Pausar".
  const [totalMs, setTotalMs] = useState(60_000);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(60_000);
  const [secondsLeft, setSecondsLeft] = useState<number>(60);
  const [paused, setPaused] = useState(false);
  const [verse, setVerse] = useState<Verse | null>(null);

  useEffect(() => {
    fetch(apiUrl(`/api/daily-verse?date=${localDateKey()}&tipo=oracion`))
      .then((r) => r.json())
      .then((d: { verse?: Verse }) => {
        if (d.verse) setVerse(d.verse);
      })
      .catch(() => {
        // verse is optional
      });
  }, []);

  // Countdown text + end detection. Polled (not counted) so a throttled tab
  // or a backgrounded phone never drifts: it always reads the real clock.
  useEffect(() => {
    if (phase !== "praying" || paused || endsAt == null) return;
    const tick = () => {
      const left = endsAt - Date.now();
      if (left <= 0) {
        setSecondsLeft(0);
        setPhase("ended");
      } else {
        setSecondsLeft(Math.ceil(left / 1000));
      }
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [phase, paused, endsAt]);

  // Keep the screen on while the timer runs — the moment it dims is exactly
  // when someone praying with their eyes closed would lose the countdown.
  // Only here, not app-wide, so it never drains battery elsewhere. The OS
  // drops the lock when the tab is hidden, so re-request on return.
  // Unsupported browsers (pre-16.4 iOS) just skip it.
  useEffect(() => {
    if (phase !== "praying" || paused || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = () => {
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          if (cancelled) l.release();
          else lock = l;
        })
        .catch(() => {
          // denied (low battery mode, etc.) — the timer still works
        });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, [phase, paused]);

  function run(ms: number) {
    setTotalMs(ms);
    setRemainingMs(ms);
    setSecondsLeft(Math.ceil(ms / 1000));
    setEndsAt(Date.now() + ms);
    setPaused(false);
    setPhase("praying");
  }

  function start(min: number) {
    run(min * 60_000);
  }

  function extend() {
    run(60_000);
  }

  function togglePause() {
    if (paused) {
      setEndsAt(Date.now() + remainingMs);
      setPaused(false);
    } else {
      setRemainingMs(Math.max(0, (endsAt ?? Date.now()) - Date.now()));
      setEndsAt(null);
      setPaused(true);
    }
  }

  // Straubinger text often carries its own opening/closing quote marks;
  // strip them before wrapping, or it reads ““Escuchad…”.
  const display = verse
    ? `“${verse.text
        .replace(ACROSTIC, "")
        .replace(/\s*\|\s*/g, " — ")
        .trim()
        .replace(/^[“"«]+|[”"»]+$/g, "")}”`
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

      <header className="page-head-fade relative z-10 px-5 sm:px-6 pt-6 pb-6 flex items-center justify-center">
        <p className="font-sans text-[0.72rem] tracking-[0.28em] uppercase text-[var(--gold-text)] font-semibold">
          Modo oración
        </p>
      </header>

      <ReadAloudPlayer />

      <main
        className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center min-h-0"
        style={{ paddingBottom: `calc(${NAV_H} + 20px)` }}
      >
        {/* key={phase} remounts this on every phase change, so choosing a
            duration and finishing the silence both get the same arrival the
            rest of the app has. Before, the three phases swapped instantly —
            the one screen in the app whose whole point is calm was also the
            only one that changed with a hard cut. */}
        <div key={phase} className="page-content-fade w-full flex justify-center">
          {phase === "select" && <SelectPhase onStart={start} />}
          {phase === "praying" && (
            <PrayingPhase
              secondsLeft={secondsLeft}
              totalMs={totalMs}
              endsAt={endsAt}
              remainingMs={remainingMs}
              paused={paused}
              onTogglePause={togglePause}
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
        </div>
      </main>

    </div>
  );
}

function SelectPhase({ onStart }: { onStart: (min: number) => void }) {
  return (
    <div className="max-w-md w-full">
      <div
        className="mb-7 grid place-items-center"
        style={{ animationDelay: "0ms" }}
      >
        <PrayingHandsIcon />
      </div>
      <h1
        className="font-display font-display-lg text-page sm:text-hero leading-[1.2] text-[var(--ink)] mb-3"
        style={{ animationDelay: "60ms" }}
      >
        Tómate un momento para hablar con Él.
      </h1>
      <p
        className="font-sans text-[1rem] text-[var(--ink-soft)] leading-relaxed mb-8"
        style={{ animationDelay: "120ms" }}
      >
        Elige cuánto tiempo quieres dedicar al silencio.
      </p>
      <div
        className="grid grid-cols-2 gap-3 max-w-xs mx-auto"
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
  totalMs,
  endsAt,
  remainingMs,
  paused,
  onTogglePause,
  onEnd,
  verse,
  verseDisplay,
}: {
  secondsLeft: number;
  totalMs: number;
  endsAt: number | null;
  remainingMs: number;
  paused: boolean;
  onTogglePause: () => void;
  onEnd: () => void;
  verse: Verse | null;
  verseDisplay: string;
}) {
  const min = Math.floor(secondsLeft / 60);
  const sec = secondsLeft % 60;
  const timeText = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  // Bigger ring on a computer screen, where 190px looked lost.
  const ringSize = useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 1024px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => (window.matchMedia("(min-width: 1024px)").matches ? 260 : 190),
    () => 190,
  );

  return (
    <div className="w-full max-w-md flex flex-col items-center">
      <p className="font-display text-title leading-[1.25] text-[var(--ink)] mb-6">
        Respira. Dios está contigo.
      </p>

      <ProgressRing totalMs={totalMs} endsAt={endsAt} remainingMs={remainingMs} size={ringSize}>
        <div className="text-center">
          <p className="font-display-num text-display lg:text-[56px] leading-none text-[var(--ink)]">
            {timeText}
          </p>
          <p className="font-sans font-semibold text-[0.7rem] tracking-[0.2em] uppercase text-[var(--gold-text)] mt-1.5">
            {paused ? "Pausado" : "Silencio"}
          </p>
        </div>
      </ProgressRing>

      <div className="mt-6 flex items-center gap-3">
        {/* Labelled: a gold circle with ❚❚ and a small square didn't say
            "pause" and "finish" to everyone. */}
        <button
          type="button"
          onClick={onTogglePause}
          className="inline-flex items-center gap-2 min-h-[48px] px-5 rounded-full bg-[var(--gold)] text-[var(--button-on-gold)] font-sans text-[0.95rem] font-semibold hover:bg-[var(--gold-soft)] active:scale-95 transition-all"
          style={{ touchAction: "manipulation" }}
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
          {paused ? "Continuar" : "Pausar"}
        </button>
        <button
          type="button"
          onClick={onEnd}
          className="inline-flex items-center gap-2 min-h-[48px] px-5 rounded-full border border-[color-mix(in_srgb,var(--marian)_32%,transparent)] bg-[var(--surface)] text-[var(--marian)] font-sans text-[0.95rem] font-semibold hover:bg-[color-mix(in_srgb,var(--marian)_10%,transparent)] active:scale-95 transition-all"
          style={{ touchAction: "manipulation" }}
        >
          <StopIcon />
          Terminar
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
/**
 * The prayer ring. Redrawn every frame from the real clock (endsAt), so it
 * moves continuously and stops dead on pause. Attributes are written straight
 * to the SVG via refs — no React re-render per frame. The head dot rotates
 * around the centre (it used to tween its x/y in a straight line, which iOS
 * Safari doesn't animate), and the SVG is padded so the dot's glow isn't
 * clipped flat at the top of the circle.
 */
function ProgressRing({
  totalMs,
  endsAt,
  remainingMs,
  size,
  children,
}: {
  totalMs: number;
  endsAt: number | null;
  remainingMs: number;
  size: number;
  children: React.ReactNode;
}) {
  const stroke = 3;
  const pad = 14;
  const box = size + pad * 2;
  const c0 = box / 2;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const arcRef = useRef<SVGCircleElement>(null);
  const headRef = useRef<SVGGElement>(null);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const left = endsAt != null ? endsAt - Date.now() : remainingMs;
      const p = Math.max(0, Math.min(1, 1 - left / totalMs));
      arcRef.current?.setAttribute("stroke-dashoffset", String(circ * (1 - p)));
      if (headRef.current) {
        headRef.current.setAttribute("transform", `rotate(${p * 360} ${c0} ${c0})`);
        headRef.current.style.opacity = p > 0.002 ? "1" : "0";
      }
      if (endsAt != null && left > 0) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [endsAt, remainingMs, totalMs, circ, c0]);

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
        width={box}
        height={box}
        className="absolute pointer-events-none"
        style={{ left: -pad, top: -pad, overflow: "visible" }}
        aria-hidden="true"
      >
        <circle cx={c0} cy={c0} r={r} fill="none" stroke="var(--rule)" strokeWidth={stroke} />
        <circle
          ref={arcRef}
          cx={c0}
          cy={c0}
          r={r}
          fill="none"
          stroke="var(--gold)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ}
          transform={`rotate(-90 ${c0} ${c0})`}
        />
        <g ref={headRef} style={{ opacity: 0 }}>
          <circle
            cx={c0}
            cy={c0 - r}
            r={stroke * 1.6}
            fill="var(--gold)"
            style={{ filter: "drop-shadow(0 0 6px var(--gold))" }}
          />
        </g>
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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
