"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { LatinCross } from "./Cross";

type Verse = { reference: string; text: string };

const ACROSTIC =
  /\((?:Alef|Bet|Guímel|Guimel|Dálet|Dalet|He|Vau|Zain|Jet|Tet|Yod|Kaf|Lámed|Lamed|Mem|Nun|Sámec|Samec|Ain|Pe|Sade|Kof|Cof|Res|Sin|Sín|Shin|Tau)\)\s*/gi;

export function DailyVerse({ onContinue }: { onContinue: () => void }) {
  const [verse, setVerse] = useState<Verse | null>(null);
  const [error, setError] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    fetch("/api/daily-verse")
      .then((r) => r.json())
      .then((d: { verse?: Verse; error?: string }) => {
        if (d.verse) setVerse(d.verse);
        else setError(true);
      })
      .catch(() => setError(true));
  }, []);

  // Esc / Enter / Space dismiss the overlay — same as tapping anywhere or the
  // button. Any key press once the verse has been read continues the journey.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onContinue();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onContinue]);

  // Move focus to the action button as soon as it's available so screen
  // reader and keyboard users know they can dismiss.
  useEffect(() => {
    if (verse || error) {
      const t = setTimeout(() => buttonRef.current?.focus(), reduce ? 0 : 300);
      return () => clearTimeout(t);
    }
  }, [verse, error, reduce]);

  const display = verse
    ? `\u201C${verse.text.replace(ACROSTIC, "").replace(/\s*\|\s*/g, " — ").trim()}\u201D`
    : "";

  const today = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const ready = !!verse || error;
  const crossDuration = reduce ? 0 : 0.85;
  const cascadeDelay = reduce ? 0 : 1.0;
  const cascadeDuration = reduce ? 0 : 0.6;
  const buttonDelay = reduce ? 0 : 1.55;

  return (
    <motion.div
      key="daily-verse-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-verse-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.45, ease: [0.2, 0.7, 0.2, 1] }}
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center px-6 bg-[var(--paper)] no-print overflow-hidden cursor-pointer"
      onClick={(e) => {
        // Click on the overlay (or any non-button element) dismisses. Clicks
        // on the button itself are handled by its own onClick — don't
        // double-fire.
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

      <div className="relative w-full max-w-md text-center cursor-default">
        {/* The cross — centerpiece of the moment. Appears alone first. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: crossDuration, ease: [0.2, 0.7, 0.2, 1] }}
          className="mb-7"
        >
          <LatinCross className="mx-auto text-[var(--gold)]" size={32} />
        </motion.div>

        {/* The verse + reference + button cascade in once the cross has had its moment. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{
            opacity: ready ? 1 : 0,
            y: ready ? 0 : 8,
          }}
          transition={{
            delay: cascadeDelay,
            duration: cascadeDuration,
            ease: [0.2, 0.7, 0.2, 1],
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
                style={{ textWrap: "pretty" as React.CSSProperties["textWrap"] }}
              >
                {display}
              </blockquote>
              <p className="mt-5 font-sans text-[0.82rem] tracking-[0.16em] uppercase text-[var(--gold-text)]">
                {verse.reference}
              </p>
            </>
          ) : null}

          <hr className="hairline-gold mt-8 mx-auto max-w-[8rem]" />

          <motion.button
            ref={buttonRef}
            initial={{ opacity: 0, y: 8 }}
            animate={{
              opacity: ready ? 1 : 0,
              y: ready ? 0 : 8,
            }}
            transition={{
              delay: buttonDelay,
              duration: reduce ? 0 : 0.5,
              ease: [0.2, 0.7, 0.2, 1],
            }}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
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
          </motion.button>

          <p className="mt-4 font-sans text-[0.7rem] text-[var(--ink-faint)]">
            {ready ? "Toca cualquier parte para continuar" : ""}
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
