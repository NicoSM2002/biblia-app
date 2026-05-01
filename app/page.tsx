"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LatinCross } from "@/components/Cross";
import { HomeAvatar } from "@/components/HomeAvatar";
import { BottomNav } from "@/components/BottomNav";
import { Splash } from "@/components/Splash";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  createClient,
  hasSessionCookie,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

const ACROSTIC =
  /\((?:Alef|Bet|Guímel|Guimel|Dálet|Dalet|He|Vau|Zain|Jet|Tet|Yod|Kaf|Lámed|Lamed|Mem|Nun|Sámec|Samec|Ain|Pe|Sade|Kof|Cof|Res|Sin|Sín|Shin|Tau)\)\s*/gi;

type Verse = { reference: string; text: string };

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [verse, setVerse] = useState<Verse | null>(null);

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

  // Daily verse — cached in sessionStorage so the SECOND time the user
  // navigates to the home in the same session it appears instantly. The
  // network round-trip used to make the verse "pop in late" every visit.
  // Cache keyed by today's date so it auto-invalidates on a new day.
  useEffect(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const cached = sessionStorage.getItem("dailyVerseCache");
      if (cached) {
        const parsed = JSON.parse(cached) as { date: string; verse: Verse };
        if (parsed.date === today && parsed.verse) {
          setVerse(parsed.verse);
          return;
        }
      }
    } catch {
      // ignore
    }
    fetch("/api/daily-verse")
      .then((r) => r.json())
      .then((d: { verse?: Verse }) => {
        if (d.verse) {
          setVerse(d.verse);
          try {
            const today = new Date().toISOString().slice(0, 10);
            sessionStorage.setItem(
              "dailyVerseCache",
              JSON.stringify({ date: today, verse: d.verse }),
            );
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {
        // optional — the rest of the home still works
      });
  }, []);

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
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <LatinCross className="text-[var(--gold)] shrink-0" size={16} />
            <h1 className="font-sans text-[0.98rem] font-medium text-[var(--ink)] truncate">
              Habla con la Palabra
            </h1>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <ThemeToggle />
            <HomeAvatar />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-32">
        <div className="page-content-fade max-w-2xl mx-auto px-5 sm:px-6 pt-5">
          <Greeting name={name} />

          <h2 className="mt-1.5 font-serif italic text-page leading-[1.25] text-[var(--ink)] mb-4">
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

          {/* Versículo del día — skeleton while loading so the layout
              doesn't shift when the fetch comes back, and on subsequent
              visits in the same session it's instant via sessionStorage
              cache. */}
          {verse ? (
            <DailyVerseSection verse={verse} />
          ) : (
            <DailyVerseSkeleton />
          )}

          <section className="mt-6">
            <p className="text-eyebrow text-[var(--gold-text)] mb-2.5">
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

      <Splash />
    </div>
  );
}

function DailyVerseSkeleton() {
  return (
    <section className="mt-6">
      <p className="text-eyebrow text-[var(--gold-text)] mb-2.5">
        Versículo del día
      </p>
      <div
        className="rounded-xl px-5 py-5"
        style={{
          background:
            "linear-gradient(135deg, rgba(184,146,74,0.08) 0%, rgba(184,146,74,0.03) 100%)",
          border: "1px solid rgba(184, 146, 74, 0.22)",
        }}
      >
        <div className="space-y-2 animate-pulse">
          <div className="h-5 bg-[var(--rule)] rounded w-full" />
          <div className="h-5 bg-[var(--rule)] rounded w-[90%]" />
          <div className="h-5 bg-[var(--rule)] rounded w-[70%]" />
        </div>
        <div className="mt-3 h-3 bg-[var(--rule)] rounded w-24 animate-pulse" />
      </div>
    </section>
  );
}

function DailyVerseSection({ verse }: { verse: Verse }) {
  const display = `“${verse.text.replace(ACROSTIC, "").replace(/\s*\|\s*/g, " — ").trim()}”`;
  return (
    <section className="mt-6">
      <p className="text-eyebrow text-[var(--gold-text)] mb-2.5">
        Versículo del día
      </p>
      <div
        className="rounded-xl px-5 py-5"
        style={{
          background:
            "linear-gradient(135deg, rgba(184,146,74,0.08) 0%, rgba(184,146,74,0.03) 100%)",
          border: "1px solid rgba(184, 146, 74, 0.22)",
        }}
      >
        <blockquote
          cite={verse.reference}
          className="font-serif italic text-quote leading-[1.45] text-[var(--ink)]"
          style={{ textWrap: "pretty" as React.CSSProperties["textWrap"] }}
        >
          {display}
        </blockquote>
        <p className="mt-3 text-eyebrow text-[var(--gold-text)]">
          {verse.reference}
        </p>
      </div>
    </section>
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
