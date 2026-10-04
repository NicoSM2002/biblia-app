import Link from "next/link";
import { LatinCross } from "./Cross";

/**
 * Chat header.
 *
 * Bottom nav handles "go to home" — no back arrow here.
 *
 * Left: "Historial" (signed in). Right: "Nueva" (when there's something to
 * reset). Both are labelled pills — they used to be bare ☰ and ↻ icons, and
 * ↻ in particular never read as "start a new conversation". Sharing the
 * whole conversation moved to the end of the conversation itself.
 */
export function Header({
  onOpenHistory,
  onReset,
  conversationTitle,
}: {
  onOpenHistory?: () => void;
  /** Reset the chat to an empty state — clears turns and active
   *  conversation. Hidden when there's nothing to reset. */
  onReset?: () => void;
  /** Title of the currently-loaded saved conversation (if any). When set,
   *  appears as a discreet subtitle under the app title so the user knows
   *  which past conversation they're continuing. */
  conversationTitle?: string | null;
}) {
  // With both pills on a phone there's no room for the app name: keep the
  // cross (still the link home) and the name for screen readers.
  const crowded = !!onOpenHistory && !!onReset;
  return (
    <header className="page-head-fade relative z-30 px-5 sm:px-6 pt-5 pb-3 border-b border-[var(--rule)] bg-[var(--paper)] no-print">
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
              <h1 className={`font-sans text-[1rem] sm:text-[1.05rem] font-medium text-[var(--ink)] tracking-[0.005em] truncate ${crowded ? "sr-only min-[440px]:not-sr-only" : ""}`}>
                Habla con la Palabra
              </h1>
            </span>
            {conversationTitle && !crowded && (
              <span
                className="font-serif text-[0.82rem] text-[var(--ink-soft)] truncate ml-[22px] sm:ml-[26px] mt-0.5"
                title={conversationTitle}
              >
                {conversationTitle}
              </span>
            )}
          </Link>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {onReset && <NewConversationButton onClick={onReset} />}
        </div>
      </div>
    </header>
  );
}

const PILL =
  "inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-full border border-[var(--rule)] bg-[var(--surface)] font-sans text-[min(0.86rem,14px)] font-medium text-[var(--ink-soft)] hover:border-[var(--gold)] hover:text-[var(--gold-text)] hover:bg-[var(--vellum)] transition-colors shrink-0";

function HistoryButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={PILL}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 14" />
      </svg>
      Historial
    </button>
  );
}

function NewConversationButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Empezar una nueva conversación"
      className={PILL}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      Nueva
    </button>
  );
}
