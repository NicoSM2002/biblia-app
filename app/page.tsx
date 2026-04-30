"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LatinCross } from "@/components/Cross";
import { HomeAvatar } from "@/components/HomeAvatar";
import { BottomNav } from "@/components/BottomNav";
import { DailyVerse } from "@/components/DailyVerse";
import {
  createClient,
  hasSessionCookie,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

const SUGGESTIONS = [
  { id: "paz", label: "Necesito paz", icon: <LeafIcon /> },
  { id: "solo", label: "Me siento solo", icon: <UserIcon /> },
  { id: "direccion", label: "Busco dirección", icon: <CompassIcon /> },
  { id: "gracias", label: "Quiero dar gracias", icon: <HeartIcon /> },
];

export default function HomePage() {
  const router = useRouter();
  const [showDailyVerse, setShowDailyVerse] = useState<boolean>(true);
  const [name, setName] = useState<string | null>(null);
  const [question, setQuestion] = useState("");

  useEffect(() => {
    try {
      // Match the inline-script logic: on reload (F5 / Cmd+R) always show
      // the daily verse. Only respect a previous dismiss for in-app
      // navigation (link clicks, back/forward, first visit).
      let navType = "navigate";
      try {
        const entries = performance.getEntriesByType(
          "navigation",
        ) as PerformanceNavigationTiming[];
        if (entries[0]?.type) navType = entries[0].type;
      } catch {
        // ignore — older browsers
      }
      if (navType === "reload") return;

      const today = new Date().toISOString().slice(0, 10);
      if (sessionStorage.getItem("dailyVerseSeen") === today) {
        setShowDailyVerse(false);
      }
    } catch {
      // sessionStorage unavailable — leave the overlay showing
    }
  }, []);

  // Read user name (if signed in) for the personalized greeting.
  useEffect(() => {
    if (!isSupabaseConfigured() || !hasSessionCookie()) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata as
        | { full_name?: string; name?: string }
        | undefined;
      const n = meta?.full_name ?? meta?.name ?? null;
      if (n) setName(firstName(n));
    });
  }, []);

  function dismissDailyVerse() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      sessionStorage.setItem("dailyVerseSeen", today);
      document.documentElement.setAttribute("data-daily-verse-seen", "1");
    } catch {
      // ignore
    }
    setShowDailyVerse(false);
  }

  function goToChat(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    try {
      sessionStorage.setItem("pendingQuestion", trimmed);
    } catch {
      // ignore
    }
    router.push("/chat");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    goToChat(question);
  }

  return (
    <div className="relative h-[100dvh] flex flex-col overflow-hidden">
      <header className="px-5 pt-5 pb-3 border-b border-[var(--rule)] bg-[var(--paper)]">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <LatinCross className="text-[var(--gold)] shrink-0" size={16} />
            <h1 className="font-sans text-[0.98rem] font-medium text-[var(--ink)] truncate">
              Habla con la Palabra
            </h1>
          </div>
          <HomeAvatar />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-36">
        <div className="max-w-2xl mx-auto px-5 sm:px-6 pt-7">
          <Greeting name={name} />

          <h2 className="mt-2 font-serif italic text-[1.5rem] sm:text-[1.7rem] leading-[1.25] text-[var(--ink)] mb-5">
            ¿Qué quieres preguntarle a Dios hoy?
          </h2>

          <form onSubmit={onSubmit}>
            <div className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--rule)] rounded-full pl-5 pr-1.5 py-1.5 transition-colors focus-within:border-[var(--gold)]">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Escribe tu pregunta…"
                className="flex-1 bg-transparent outline-none font-sans text-[0.98rem] text-[var(--ink)] placeholder:text-[var(--ink-faint)] py-2"
                aria-label="Escribe tu pregunta"
              />
              <button
                type="submit"
                aria-label="Enviar pregunta"
                className="grid place-items-center w-10 h-10 rounded-full bg-[var(--gold)] text-[var(--button-on-gold)] hover:bg-[var(--gold-soft)] transition-colors"
              >
                <MicIcon />
              </button>
            </div>
          </form>

          <section className="mt-9">
            <p className="font-sans text-[0.72rem] tracking-[0.18em] uppercase text-[var(--gold-text)] font-semibold mb-3">
              Sugerencias para ti
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => goToChat(s.label)}
                  className="flex items-center gap-2.5 bg-[var(--surface)] border border-[var(--rule)] rounded-full px-4 py-3 text-left hover:border-[var(--gold)] hover:bg-[var(--vellum)] transition-colors"
                >
                  <span aria-hidden="true" className="text-[var(--gold-text)] shrink-0">
                    {s.icon}
                  </span>
                  <span className="font-sans text-[0.9rem] text-[var(--ink)] truncate">
                    {s.label}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-9">
            <p className="font-sans text-[0.72rem] tracking-[0.18em] uppercase text-[var(--gold-text)] font-semibold mb-3">
              Misa cerca de ti
            </p>
            <Link
              href="/misas"
              className="flex items-start gap-3 bg-[var(--surface)] border border-[var(--rule)] rounded-xl p-4 hover:border-[var(--gold)] hover:bg-[var(--vellum)] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-serif italic text-[1.05rem] text-[var(--ink)] leading-snug">
                  Encuentra una iglesia cerca de ti
                </p>
                <p className="mt-1 font-sans text-[0.85rem] text-[var(--ink-soft)]">
                  Horarios de misa y cómo llegar.
                </p>
              </div>
              <div
                className="grid place-items-center w-10 h-10 rounded-full shrink-0"
                style={{
                  backgroundColor: "rgba(184, 146, 74, 0.10)",
                  color: "var(--gold-text)",
                }}
              >
                <PinIcon />
              </div>
            </Link>
          </section>
        </div>
      </main>

      <BottomNav />

      <DailyVerse open={showDailyVerse} onContinue={dismissDailyVerse} />
    </div>
  );
}

function Greeting({ name }: { name: string | null }) {
  const period = useGreetingPeriod();
  const text =
    period === "morning"
      ? "¡Buenos días"
      : period === "afternoon"
        ? "¡Buenas tardes"
        : "¡Buenas noches";
  return (
    <p className="font-sans text-[1rem] text-[var(--ink-soft)]">
      {text}
      {name ? `, ${name}` : ""}!
    </p>
  );
}

function useGreetingPeriod(): "morning" | "afternoon" | "night" {
  const [period, setPeriod] = useState<"morning" | "afternoon" | "night">(
    "morning",
  );
  useEffect(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) setPeriod("morning");
    else if (h >= 12 && h < 19) setPeriod("afternoon");
    else setPeriod("night");
  }, []);
  return period;
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

function LeafIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2c1 1.5 2 4.79 1.5 7-1 3.5-3 5-3 5l-3 3" />
      <path d="M2 22 17 7" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="9" y1="22" x2="15" y2="22" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
