"use client";

import { useEffect, useRef, useState } from "react";
import { LatinCross } from "./Cross";

type Verse = { reference: string; text: string };

const ACROSTIC =
  /\((?:Alef|Bet|Guímel|Guimel|Dálet|Dalet|He|Vau|Zain|Jet|Tet|Yod|Kaf|Lámed|Lamed|Mem|Nun|Sámec|Samec|Ain|Pe|Sade|Kof|Cof|Res|Sin|Sín|Shin|Tau)\)\s*/gi;

const EXIT_DURATION_MS = 450;

/**
 * The daily-verse overlay.
 *
 * Implementation notes (after a long debugging journey):
 *
 * - NO framer-motion. AnimatePresence + motion.div + SSR don't give us the
 *   first-paint guarantee we need — the inline `style="opacity:1"` is added
 *   during hydration, so the home flashes underneath. Plain divs + CSS keep
 *   the overlay visible from the very first paint.
 *
 * - The overlay is rendered into the SSR HTML always (parent passes
 *   `open=true` by default). The inline script in app/layout.tsx sets
 *   `data-daily-verse-seen="1"` on <html> if today's verse was already
 *   dismissed, and a CSS rule (in globals.css) hides `[data-daily-overlay]`
 *   in that case — so repeat visitors never see a flash either.
 *
 * - Cross is ALWAYS visible with the breathing pulse — not gated on
 *   `ready`. The pulse stops via prefers-reduced-motion only.
 *
 * - The verse + button block uses a CSS `@keyframes` animation triggered
 *   by toggling a class when `ready` flips to true. CSS animations fire
 *   on class application reliably, even when React batches the state
 *   change with the initial render — unlike CSS transitions on inline
 *   styles, which the browser may "skip" if the value never visibly
 *   changes between paints.
 *
 * - Exit animation: when the user dismisses, we set `exiting=true`, which
 *   adds a CSS animation to the overlay. After the animation completes
 *   (~450ms), we call `onContinue`, which causes the parent to unmount us.
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

  // Esc / Enter / Space dismiss the overlay.
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

  // Move focus to the action button when the verse arrives.
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
        // Click on the overlay (or any non-button element) dismisses.
        if ((e.target as HTMLElement).closest("button")) return;
        startDismiss();
      }}
    >
      {/* Soft radial halo behind the content */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 38%, rgba(184,146,74,0.10) 0%, transparent 60%)",
        }}
      />

      <div className="relative w-full max-w-md text-center cursor-default">
        {/* Cross — always breathing while the overlay is open. The pulse
            is independent of ready state so users always see the gentle
            motion immediately. Reduced-motion users get a still cross. */}
        <div className="mb-7 cross-breathing">
          <LatinCross className="mx-auto text-[var(--gold)]" size={32} />
        </div>

        {/* Content — hidden until the verse arrives, then revealed via a
            CSS keyframe animation triggered by class change. We use a
            @keyframes animation rather than a transition because animations
            run reliably on class application; transitions on inline styles
            can be skipped when React batches the render. */}
        <div
          className={`daily-verse-content ${ready ? "is-ready" : ""}`}
        >
          <p
            id="daily-verse-title"
            className="font-sans text-[0.78rem] tracking-[0.22em] uppercase text-[var(--gold-text)] mb-5"
          >
            Hoy · {today}
          </p>

          {error ? (
            <p className="font-sans text-[1rem] text-[var(--ink-soft)]">
              La Palabra te espera. Continúa cuando quieras.
            </p>
          ) : verse ? (
            <>
              <blockquote
                cite={verse.reference}
                className="font-serif italic text-[1.4rem] sm:text-[1.55rem] leading-[1.45] text-[var(--ink)]"
                style={{
                  textWrap: "pretty" as React.CSSProperties["textWrap"],
                }}
              >
                {display}
              </blockquote>
              <p className="mt-5 font-sans text-[0.82rem] tracking-[0.16em] uppercase text-[var(--gold-text)]">
                {verse.reference}
              </p>
            </>
          ) : null}

          <hr className="hairline-gold mt-8 mx-auto max-w-[8rem]" />

          <button
            ref={buttonRef}
            onClick={startDismiss}
            className="mt-7 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[var(--gold)] text-[var(--button-on-gold)] font-sans text-[0.95rem] font-medium hover:bg-[var(--gold-soft)] transition-colors min-h-[44px]"
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

          <p className="mt-4 font-sans text-[0.7rem] text-[var(--ink-faint)]">
            {ready ? "Toca cualquier parte para continuar" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
