import Link from "next/link";
import { LatinCross } from "./Cross";
import { ShareConversation } from "./ShareConversation";
import type { ExportableTurn } from "@/lib/export";

/**
 * Chat header.
 *
 * Bottom nav handles "go to home" — no back arrow here.
 *
 * Right side: share-the-whole-conversation button (when there's at least
 * one turn) + new-conversation button (when there's something to reset).
 */
export function Header({
  onOpenHistory,
  onReset,
  conversationTitle,
  shareableTurns = [],
}: {
  onOpenHistory?: () => void;
  /** Reset the chat to an empty state — clears turns and active
   *  conversation. Hidden when there's nothing to reset. */
  onReset?: () => void;
  /** Title of the currently-loaded saved conversation (if any). When set,
   *  appears as a discreet subtitle under the app title so the user knows
   *  which past conversation they're continuing. */
  conversationTitle?: string | null;
  /** Completed turns. Used to render the share-conversation button. */
  shareableTurns?: ExportableTurn[];
}) {
  return (
    <header className="relative z-30 px-4 sm:px-6 pt-5 pb-3 border-b border-[var(--rule)] bg-[var(--paper)] no-print">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {onOpenHistory && <HistoryButton onClick={onOpenHistory} />}
          <Link
            href="/"
            aria-label="Inicio"
            className="flex flex-col min-w-0 group ml-1"
          >
            <span className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <LatinCross
                className="text-[var(--gold)] shrink-0 transition-opacity group-hover:opacity-80"
                size={14}
              />
              <h1 className="font-sans text-[1rem] sm:text-[1.05rem] font-medium text-[var(--ink)] tracking-[0.005em] truncate">
                Habla con la Palabra
              </h1>
            </span>
            {conversationTitle && (
              <span
                className="font-serif italic text-[0.78rem] text-[var(--ink-soft)] truncate ml-[22px] sm:ml-[26px] mt-0.5"
                title={conversationTitle}
              >
                {conversationTitle}
              </span>
            )}
          </Link>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {shareableTurns.length > 0 && (
            <ShareConversation turns={shareableTurns} />
          )}
          {onReset && <NewConversationButton onClick={onReset} />}
        </div>
      </div>
    </header>
  );
}

function HistoryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Abrir historial"
      className="grid place-items-center w-10 h-10 rounded-full text-[var(--ink-soft)] hover:bg-[var(--vellum)] hover:text-[var(--gold-text)] transition-colors shrink-0"
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="15" y2="12" />
        <line x1="3" y1="18" x2="18" y2="18" />
      </svg>
    </button>
  );
}

function NewConversationButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Empezar una nueva conversación"
      title="Nueva conversación"
      className="group grid place-items-center w-10 h-10 rounded-full border border-[var(--rule)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--gold)] hover:text-[var(--gold-text)] hover:bg-[var(--vellum)] transition-all duration-200 shrink-0"
    >
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
        className="transition-transform duration-500 group-hover:-rotate-180"
      >
        <path d="M3 12a9 9 0 0 1 15.5-6.4L21 8" />
        <polyline points="21 3 21 8 16 8" />
        <path d="M21 12a9 9 0 0 1-15.5 6.4L3 16" />
        <polyline points="3 21 3 16 8 16" />
      </svg>
    </button>
  );
}
