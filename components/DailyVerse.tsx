"use client";

import { useEffect, useRef, useState } from "react";
import { LatinCross } from "./Cross";

type Verse = { reference: string; text: string };

const ACROSTIC =
  /\((?:Alef|Bet|Guímel|Guimel|Dálet|Dalet|He|Vau|Zain|Jet|Tet|Yod|Kaf|Lámed|Lamed|Mem|Nun|Sámec|Samec|Ain|Pe|Sade|Kof|Cof|Res|Sin|Sín|Shin|Tau)\)\s*/gi;

const EXIT_DURATION_MS = 450;
const SWIPE_THRESHOLD = 60; // px upward to dismiss

/**
 * The daily-verse welcome (mockup pantalla 1).
 *
 * Full-screen scripture moment. The user can dismiss by tapping the
 * "Comenzar" button, tapping anywhere outside it, swiping up, or pressing
 * Esc/Enter/Space.
 *
 * The overlay is rendered into the SSR HTML always; the inline init script
 * in app/layout.tsx hides it via a CSS rule for repeat visitors today, so
 * there's no flicker.
 */
export function DailyVerse({
  open,
  onContinue,
}: {
  open: boolean;
  onContinue: () => void;
}) {
  const [verse, setVerse] = useState<Verse | null>(null);
  const [error, setError] = useState(false);
  const [exiting, setExiting] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/daily-verse")
      .then((r) => r.json())
      .then((d: { verse?: Verse; error?: string }) => {
        if (d.verse) setVerse(d.verse);
        else setError(true);
      })
      .catch(() => setError(true));
  }, [open]);

  const ready = !!verse || error;

  useEffect(() => {
    if (!open || exiting) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        startDismiss();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, exiting]);

  useEffect(() => {
    if (open && !exiting && (verse || error)) {
      const t = setTimeout(() => buttonRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [open, exiting, verse, error]);

  function startDismiss() {
    if (exiting) return;
    setExiting(true);
    setTimeout(onContinue, EXIT_DURATION_MS);
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartYRef.current = e.touches[0]?.clientY ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const startY = touchStartYRef.current;
    touchStartYRef.current = null;
    if (startY == null) return;
    const endY = e.changedTouches[0]?.clientY ?? startY;
    if (startY - endY >= SWIPE_THRESHOLD) startDismiss();
  }

  if (!open) return null;

  const display = verse
    ? `“${verse.text.replace(ACROSTIC, "").replace(/\s*\|\s*/g, " — ").trim()}”`
    : "";

  const today = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div
      data-daily-overlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-verse-title"
      className={`daily-verse-overlay ${exiting ? "daily-verse-exiting" : ""}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        startDismiss();
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Decorative botanical shadow — a soft, blurred branch silhouette in
          the top-left corner. Evokes leaves catching the morning light next
          to a missal. Pure SVG, no asset needed. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 w-[260px] h-[260px] sm:w-[320px] sm:h-[320px]"
        style={{ filter: "blur(3px)", opacity: 0.18 }}
      >
        <svg viewBox="0 0 260 260" fill="none" stroke="rgb(80, 65, 40)" strokeWidth="1.4" strokeLinecap="round">
          <path d="M-20 30 Q 60 60, 130 110 Q 180 145, 220 220" />
          <path d="M5 40 Q 35 50, 50 80 L 25 70 Z" fill="rgba(80,65,40,0.4)" />
          <path d="M40 60 Q 70 65, 88 92 L 60 88 Z" fill="rgba(80,65,40,0.4)" />
          <path d="M75 80 Q 105 88, 122 118 L 92 110 Z" fill="rgba(80,65,40,0.4)" />
          <path d="M115 105 Q 145 115, 165 145 L 132 137 Z" fill="rgba(80,65,40,0.4)" />
          <path d="M155 135 Q 180 148, 195 178 L 168 168 Z" fill="rgba(80,65,40,0.4)" />
          <path d="M30 25 Q 55 30, 70 55 L 45 48 Z" fill="rgba(80,65,40,0.4)" />
          <path d="M70 45 Q 95 52, 110 78 L 80 72 Z" fill="rgba(80,65,40,0.4)" />
        </svg>
      </div>

      <div className="relative w-full max-w-md text-center cursor-default px-6">
        {/* Cross — visible from frame 1 with breathing pulse */}
        <div className="mb-6 cross-breathing">
          <LatinCross className="mx-auto text-[var(--gold)]" size={36} />
        </div>

        {/* Date + verse + reference + button + hint — fade in once verse arrives */}
        <div
          className={`daily-verse-content ${ready ? "is-ready" : ""}`}
        >
          <p
            id="daily-verse-title"
            className="font-sans text-[0.78rem] tracking-[0.22em] uppercase text-[var(--gold-text)] mb-7"
          >
            {today}
          </p>

          {error ? (
            <p className="font-sans text-[1rem] text-[var(--ink-soft)] mb-8">
              La Palabra te espera. Continúa cuando quieras.
            </p>
          ) : verse ? (
            <>
              <blockquote
                cite={verse.reference}
                className="font-serif italic text-[1.55rem] sm:text-[1.75rem] leading-[1.42] text-[var(--ink)] mb-7"
                style={{ textWrap: "pretty" as React.CSSProperties["textWrap"] }}
              >
                {display}
              </blockquote>
              <p className="font-sans text-[0.82rem] tracking-[0.18em] uppercase text-[var(--gold-text)] mb-9">
                {verse.reference}
              </p>
            </>
          ) : null}

          <button
            ref={buttonRef}
            onClick={startDismiss}
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-[var(--gold)] text-[var(--button-on-gold)] font-sans text-[0.95rem] font-medium hover:bg-[var(--gold-soft)] transition-colors min-h-[44px]"
          >
            Comenzar
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>

          <p className="mt-5 font-sans text-[0.78rem] text-[var(--ink-faint)]">
            {ready ? "Desliza hacia arriba" : ""}
          </p>
        </div>
      </div>

      {/* iOS-style home-indicator hint at the bottom */}
      <div
        aria-hidden="true"
        className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 rounded-full bg-[var(--ink-faint)] opacity-30"
      />
    </div>
  );
}
