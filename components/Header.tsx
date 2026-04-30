import Link from "next/link";
import { LatinCross } from "./Cross";

/**
 * Chat header.
 *
 * The bottom nav now handles "go to home" — so we don't ship a back arrow
 * here. We also dropped the export/save button from the header (it lived
 * here for power-users); when we revisit the export flow it'll move into
 * a dedicated overflow menu so it doesn't compete with the new bottom nav
 * entry for "Guardados".
 *
 * What stays: the optional history hamburger (signed-in users browsing
 * past conversations) and the title.
 */
export function Header({
  onOpenHistory,
  conversationTitle,
}: {
  onOpenHistory?: () => void;
  /** Title of the currently-loaded saved conversation (if any). When set,
   *  appears as a discreet subtitle under the app title so the user knows
   *  which past conversation they're continuing. */
  conversationTitle?: string | null;
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
