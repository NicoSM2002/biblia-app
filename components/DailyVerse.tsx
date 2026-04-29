"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { LatinCross } from "./Cross";

type Verse = { reference: string; text: string };

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

  // Strip BAC artefacts — same as VerseCard.
  const ACROSTIC =
    /\((?:Alef|Bet|Guímel|Guimel|Dálet|Dalet|He|Vau|Zain|Jet|Tet|Yod|Kaf|Lámed|Lamed|Mem|Nun|Sámec|Samec|Ain|Pe|Sade|Kof|Cof|Res|Sin|Sín|Shin|Tau)\)\s*/gi;
  const display = verse
    ? verse.text.replace(ACROSTIC, "").replace(/\s*\|\s*/g, " — ").trim()
    : "";

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
      transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center px-6 bg-[var(--paper)] no-print"
    >
      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
        className="w-full max-w-md text-center"
      >
        <LatinCross
          className="mx-auto text-[var(--gold)] mb-4"
          size={18}
        />
        <p className="font-sans text-[0.7rem] tracking-[0.22em] uppercase text-[var(--gold)] mb-6">
          Hoy · {today}
        </p>

        {!verse && !error && (
          <div className="space-y-3">
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
          <>
            <blockquote
              cite={verse.reference}
              className="font-serif italic text-[1.4rem] sm:text-[1.55rem] leading-[1.45] text-[var(--ink)]"
              style={{ textWrap: "pretty" as React.CSSProperties["textWrap"] }}
            >
              “{display}”
            </blockquote>
            <p className="mt-5 font-sans text-[0.78rem] tracking-[0.16em] uppercase text-[var(--gold)]">
              {verse.reference}
            </p>
          </>
        )}

        <hr className="hairline-gold mt-8 mx-auto max-w-[8rem]" />

        <button
          onClick={onContinue}
          className="mt-7 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--gold)] text-white font-sans text-[0.92rem] font-medium hover:bg-[var(--gold-soft)] transition-colors"
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
        </button>
      </motion.div>
    </motion.div>
  );
}
