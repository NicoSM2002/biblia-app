"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { LatinCross } from "@/components/Cross";
import { AuthButton } from "@/components/AuthButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DailyVerse } from "@/components/DailyVerse";

// useLayoutEffect runs synchronously after DOM mutations but BEFORE the
// browser paints — exactly what we need to make the daily-verse decision
// land in the very first paint (no flash of home behind). On the server
// it falls back to useEffect, which avoids the SSR warning and is fine
// because there's no paint to worry about there.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function HomePage() {
  // Daily verse welcome — once per session per day, in sessionStorage so a
  // page refresh doesn't reshow it.
  const [showDailyVerse, setShowDailyVerse] = useState<boolean | null>(null);
  useIsomorphicLayoutEffect(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      setShowDailyVerse(sessionStorage.getItem("dailyVerseSeen") !== today);
    } catch {
      setShowDailyVerse(false);
    }
  }, []);
  function dismissDailyVerse() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      sessionStorage.setItem("dailyVerseSeen", today);
    } catch {
      // ignore
    }
    setShowDailyVerse(false);
  }

  return (
    <div className="relative h-[100dvh] flex flex-col overflow-hidden">
      <div className="missal-page">
        <header className="relative z-30 px-4 sm:px-8 lg:px-10 pt-5 sm:pt-6 lg:pt-7 pb-4 lg:pb-5 border-b border-[var(--rule)] bg-[var(--paper)] no-print">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <LatinCross className="text-[var(--gold)] lg:hidden shrink-0" size={14} />
              <LatinCross className="text-[var(--gold)] hidden lg:block shrink-0" size={18} />
              <h1 className="font-sans text-[1rem] sm:text-[1.05rem] lg:text-[1.15rem] font-medium text-[var(--ink)] tracking-[0.005em] truncate">
                Habla con la Palabra
              </h1>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <ThemeToggle />
              <AuthButton />
            </div>
          </div>
        </header>

        <main className="relative z-10 flex-1 overflow-y-auto min-h-0 px-5 sm:px-8 lg:px-10">
          <div className="max-w-xl mx-auto py-8 sm:py-12 lg:py-14 flex flex-col">
            <Welcome />
            <ActionCards />
            <Footer />
          </div>
        </main>

        <DailyVerse open={!!showDailyVerse} onContinue={dismissDailyVerse} />
      </div>
    </div>
  );
}

function Welcome() {
  return (
    <div className="text-center mb-8 sm:mb-10">
      <p className="font-sans text-[0.75rem] tracking-[0.22em] uppercase text-[var(--gold-text)] font-semibold mb-3">
        Bienvenido
      </p>
      <h2 className="font-serif italic text-[1.55rem] sm:text-[1.95rem] lg:text-[2.2rem] text-[var(--ink)] leading-[1.2] mb-3">
        Acércate a la Palabra hoy.
      </h2>
      <p className="font-sans text-[0.95rem] sm:text-[1rem] text-[var(--ink-soft)] leading-relaxed max-w-[36ch] mx-auto">
        Una conversación con la Sagrada Escritura, o una parroquia
        cerca de ti. Tú eliges por dónde empezar.
      </p>
    </div>
  );
}

function ActionCards() {
  return (
    <div className="space-y-4 sm:space-y-5">
      <ActionCard
        href="/chat"
        eyebrow="Conversación"
        title="Habla con la Palabra"
        description="Pregúntale algo — una duda, un dolor, una alegría — y recibe un versículo con una respuesta cercana."
        accent="gold"
        icon={<BookIcon />}
      />
      <ActionCard
        href="/misas"
        eyebrow="Tu parroquia"
        title="Misa cerca de ti"
        description="Encuentra iglesias católicas cercanas, con su sitio web y teléfono para confirmar el horario de Misa."
        accent="marian"
        icon={<ChapelIcon />}
      />
    </div>
  );
}

function ActionCard({
  href,
  eyebrow,
  title,
  description,
  accent,
  icon,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  accent: "gold" | "marian";
  icon: React.ReactNode;
}) {
  return (
    <div>
      <Link
        href={href}
        className="group block bg-[var(--surface)] border border-[var(--rule)] rounded-xl p-5 sm:p-6 transition-all duration-200 hover:border-[var(--gold)] hover:shadow-[0_8px_24px_-12px_rgba(var(--shadow-color),0.30)] hover:-translate-y-0.5 active:scale-[0.99] active:bg-[var(--vellum)]"
      >
        <div className="flex items-start gap-4">
          <div
            className="shrink-0 grid place-items-center w-11 h-11 sm:w-12 sm:h-12 rounded-full transition-colors"
            style={{
              backgroundColor:
                accent === "gold"
                  ? "rgba(184, 146, 74, 0.10)"
                  : "rgba(27, 58, 107, 0.08)",
              color: accent === "gold" ? "var(--gold)" : "var(--marian)",
            }}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="font-sans text-[0.75rem] tracking-[0.18em] uppercase font-semibold mb-1"
              style={{
                color: accent === "gold" ? "var(--gold-text)" : "var(--marian)",
              }}
            >
              {eyebrow}
            </p>
            <h3 className="font-serif italic text-[1.18rem] sm:text-[1.3rem] text-[var(--ink)] leading-snug mb-1.5">
              {title}
            </h3>
            <p className="font-sans text-[0.88rem] sm:text-[0.92rem] text-[var(--ink-soft)] leading-[1.55]">
              {description}
            </p>
          </div>
          <div
            aria-hidden="true"
            className="self-center shrink-0 text-[var(--ink-faint)] group-hover:text-[var(--gold-text)] group-hover:translate-x-1 transition-all duration-200"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </div>
      </Link>
    </div>
  );
}

function Footer() {
  return (
    <div className="mt-10 flex items-center justify-center gap-2">
      <span aria-hidden="true" className="h-px w-6 bg-[var(--rule)]" />
      <p className="font-sans text-[0.78rem] tracking-[0.04em] text-[var(--ink-soft)] text-center">
        Sagrada Biblia · Versión oficial de la Conferencia Episcopal Española
      </p>
      <span aria-hidden="true" className="h-px w-6 bg-[var(--rule)]" />
    </div>
  );
}

function BookIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 4.5C4 3.67 4.67 3 5.5 3H19a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5.5A2.5 2.5 0 0 1 3 17.5V5.5z" />
      <path d="M3 17.5A2.5 2.5 0 0 1 5.5 15H20" />
      <line x1="9" y1="8" x2="14" y2="8" />
      <line x1="11.5" y1="6" x2="11.5" y2="10" />
    </svg>
  );
}

function ChapelIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="10.5" y1="3.5" x2="13.5" y2="3.5" />
      <path d="M5 21V11l7-4 7 4v10" />
      <line x1="3" y1="21" x2="21" y2="21" />
      <rect x="10" y="14" width="4" height="7" />
    </svg>
  );
}
