"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NAV_H } from "@/components/BottomNav";
import { formatReference } from "@/components/VerseCard";
import { PauseIcon, ReadAloudPlayer, SpeakerIcon } from "@/components/ReadAloudPlayer";
import { apiUrl } from "@/lib/api-url";
import { authFetch } from "@/lib/auth-fetch";
import { hasLocalSession } from "@/lib/supabase/client";
import { speakable, toggle, useTts } from "@/lib/tts";

/**
 * Mis favoritas — every response the user hearted in the chat, newest first.
 * Its own tab in BottomNav (and the "Ver favoritas" pill that shows right
 * after hearting a response). Only meaningful with an account (the
 * heart is hidden for guests), so without a session this page explains that
 * and links to sign-in.
 */

type Favorite = {
  ord: number;
  question: string;
  verse_reference: string | null;
  verse_text: string | null;
  response: string;
  created_at: string;
  conversation_id: string;
};

type Status = "loading" | "anon" | "ready" | "error";

const PILL =
  "inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-full border border-[var(--rule)] bg-[var(--surface)] font-sans text-[0.82rem] font-medium text-[var(--ink-soft)] hover:border-[var(--gold)] hover:text-[var(--gold-text)] transition-colors";

export default function FavoritasPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [items, setItems] = useState<Favorite[]>([]);

  useEffect(() => {
    // No stored session: say so at once instead of showing loading cards
    // for the second the server takes to answer 401.
    if (!hasLocalSession()) {
      void Promise.resolve().then(() => setStatus("anon"));
      return;
    }
    // Session expired server-side → 401 → "anon".
    authFetch(apiUrl("/api/favorites"))
      .then(async (res) => {
        if (res.status === 401) return setStatus("anon");
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { favorites: Favorite[] };
        setItems(data.favorites);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  function unlike(f: Favorite) {
    const key = `${f.conversation_id}:${f.ord}`;
    setItems((prev) => prev.filter((x) => `${x.conversation_id}:${x.ord}` !== key));
    void authFetch(apiUrl(`/api/conversations/${f.conversation_id}/turns`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ord: f.ord, liked: false }),
    }).then((res) => {
      // Put it back if the server didn't take it.
      if (!res.ok) setItems((prev) => restore(prev, f));
    }, () => setItems((prev) => restore(prev, f)));
  }

  return (
    <div className="relative h-[100dvh] flex flex-col overflow-hidden">
      <header className="page-head-fade px-5 sm:px-6 pt-5 pb-3 border-b border-[var(--rule)] bg-[var(--paper)] z-10">
        <div className="max-w-2xl lg:max-w-5xl mx-auto lg:px-4 flex items-baseline justify-between gap-3">
          <h1 className="font-display text-[min(1.5rem,26px)] leading-tight text-[var(--ink)]">
            Mis favoritas
          </h1>
          {status === "ready" && items.length > 0 && (
            <span className="font-sans text-[0.84rem] text-[var(--ink-faint)]">
              {items.length} guardada{items.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </header>

      <ReadAloudPlayer />

      <main
        className="page-content-fade flex-1 overflow-y-auto"
        style={{ paddingBottom: `calc(${NAV_H} + 16px)` }}
      >
        <div className="max-w-2xl lg:max-w-5xl mx-auto px-5 sm:px-6 lg:px-10 pt-4 lg:pt-8">
          {status === "loading" && (
            <div className="space-y-3" aria-label="Cargando favoritas">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-36 rounded-2xl skeleton-shimmer" />
              ))}
            </div>
          )}

          {status === "anon" && (
            <Empty
              title="Inicia sesión para guardar respuestas"
              body="Con una cuenta, cada respuesta que marques con el corazón se guarda aquí para volver a ella cuando la necesites."
              action={
                <Link href="/auth" className={PILL}>
                  Iniciar sesión o crear cuenta
                </Link>
              }
            />
          )}

          {status === "error" && (
            <Empty
              title="No pudimos cargar tus favoritas"
              body="Revisa tu conexión e inténtalo de nuevo."
              action={
                <button type="button" onClick={() => location.reload()} className={PILL}>
                  Reintentar
                </button>
              }
            />
          )}

          {status === "ready" && items.length === 0 && (
            <Empty
              title="Aún no tienes favoritas"
              body="Cuando una respuesta te ayude, toca el corazón debajo de ella y la encontrarás aquí."
              action={
                <Link href="/chat" className={PILL}>
                  Ir a la conversación
                </Link>
              }
            />
          )}

          {status === "ready" && items.length > 0 && (
            <ul className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start">
              {items.map((f) => (
                <FavoriteCard
                  key={`${f.conversation_id}:${f.ord}`}
                  f={f}
                  onUnlike={() => unlike(f)}
                />
              ))}
            </ul>
          )}
        </div>
      </main>

    </div>
  );
}

function restore(prev: Favorite[], f: Favorite): Favorite[] {
  return [...prev, f].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * One saved answer. The heart sits by the date (it's the card's state, not
 * one more action); tapping the text opens it in full; one row of actions.
 * It used to have four buttons wrapping onto two rows.
 */
function FavoriteCard({ f, onUnlike }: { f: Favorite; onUnlike: () => void }) {
  const [open, setOpen] = useState(false);
  const tts = useTts();
  const ttsId = `fav:${f.conversation_id}:${f.ord}`;
  const reading = tts.id === ttsId ? tts.status : "idle";
  const long = f.response.length > 220;

  return (
    <li className="rounded-2xl border border-[var(--rule)] bg-[var(--surface)] p-4 shadow-[0_1px_0_var(--emboss)_inset]">
      <div className="flex items-center justify-between gap-3">
        <p className="font-sans text-[0.8rem] text-[var(--ink-faint)]">
          {new Date(f.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
        </p>
        <button
          type="button"
          onClick={onUnlike}
          aria-label="Quitar de favoritas"
          title="Quitar de favoritas"
          className="grid place-items-center w-9 h-9 shrink-0 rounded-full border border-[var(--vino)]/40 bg-[var(--vino)]/8 text-[var(--vino)] hover:bg-[var(--vino)]/15 transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      <button
        type="button"
        onClick={() => long && setOpen((o) => !o)}
        aria-expanded={long ? open : undefined}
        className={`block w-full text-left ${long ? "cursor-pointer" : "cursor-default"}`}
      >
        <p className="font-sans text-[0.95rem] font-semibold text-[var(--ink)] leading-snug">{f.question}</p>
        {f.verse_text && f.verse_reference && (
          <span className="mt-3 block border-l-2 border-[var(--gold)] pl-3">
            <span className="block font-serif text-[1rem] leading-[1.45] text-[var(--ink)]">{f.verse_text}</span>
            <span className="mt-1 block font-sans text-[0.68rem] font-semibold tracking-[0.18em] uppercase text-[var(--gold-text)]">
              {formatReference(f.verse_reference)}
            </span>
          </span>
        )}
        <span
          className={`mt-3 block font-serif text-[1rem] leading-[1.5] text-[var(--ink-soft)] ${long && !open ? "line-clamp-3" : ""}`}
        >
          {f.response}
        </span>
        {long && (
          <span className="mt-1 block font-sans text-[0.8rem] font-medium text-[var(--gold-text)]">
            {open ? "Toca para resumir" : "Toca para leer todo"}
          </span>
        )}
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {tts.supported && (
          <button
            type="button"
            onClick={() => toggle(ttsId, "Favorita", speakable(f.response))}
            className={`${PILL} ${reading !== "idle" ? "!border-[var(--gold)] !text-[var(--gold-text)]" : ""}`}
          >
            {reading === "playing" ? <PauseIcon size={13} /> : <SpeakerIcon size={15} />}
            {reading === "playing" ? "Pausar" : reading === "paused" ? "Continuar" : "Escuchar"}
          </button>
        )}
        <Link href={`/chat?c=${f.conversation_id}`} className={PILL}>
          Abrir conversación
        </Link>
      </div>
    </li>
  );
}

function Empty({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="mt-10 text-center px-2">
      <div className="mx-auto grid place-items-center w-14 h-14 rounded-full bg-[var(--vellum)] text-[var(--vino)]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </div>
      <p className="mt-4 font-display text-[1.2rem] text-[var(--ink)]">{title}</p>
      <p className="mt-2 mx-auto max-w-[34ch] font-sans text-[0.9rem] leading-relaxed text-[var(--ink-soft)]">
        {body}
      </p>
      <div className="mt-5 flex justify-center">{action}</div>
    </div>
  );
}
