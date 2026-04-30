"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Conversation = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export function HistorySheet({
  open,
  onClose,
  onSelect,
  activeId,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  activeId?: string | null;
}) {
  const [list, setList] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        setError("Necesitas iniciar sesión para ver tu historial.");
        return;
      }
      try {
        const res = await fetch("/api/conversations");
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = (await res.json()) as { conversations: Conversation[] };
        setList(json.conversations);
      } catch {
        setError("No pudimos cargar tu historial. Intenta más tarde.");
      }
    });
  }, [open]);

  // Esc to close + focus trap (Tab cycles within the sheet) + restore the
  // previously focused element when the sheet closes.
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement;
    // Move initial focus to the close button so keyboard users land somewhere
    // useful inside the sheet.
    setTimeout(() => closeButtonRef.current?.focus(), 50);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && sheetRef.current) {
        const focusables = sheetRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Return focus to wherever the user was before opening the sheet.
      previouslyFocusedRef.current?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-[60] bg-[var(--ink)]/30 backdrop-blur-[1px] no-print"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            ref={sheetRef}
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-sheet-title"
            className={cn(
              "fixed top-0 left-0 bottom-0 z-[70] flex flex-col no-print",
              "w-[88%] max-w-[360px] bg-[var(--paper)] border-r border-[var(--rule)]",
              "shadow-[6px_0_24px_-12px_rgba(31,27,22,0.25)]",
            )}
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
          >
            <header className="px-5 pt-5 pb-3 border-b border-[var(--rule)] flex items-center justify-between">
              <div>
                <p className="font-sans text-[0.75rem] tracking-[0.18em] uppercase text-[var(--gold-text)] font-semibold">
                  Mi historial
                </p>
                <h2
                  id="history-sheet-title"
                  className="font-serif italic text-[1.2rem] text-[var(--ink)] mt-0.5"
                >
                  Tus conversaciones
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                onClick={onClose}
                aria-label="Cerrar historial"
                className="grid place-items-center w-11 h-11 rounded-full hover:bg-[var(--vellum)] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
              {error ? (
                <p className="font-sans text-[0.92rem] text-[var(--vino)]">{error}</p>
              ) : list === null ? (
                <SkeletonList />
              ) : list.length === 0 ? (
                <p className="font-sans text-[0.92rem] text-[var(--ink-soft)] leading-relaxed">
                  Aún no hay conversaciones guardadas. Las que tengas con
                  sesión iniciada quedarán aquí.
                </p>
              ) : (
                <ul className="space-y-2">
                  {list.map((c, i) => (
                    <motion.li
                      key={c.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02, duration: 0.2 }}
                    >
                      <button
                        onClick={() => onSelect(c.id)}
                        className={cn(
                          "w-full text-left bg-white border rounded-lg px-3.5 py-3 transition-colors",
                          activeId === c.id
                            ? "border-[var(--gold)] bg-[var(--vellum)]"
                            : "border-[var(--rule)] hover:border-[var(--gold)] hover:bg-[var(--vellum)]",
                        )}
                      >
                        <p className="font-serif italic text-[0.95rem] text-[var(--ink)] leading-snug line-clamp-2">
                          {c.title || "(sin título)"}
                        </p>
                        <p className="font-sans text-[0.78rem] text-[var(--ink-soft)] mt-1">
                          {new Date(c.updated_at).toLocaleDateString("es-ES", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      </button>
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function SkeletonList() {
  return (
    <ul className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <li
          key={i}
          className="bg-white border border-[var(--rule)] rounded-lg px-3.5 py-3 animate-pulse"
        >
          <div className="h-3 bg-[var(--rule)] rounded w-3/4" />
          <div className="h-2 bg-[var(--rule)] rounded w-1/3 mt-2" />
        </li>
      ))}
    </ul>
  );
}
