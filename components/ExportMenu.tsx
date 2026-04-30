"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  type ExportableTurn,
  canNativeShare,
  copyConversation,
  printConversation,
  shareConversation,
} from "@/lib/export";

export function ExportMenu({ turns }: { turns: ExportableTurn[] }) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<
    "copying" | "copied" | "sharing" | null
  >(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  if (turns.length === 0) return null;

  async function handleShare() {
    if (feedback) return;
    setFeedback("sharing");
    try {
      await shareConversation(turns);
    } finally {
      setFeedback(null);
      setOpen(false);
    }
  }

  async function handleCopy() {
    if (feedback) return;
    setFeedback("copying");
    const ok = await copyConversation(turns);
    if (ok) {
      setFeedback("copied");
      setTimeout(() => {
        setFeedback(null);
        setOpen(false);
      }, 1200);
    } else {
      setFeedback(null);
    }
  }

  function handlePrint() {
    // Trigger print FIRST so we stay inside the user-gesture context. On
    // iOS Safari, calling window.print() after a React state update has
    // already unbatched can lose the gesture and the share/print sheet
    // never opens.
    printConversation();
    setOpen(false);
  }

  const showShare = canNativeShare();

  return (
    <div className="relative no-print" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Guardar o compartir conversación"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full border bg-white transition-all duration-200",
          open
            ? "border-[var(--gold)] text-[var(--gold-text)] bg-[var(--vellum)]"
            : "border-[var(--rule)] text-[var(--ink-soft)] hover:border-[var(--gold)] hover:text-[var(--gold-text)] hover:bg-[var(--vellum)]",
        )}
      >
        <SaveIcon />
        <span className="font-sans text-[0.78rem] sm:text-[0.82rem] font-medium">
          Guardar
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-56 border border-[var(--rule)] rounded-lg overflow-hidden z-50"
          style={{
            backgroundColor: "#ffffff",
            isolation: "isolate",
            boxShadow:
              "0 12px 28px -8px rgba(31, 27, 22, 0.22), 0 4px 10px -2px rgba(31, 27, 22, 0.08)",
          }}
        >
          {showShare && (
            <MenuItem onClick={handleShare} disabled={!!feedback}>
              <ShareIcon />
              {feedback === "sharing" ? "Abriendo…" : "Compartir"}
            </MenuItem>
          )}
          <MenuItem onClick={handleCopy} disabled={!!feedback}>
            <CopyIcon />
            {feedback === "copying"
              ? "Copiando…"
              : feedback === "copied"
                ? "¡Copiado!"
                : "Copiar texto"}
          </MenuItem>
          <MenuItem onClick={handlePrint} disabled={!!feedback}>
            <PdfIcon /> Guardar PDF
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[0.92rem] text-[var(--ink-soft)] hover:bg-[var(--vellum)] hover:text-[var(--ink)] transition-colors disabled:opacity-60 disabled:cursor-wait"
    >
      {children}
    </button>
  );
}

function SaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
      <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
function PdfIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="15" x2="15" y2="15" />
      <line x1="9" y1="18" x2="15" y2="18" />
    </svg>
  );
}
