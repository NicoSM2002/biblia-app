"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createClient,
  hasSessionCookie,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Avatar in the top-right of the home header (mockup pantalla 2).
 *
 * - Not signed in: shows a neutral user icon. Tap → /auth?modo=registro.
 * - Signed in: shows the first letter of the user's name (or email if no
 *   name is set). Tap → small menu with name/email + sign out.
 */
// Cache the user's name + email in sessionStorage so the avatar shows
// the right initial INSTANTLY on every page mount, instead of flashing a
// placeholder ("·") while supabase.auth.getUser() resolves async.
const CACHE_KEY = "homeAvatarUser";

type CachedUser = { name: string | null; email: string | null };

function readCachedUser(): CachedUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedUser;
  } catch {
    return null;
  }
}

function writeCachedUser(user: CachedUser) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

export function HomeAvatar() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean>(() =>
    isSupabaseConfigured() ? hasSessionCookie() : false,
  );
  // Read cached user data synchronously on first render so the avatar
  // shows the correct initial immediately, no placeholder flash.
  const [name, setName] = useState<string | null>(
    () => readCachedUser()?.name ?? null,
  );
  const [email, setEmail] = useState<string | null>(
    () => readCachedUser()?.email ?? null,
  );
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      const newName =
        (user?.user_metadata?.full_name as string | undefined) ??
        (user?.user_metadata?.name as string | undefined) ??
        null;
      const newEmail = user?.email ?? null;
      setSignedIn(!!user);
      setEmail(newEmail);
      setName(newName);
      writeCachedUser({ name: newName, email: newEmail });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const user = session?.user ?? null;
      const newName =
        (user?.user_metadata?.full_name as string | undefined) ??
        (user?.user_metadata?.name as string | undefined) ??
        null;
      const newEmail = user?.email ?? null;
      setSignedIn(!!user);
      setEmail(newEmail);
      setName(newName);
      writeCachedUser({ name: newName, email: newEmail });
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
        href="/auth?modo=registro"
        aria-label="Crear cuenta o iniciar sesión"
        className="grid place-items-center w-10 h-10 rounded-full border border-[var(--rule)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--gold)] hover:text-[var(--gold-text)] hover:bg-[var(--vellum)] transition-all"
      >
        <UserIcon />
      </Link>
    );
  }

  // Prefer the real initial, but if neither name nor email has loaded
  // yet (cookie says signed in, but getUser() is still resolving and we
  // don't have a sessionStorage cache), show the UserIcon instead of a
  // placeholder dot so the avatar looks intentional, not "loading".
  const initial =
    name?.[0]?.toUpperCase() ?? email?.[0]?.toUpperCase() ?? null;

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Cuenta"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "grid place-items-center w-10 h-10 rounded-full border transition-all",
          open
            ? "border-[var(--gold)] bg-[var(--vellum)] text-[var(--gold-text)]"
            : "border-[var(--rule)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--gold)] hover:text-[var(--gold-text)] hover:bg-[var(--vellum)]",
        )}
      >
        {initial ? (
          <span className="font-sans text-[0.85rem] font-semibold">{initial}</span>
        ) : (
          <UserIcon />
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-60 border border-[var(--rule)] rounded-lg overflow-hidden z-50"
          style={{
            backgroundColor: "var(--surface)",
            boxShadow:
              "0 12px 28px -8px rgba(var(--shadow-color), 0.22), 0 4px 10px -2px rgba(var(--shadow-color), 0.08)",
          }}
        >
          <div className="px-3.5 py-3 border-b border-[var(--rule)]">
            {name && (
              <p className="font-serif italic text-[0.95rem] text-[var(--ink)] truncate">
                {name}
              </p>
            )}
            <p className="font-sans text-[0.78rem] text-[var(--ink-soft)] truncate">
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
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
