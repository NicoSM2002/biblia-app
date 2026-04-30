import Link from "next/link";
import { LatinCross } from "./Cross";
import { ExportMenu } from "./ExportMenu";
import type { ExportableTurn } from "@/lib/export";

export function Header({
  onReset,
  onOpenHistory,
  exportableTurns = [],
}: {
  onReset?: () => void;
  onOpenHistory?: () => void;
  exportableTurns?: ExportableTurn[];
}) {
  const hasContent = exportableTurns.length > 0;
  return (
    <header className="relative z-30 px-4 sm:px-8 lg:px-10 pt-5 sm:pt-6 lg:pt-7 pb-4 lg:pb-5 border-b border-[var(--rule)] bg-[var(--paper)] no-print">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <BackButton />
          {onOpenHistory && <HistoryButton onClick={onOpenHistory} />}
          {/* Title — also clickable as a backup way back to the home. */}
          <Link
            href="/"
            aria-label="Volver al inicio"
            className="flex items-center gap-2 sm:gap-3 min-w-0 group ml-1"
          >
            <LatinCross
              className="text-[var(--gold-text)] lg:hidden shrink-0 transition-opacity group-hover:opacity-80"
              size={14}
            />
            <LatinCross
              className="text-[var(--gold-text)] hidden lg:block shrink-0 transition-opacity group-hover:opacity-80"
              size={18}
            />
            <h1 className="font-sans text-[1rem] sm:text-[1.05rem] lg:text-[1.15rem] font-medium text-[var(--ink)] tracking-[0.005em] truncate transition-colors group-hover:text-[var(--gold-text)]">
              Habla con la Palabra
            </h1>
          </Link>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasContent && <ExportMenu turns={exportableTurns} />}
          {onReset && <NewConversationButton onClick={onReset} />}
        </div>
      </div>
    </header>
  );
}

/**
 * Back arrow that returns the user to the home (`/`). Visually obvious so
 * a first-time visitor on /chat understands they can leave the conversation.
 */
function BackButton() {
  return (
    <Link
      href="/"
      aria-label="Volver al inicio"
      title="Volver al inicio"
      className="grid place-items-center w-11 h-11 rounded-full text-[var(--ink-soft)] hover:bg-[var(--vellum)] hover:text-[var(--gold-text)] transition-colors shrink-0"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
    </Link>
  );
}

function HistoryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Abrir historial"
      className="grid place-items-center w-11 h-11 rounded-full text-[var(--ink-soft)] hover:bg-[var(--vellum)] hover:text-[var(--gold-text)] transition-colors shrink-0"
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

/**
 * Icon-only "new conversation" button — a compact circle (matching the size
 * of the avatar) so the header stays calm.
 */
function NewConversationButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Empezar una nueva conversación"
      title="Nueva conversación"
      className="group grid place-items-center w-11 h-11 rounded-full border border-[var(--rule)] bg-white text-[var(--ink-soft)] hover:border-[var(--gold)] hover:text-[var(--gold-text)] hover:bg-[var(--vellum)] transition-all duration-200 shrink-0"
    >
      <svg
        width="15"
        height="15"
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
