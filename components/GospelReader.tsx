"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { DailyGospel } from "@/lib/daily-gospel";
import { cleanVerse, gospelBook, gospelSpeech } from "@/lib/gospel-text";
import { toggle, useTts } from "@/lib/tts";
import { PauseIcon, SpeakerIcon } from "@/components/ReadAloudPlayer";

/**
 * The whole Gospel of the day, full screen. "Leer completo" used to stretch
 * the home card until it filled the page: the context was lost, the
 * "keep scrolling" arrow sat on the text, and closing meant scrolling to
 * the end. Here: a fixed close button, the liturgical frame ("Lectura del
 * santo Evangelio…" / "Palabra del Señor"), and a bar that stays put with
 * Escuchar and a way into the conversation.
 *
 * Text uses font-serif, so Ajustes (size, Clásica/Sencilla) applies.
 */
export function GospelReader({
  gospel,
  onClose,
  onAsk,
}: {
  gospel: DailyGospel;
  onClose: () => void;
  onAsk: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const tts = useTts();
  const ttsId = `gospel:${gospel.reference}`;
  const reading = tts.id === ttsId ? tts.status : "idle";

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reader-title"
      className="reader-in fixed inset-0 z-[70] flex flex-col bg-[var(--paper)] text-[var(--ink)]"
    >
      <header className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-[var(--rule)]">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Cerrar el Evangelio"
          className="grid place-items-center w-11 h-11 shrink-0 rounded-full border border-[var(--rule)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--gold)] hover:text-[var(--gold-text)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <p className="flex-1 text-center font-sans text-[min(0.95rem,16px)] font-medium pr-11">
          Evangelio del día
        </p>
      </header>

      <div className="flex-1 overflow-y-auto">
        <article className="max-w-2xl mx-auto px-6 pt-6 pb-10">
          <p className="font-sans text-[min(0.7rem,11px)] font-semibold tracking-[0.2em] uppercase text-[var(--gold-text)]">
            {gospel.title}
          </p>
          <h2 id="reader-title" className="mt-1.5 font-display text-[min(1.9rem,32px)] leading-tight">
            {gospel.reference}
          </h2>
          <p className="mt-4 font-serif italic text-[1rem] text-[var(--ink-soft)]">
            Lectura del santo Evangelio según san {gospelBook(gospel)}
          </p>
          <p
            className="mt-4 font-serif text-[1.18rem] leading-[1.65]"
            style={{ textWrap: "pretty" as React.CSSProperties["textWrap"] }}
          >
            {gospel.verses.map((v, i) => (
              <span key={`${v.capitulo}:${v.versiculo}`}>
                {i > 0 && " "}
                <sup className="font-sans text-[0.6em] font-semibold text-[var(--gold-text)] mr-0.5">
                  {v.versiculo}
                </sup>
                {cleanVerse(v.texto)}
              </span>
            ))}
          </p>
          <p className="mt-5 font-serif italic text-[1rem] text-[var(--ink-soft)]">Palabra del Señor.</p>
        </article>
      </div>

      <div
        className="flex gap-2.5 px-5 pt-3 border-t border-[var(--rule)] bg-[var(--paper)]"
        style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}
      >
        {tts.supported && (
          <button
            type="button"
            onClick={() => toggle(ttsId, "Evangelio del día", gospelSpeech(gospel))}
            className={`flex-1 inline-flex items-center justify-center gap-2 min-h-[48px] rounded-full border font-sans text-[min(0.95rem,16px)] font-semibold transition-colors ${
              reading !== "idle"
                ? "border-[var(--gold)] bg-[var(--vellum)] text-[var(--gold-text)]"
                : "border-[color-mix(in_srgb,var(--gold)_45%,transparent)] bg-[var(--surface)] text-[var(--gold-text)] hover:border-[var(--gold)]"
            }`}
          >
            {reading === "playing" ? <PauseIcon size={14} /> : <SpeakerIcon size={17} />}
            {reading === "playing" ? "Pausar" : reading === "paused" ? "Continuar" : "Escuchar"}
          </button>
        )}
        <button
          type="button"
          onClick={onAsk}
          className="flex-[1.5] inline-flex items-center justify-center min-h-[48px] rounded-full bg-[var(--gold)] text-[var(--button-on-gold)] font-sans text-[min(0.95rem,16px)] font-semibold hover:bg-[var(--gold-soft)] transition-colors"
        >
          Preguntar sobre él
        </button>
      </div>
    </div>,
    document.body,
  );
}
