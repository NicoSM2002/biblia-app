"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
// (Mi historial moved out of this menu to a dedicated icon in the header.)
import {
  createClient,
  hasSessionCookie,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function AuthButton() {
  const router = useRouter();
  // Seed signed-in flag from the auth-token cookie (sync) so the correct
  // shape (avatar vs. "Entrar" button) renders on first paint and the
  // header doesn't shift when the async getUser() resolves a moment later.
  const [signedIn, setSignedIn] = useState<boolean>(() =>
    isSupabaseConfigured() ? hasSessionCookie() : false,
  );
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setSignedIn(false);
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setSignedIn(!!data.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
      setSignedIn(!!session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

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

  if (!isSupabaseConfigured()) return null;

  if (!signedIn) {
    return (
      <Link
        href="/auth"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full border border-[var(--rule)] bg-white text-[var(--ink-soft)] hover:border-[var(--gold)] hover:text-[var(--gold-text)] hover:bg-[var(--vellum)] transition-all duration-200"
      >
        <UserIcon />
        <span className="font-sans text-[0.78rem] sm:text-[0.82rem] font-medium">
          Entrar
        </span>
      </Link>
    );
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.refresh();
  }

  // Initial of the email for the avatar circle. While the email is still
  // loading (cookie present but getUser hasn't resolved yet), fall back to
  // a neutral dot so the avatar geometry is identical to the final render.
  const initial = email ? email[0].toUpperCase() : "·";

  return (
    <div className="relative no-print" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Cuenta"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center justify-center w-11 h-11 rounded-full border transition-all duration-200",
          open
            ? "border-[var(--gold)] bg-[var(--vellum)] text-[var(--gold-text)]"
            : "border-[var(--rule)] bg-white text-[var(--ink-soft)] hover:border-[var(--gold)] hover:text-[var(--gold-text)] hover:bg-[var(--vellum)]",
        )}
      >
        <span className="font-sans text-[0.85rem] font-semibold">{initial}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-60 border border-[var(--rule)] rounded-lg overflow-hidden z-50"
          style={{
            backgroundColor: "#ffffff",
            isolation: "isolate",
            boxShadow:
              "0 12px 28px -8px rgba(31, 27, 22, 0.22), 0 4px 10px -2px rgba(31, 27, 22, 0.08)",
          }}
        >
          <div className="px-3.5 py-3 border-b border-[var(--rule)]">
            <p className="font-sans text-[0.7rem] tracking-[0.12em] uppercase text-[var(--ink-faint)]">
              Sesión iniciada
            </p>
            <p className="font-sans text-[0.85rem] text-[var(--ink)] truncate mt-0.5">
              {email}
            </p>
          </div>
          <button
            role="menuitem"
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[0.88rem] text-[var(--ink-soft)] hover:bg-[var(--vellum)] hover:text-[var(--ink)] transition-colors"
          >
            <ExitIcon /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </svg>
  );
}
function ExitIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
