"use client";

import { useState } from "react";
import Link from "next/link";
import { speakable, toggle, useTts } from "@/lib/tts";
import { PauseIcon, SpeakerIcon } from "@/components/ReadAloudPlayer";

/**
 * Action row under each completed turn — listen, heart (favorite) and share.
 *
 * The heart only shows with an account: it saves the response to "Mis
 * favoritas" (/favoritas), which a guest has nowhere to keep. Right after
 * hearting, a "Ver favoritas" pill says where it went.
 *
 * Listen reads the pastoral response aloud (lib/tts.ts). Only the response:
 * it already quotes the verse word for word, so reading the verse card too
 * would say it twice. Hidden where the browser has no speech synthesis.
 *
 * The heart is now a controlled component: the parent manages the liked
 * state and persists it to Supabase when the user is signed in. That way
 * the like survives reload, navigation away and back, and any other
 * remount of the chat page.
 *
 * Share uses the Web Share API where available, with a clipboard copy
 * fallback (no auth required, always works).
 */
export function TurnActions({
  id,
  question,
  verse,
  response,
  liked,
  onToggleLike,
  canLike,
}: {
  /** Turn id — identifies this response in the shared reader. */
  id: string;
  question: string;
  verse?: { reference: string; text: string } | null;
  response?: string;
  liked: boolean;
  onToggleLike: () => void;
  /** Signed in? Without an account there's nowhere to save, so no heart. */
  canLike: boolean;
}) {
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  // Set when the user hearts this turn now (not for turns loaded already
  // liked), so the "Ver favoritas" hint appears only as feedback.
  const [justLiked, setJustLiked] = useState(false);
  const tts = useTts();
  const ttsId = `turn:${id}`;
  const reading = tts.id === ttsId ? tts.status : "idle";

  function buildShareText(): string {
    const parts: string[] = [];
    parts.push(question);
    if (verse) {
      parts.push("");
      parts.push(`"${verse.text}"`);
      parts.push(`— ${verse.reference}`);
    }
    if (response) {
      parts.push("");
      parts.push(response);
    }
    parts.push("");
    parts.push("— Habla con la Palabra");
    return parts.join("\n");
  }

  async function onShare() {
    const text = buildShareText();
    type NavWithShare = Navigator & { share?: (data: ShareData) => Promise<void> };
    const nav = navigator as NavWithShare;

    if (typeof nav.share === "function") {
      try {
        await nav.share({ text, title: "Habla con la Palabra" });
        return;
      } catch {
        // user cancelled or share failed — fall through to copy
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 1500);
    } catch {
      // ignore — clipboard not available
    }
  }

  // Labelled pills, not bare icons: a speaker, a heart and a share glyph
  // in circles didn't say what they did to the people this app is for.
  const base =
    "inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-full border font-sans text-[min(0.84rem,14px)] font-medium transition-colors";
  const neutral =
    "border-[var(--rule)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--gold)] hover:text-[var(--gold-text)] hover:bg-[var(--vellum)]";

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3 mb-1">
      {tts.supported && response && (
        <button
          type="button"
          onClick={() => toggle(ttsId, "Respuesta", speakable(response))}
          aria-pressed={reading !== "idle"}
          className={`${base} ${
            reading !== "idle"
              ? "border-[var(--gold)] bg-[var(--vellum)] text-[var(--gold-text)]"
              : neutral
          }`}
        >
          {reading === "playing" ? <PauseIcon size={13} /> : <SpeakerIcon size={15} />}
          {reading === "playing" ? "Pausar" : reading === "paused" ? "Continuar" : "Escuchar"}
        </button>
      )}
      {canLike && (
        <button
          type="button"
          onClick={() => {
            setJustLiked(!liked);
            onToggleLike();
          }}
          aria-pressed={liked}
          className={`${base} ${
            liked
              ? "border-[var(--vino)]/40 bg-[var(--vino)]/8 text-[var(--vino)]"
              : "border-[var(--rule)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--vino)]/40 hover:text-[var(--vino)] hover:bg-[var(--vino)]/5"
          }`}
        >
          <HeartIcon filled={liked} />
          {liked ? "Guardada" : "Guardar"}
        </button>
      )}
      <button type="button" onClick={onShare} className={`${base} ${neutral}`}>
        {shareState === "copied" ? <CheckIcon /> : <ShareIcon />}
        {shareState === "copied" ? "Copiado" : "Compartir"}
      </button>
      {canLike && liked && justLiked && (
        <Link
          href="/favoritas"
          className="anim-fade-in inline-flex items-center gap-1 min-h-[38px] px-3.5 rounded-full border border-[var(--vino)]/30 bg-[var(--surface)] font-sans text-[min(0.84rem,14px)] font-medium text-[var(--vino)] hover:bg-[var(--vino)]/[0.06] transition-colors"
        >
          Ver favoritas
        </Link>
      )}
    </div>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
      <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
