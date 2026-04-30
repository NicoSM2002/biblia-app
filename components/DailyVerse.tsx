"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { LatinCross } from "./Cross";

type Verse = { reference: string; text: string };

/**
 * Hook: progressively reveals `text` one character at a time once `start`
 * becomes true. Returns the visible portion plus a flag for completion so
 * the caller can chain follow-up animations.
 */
function useTypewriter(text: string, opts: { speed?: number; start?: boolean }) {
  const { speed = 28, start = true } = opts;
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!start || !text) {
      setCount(0);
      return;
    }
    setCount(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, start, speed]);

  return {
    output: text.slice(0, count),
    isComplete: count >= text.length && text.length > 0,
  };
}

const ACROSTIC =
  /\((?:Alef|Bet|Guímel|Guimel|Dálet|Dalet|He|Vau|Zain|Jet|Tet|Yod|Kaf|Lámed|Lamed|Mem|Nun|Sámec|Samec|Ain|Pe|Sade|Kof|Cof|Res|Sin|Sín|Shin|Tau)\)\s*/gi;

export function DailyVerse({ onContinue }: { onContinue: () => void }) {
  const [verse, setVerse] = useState<Verse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/daily-verse")
      .then((r) => r.json())
      .then((d: { verse?: Verse; error?: string }) => {
        if (d.verse) setVerse(d.verse);
        else setError(true);
      })
      .catch(() => setError(true));
  }, []);

  const display = verse
    ? `\u201C${verse.text.replace(ACROSTIC, "").replace(/\s*\|\s*/g, " — ").trim()}\u201D`
    : "";

  // Start the typewriter only once the verse has actually been fetched and
  // the introductory animations have settled (date label has appeared).
  const { output, isComplete } = useTypewriter(display, {
    speed: 14,
    start: !!verse,
  });

  const today = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <motion.div
      key="daily-verse-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center px-6 bg-[var(--paper)] no-print overflow-hidden"
    >
      {/* Soft radial halo behind the content — only on this overlay. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 35%, rgba(184,146,74,0.10) 0%, transparent 60%)",
        }}
      />

      <div className="relative w-full max-w-md text-center">
        {/* Cross — fades + gentle scale */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}
        >
          <LatinCross
            className="mx-auto text-[var(--gold)] mb-4"
            size={20}
          />
        </motion.div>

        {/* Date / Hoy — fades up */}
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="font-sans text-[0.7rem] tracking-[0.22em] uppercase text-[var(--gold)] mb-6"
        >
          Hoy · {today}
        </motion.p>

        {/* Verse — typewriter */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.75, duration: 0.4 }}
          className="min-h-[7rem]"
        >
          {!verse && !error && (
            <div className="space-y-3 mt-2">
              <div className="h-4 bg-[var(--rule)] rounded w-3/4 mx-auto animate-pulse" />
              <div className="h-4 bg-[var(--rule)] rounded w-5/6 mx-auto animate-pulse" />
              <div className="h-4 bg-[var(--rule)] rounded w-2/3 mx-auto animate-pulse" />
            </div>
          )}

          {error && (
            <p className="font-sans text-[0.95rem] text-[var(--ink-soft)]">
              La Palabra te espera. Continúa cuando quieras.
            </p>
          )}

          {verse && (
            <blockquote
              cite={verse.reference}
              className="font-serif italic text-[1.4rem] sm:text-[1.55rem] leading-[1.45] text-[var(--ink)]"
              style={{ textWrap: "pretty" as React.CSSProperties["textWrap"] }}
            >
              {output}
              {!isComplete && (
                <span
                  aria-hidden="true"
                  className="ml-0.5 inline-block w-[2px] h-[1.05em] align-middle bg-[var(--gold)] anim-cursor"
                />
              )}
            </blockquote>
          )}
        </motion.div>

        {/* Reference — fades in once typing finishes */}
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: isComplete ? 1 : 0, y: isComplete ? 0 : 6 }}
          transition={{ duration: 0.5 }}
          className="mt-5 font-sans text-[0.78rem] tracking-[0.16em] uppercase text-[var(--gold)]"
        >
          {verse?.reference ?? ""}
        </motion.p>

        {/* Hairline */}
        <motion.hr
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{
            opacity: isComplete ? 1 : 0,
            scaleX: isComplete ? 1 : 0,
          }}
          transition={{ delay: 0.15, duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
          className="hairline-gold mt-8 mx-auto max-w-[8rem] origin-center"
        />

        {/* Button */}
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: isComplete ? 1 : 0, y: isComplete ? 0 : 8 }}
          transition={{ delay: 0.35, duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={onContinue}
          disabled={!isComplete && !error}
          className="mt-7 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--gold)] text-white font-sans text-[0.92rem] font-medium hover:bg-[var(--gold-soft)] transition-colors disabled:opacity-0 disabled:cursor-default"
        >
          Hablar con la Palabra
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
      </div>
    </motion.div>
  );
}
