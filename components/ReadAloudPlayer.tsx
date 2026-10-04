"use client";

import { cycleRate, pause, resume, stop, useTts } from "@/lib/tts";

/**
 * Mini player for Lectura por voz: a strip directly under each page's header
 * while something is being read (or is paused). It's a normal flex child of
 * the page column, so it pushes the scrolling content down instead of
 * covering it — and the input/nav at the bottom stay untouched. (It used to
 * sit on top of the bottom nav; stacked with the chat input it looked
 * cramped.) Each page renders it right after its header; renders nothing
 * when idle.
 *
 * Controls: speed (0.85× / 1× / 1.15×), play-pause, stop. The progress
 * shows sentence N of M — the browser gives no reliable time position.
 */
export function ReadAloudPlayer() {
  const tts = useTts();
  if (tts.status === "idle") return null;
  const playing = tts.status === "playing";
  const progress = tts.total ? ((tts.index + 1) / tts.total) * 100 : 0;

  return (
    <section
      aria-label="Lectura por voz"
      className="player-in relative z-10 shrink-0 border-b border-[var(--rule)] bg-[var(--vellum)] no-print"
    >
      <div className="max-w-2xl mx-auto px-5 sm:px-6 pt-2 pb-2 flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={`sound-bars shrink-0 ${playing ? "" : "is-paused"}`}
        >
          <i />
          <i />
          <i />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-sans text-[0.84rem] font-semibold text-[var(--ink)] truncate">
            {tts.title}
          </p>
          <p className="font-sans text-[0.72rem] text-[var(--ink-faint)]" aria-live="polite">
            {playing ? "Leyendo" : "En pausa"} · {tts.index + 1} de {tts.total}
          </p>
        </div>
        <button
          type="button"
          onClick={cycleRate}
          aria-label={`Velocidad ${String(tts.rate).replace(".", ",")}x. Cambiar velocidad`}
          className="min-w-[44px] h-9 px-2 rounded-full border border-[var(--rule)] bg-[var(--surface)] font-sans text-[0.78rem] font-semibold text-[var(--ink-soft)] hover:border-[var(--gold)] transition-colors"
        >
          {String(tts.rate).replace(".", ",")}×
        </button>
        <button
          type="button"
          onClick={playing ? pause : resume}
          aria-label={playing ? "Pausar lectura" : "Continuar lectura"}
          className="grid place-items-center w-10 h-10 rounded-full bg-[var(--gold)] text-[var(--button-on-gold)] hover:bg-[var(--gold-soft)] active:scale-95 transition-all"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          type="button"
          onClick={stop}
          aria-label="Detener lectura"
          className="grid place-items-center w-9 h-9 rounded-full border border-[var(--rule)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--vino)] hover:text-[var(--vino)] transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div aria-hidden="true" className="h-[2px] bg-[var(--rule)] overflow-hidden">
        <div
          className="h-full bg-[var(--gold)] transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </section>
  );
}

export function PlayIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
    </svg>
  );
}

export function PauseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6.5" y="5" width="4" height="14" rx="1.2" />
      <rect x="13.5" y="5" width="4" height="14" rx="1.2" />
    </svg>
  );
}

export function SpeakerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}
