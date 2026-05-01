"use client";

import { useState } from "react";

type Turn = {
  question: string;
  verse?: { reference: string; text: string } | null;
  response?: string;
};

/**
 * Share-the-whole-conversation button. Lives in the chat header, only
 * visible when there's at least one completed turn. Uses Web Share API
 * where available (iOS / Android share sheet), falls back to copying
 * the formatted transcript to the clipboard.
 */
export function ShareConversation({ turns }: { turns: Turn[] }) {
  const [state, setState] = useState<"idle" | "copied">("idle");

  if (turns.length === 0) return null;

  async function onShare() {
    const text = buildText(turns);
    type NavWithShare = Navigator & {
      share?: (data: ShareData) => Promise<void>;
    };
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
      setState("copied");
      setTimeout(() => setState("idle"), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={onShare}
      aria-label={
        state === "copied"
          ? "Conversación copiada"
          : "Compartir conversación"
      }
      title="Compartir conversación"
      className="grid place-items-center w-10 h-10 rounded-full border border-[var(--rule)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--gold)] hover:text-[var(--gold-text)] hover:bg-[var(--vellum)] transition-all duration-200 shrink-0"
      style={{ touchAction: "manipulation" }}
    >
      {state === "copied" ? <CheckIcon /> : <ShareIcon />}
    </button>
  );
}

function buildText(turns: Turn[]): string {
  const lines: string[] = ["Habla con la Palabra", ""];
  turns.forEach((t, i) => {
    if (i > 0) lines.push("", "—".repeat(20), "");
    lines.push(`Pregunta: ${t.question}`);
    if (t.verse) {
      lines.push("");
      lines.push(`"${t.verse.text}"`);
      lines.push(`— ${t.verse.reference}`);
    }
    if (t.response) {
      lines.push("");
      lines.push(t.response);
    }
  });
  return lines.join("\n");
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
