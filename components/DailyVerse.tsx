"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { LatinCross } from "./Cross";

type Verse = { reference: string; text: string };

const ACROSTIC =
  /\((?:Alef|Bet|Guímel|Guimel|Dálet|Dalet|He|Vau|Zain|Jet|Tet|Yod|Kaf|Lámed|Lamed|Mem|Nun|Sámec|Samec|Ain|Pe|Sade|Kof|Cof|Res|Sin|Sín|Shin|Tau)\)\s*/gi;

/**
 * Daily-verse welcome overlay.
 *
 * The animation strategy is intentionally minimal: ONE motion.div, ONE
 * fade. The opacity goes 0 → 1 when the verse arrives (`ready`), so the
 * home page stays visible behind a transparent overlay until the verse
 * is actually ready to show — no empty paper screen, no nested fades
 * fighting each other, no flicker.
 *
 * On exit (user clicks "Comenzar"), framer-motion's AnimatePresence runs
 * the same curve in reverse.
 *
 * The AnimatePresence lives here so the motion.div is its direct child —
 * earlier we had AnimatePresence in page.tsx wrapping <DailyVerse>, which
 * is a custom component, and AnimatePresence couldn't reliably hold the
 * exit (it can only sustain motion children that are direct).
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();

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

  // Esc / Enter / Space dismiss the overlay — same as tapping anywhere or
  // the button.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onContinue();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onContinue]);

  // Move focus to the action button as soon as it's available so screen
  // reader and keyboard users know they can dismiss.
  useEffect(() => {
    if (open && (verse || error)) {
      const t = setTimeout(() => buttonRef.current?.focus(), reduce ? 0 : 200);
      return () => clearTimeout(t);
    }
  }, [open, verse, error, reduce]);

  const display = verse
    ? `“${verse.text.replace(ACROSTIC, "").replace(/\s*\|\s*/g, " — ").trim()}”`
    : "";

  const today = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const ready = !!verse || error;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="daily-verse-overlay"
          data-daily-overlay
          role="dialog"
          aria-modal="true"
          aria-labelledby="daily-verse-title"
          // The overlay (paper background) appears INSTANTLY on mount so
          // it covers the home page from frame one — if it faded in, the
          // home would be visible through it during the fade. Only the
          // exit gets an animation, so dismissing still feels gentle.
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: reduce ? 0 : 0.5,
            ease: [0.2, 0.7, 0.2, 1],
          }}
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center px-6 bg-[var(--paper)] no-print overflow-hidden cursor-pointer"
          onClick={(e) => {
            // Click on the overlay (or any non-button element) dismisses.
            if ((e.target as HTMLElement).closest("button")) return;
            onContinue();
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

          {/* Two-layer entrance:
              1. The cross is visible from frame one (with a soft breathing
                 pulse while the verse loads — feels like the moment is
                 settling rather than waiting on a spinner).
              2. Once the verse arrives (`ready`), the rest of the content
                 (date, verse, button) materializes with an ease-out-expo
                 fade — the words emerge from the paper instead of popping. */}
          <div className="relative w-full max-w-md text-center cursor-default">
            <div
              className={`mb-7 ${!ready && !reduce ? "cross-breathing" : ""}`}
            >
              <LatinCross className="mx-auto text-[var(--gold)]" size={32} />
            </div>

            <div
              style={{
                opacity: ready ? 1 : 0,
                transition: reduce
                  ? undefined
                  : "opacity 1200ms cubic-bezier(0.16, 1, 0.3, 1)",
              }}
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
                onClick={onContinue}
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
