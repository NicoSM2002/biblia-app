import { LatinCross } from "./Cross";
import { ExportMenu } from "./ExportMenu";
import type { ExportableTurn } from "@/lib/export";

export function Header({
  onReset,
  exportableTurns = [],
}: {
  onReset?: () => void;
  exportableTurns?: ExportableTurn[];
}) {
  const hasContent = exportableTurns.length > 0;
  return (
    <header className="relative z-30 px-4 sm:px-8 lg:px-10 pt-5 sm:pt-6 lg:pt-7 pb-4 lg:pb-5 border-b border-[var(--rule)] bg-[var(--paper)] no-print">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <LatinCross className="text-[var(--gold)] lg:hidden shrink-0" size={14} />
          <LatinCross className="text-[var(--gold)] hidden lg:block shrink-0" size={18} />
          <h1 className="font-sans text-[1rem] sm:text-[1.05rem] lg:text-[1.15rem] font-medium text-[var(--ink)] tracking-[0.005em] truncate">
            Habla con la Palabra
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasContent && <ExportMenu turns={exportableTurns} />}
          {onReset && <NewConversationButton onClick={onReset} />}
        </div>
      </div>
    </header>
  );
}

function NewConversationButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Empezar una nueva conversación"
      className="group inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full border border-[var(--rule)] bg-white text-[var(--ink-soft)] hover:border-[var(--gold)] hover:text-[var(--gold)] hover:bg-[var(--vellum)] transition-all duration-200"
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
        {/* Circular refresh / "renew" arrow */}
        <path d="M3 12a9 9 0 0 1 15.5-6.4L21 8" />
        <polyline points="21 3 21 8 16 8" />
        <path d="M21 12a9 9 0 0 1-15.5 6.4L3 16" />
        <polyline points="3 21 3 16 8 16" />
      </svg>
      <span className="font-sans text-[0.78rem] sm:text-[0.82rem] font-medium">
        Nueva
      </span>
    </button>
  );
}
