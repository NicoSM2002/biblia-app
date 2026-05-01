"use client";

import { useState } from "react";

/**
 * Action row under each completed turn — heart (favorite) and share.
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
  question,
  verse,
  response,
  liked,
  onToggleLike,
}: {
  question: string;
  verse?: { reference: string; text: string } | null;
  response?: string;
  liked: boolean;
  onToggleLike: () => void;
}) {
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");

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

  return (
    <div className="flex items-center gap-2 mt-3 mb-1">
      <button
        type="button"
        onClick={onToggleLike}
        aria-label={liked ? "Quitar me gusta" : "Me gusta"}
        aria-pressed={liked}
        className={`grid place-items-center w-9 h-9 rounded-full border transition-colors ${
          liked
            ? "border-[var(--vino)]/40 bg-[var(--vino)]/8 text-[var(--vino)]"
            : "border-[var(--rule)] text-[var(--ink-faint)] hover:border-[var(--vino)]/40 hover:text-[var(--vino)] hover:bg-[var(--vino)]/5"
        }`}
      >
        <HeartIcon filled={liked} />
      </button>
      <button
        type="button"
        onClick={onShare}
        aria-label={shareState === "copied" ? "Copiado" : "Compartir"}
        className="grid place-items-center w-9 h-9 rounded-full border border-[var(--rule)] text-[var(--ink-faint)] hover:border-[var(--gold)] hover:text-[var(--gold-text)] hover:bg-[var(--vellum)] transition-colors"
      >
        {shareState === "copied" ? <CheckIcon /> : <ShareIcon />}
      </button>
      {shareState === "copied" && (
        <span className="font-sans text-[0.78rem] text-[var(--ink-soft)]">
          Copiado
        </span>
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
