"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/**
 * Reads the current theme from <html data-theme="…"> on mount and lets the
 * user toggle between light and dark. The initial value is set by the inline
 * script in app/layout.tsx (so there's no flash on first paint).
 *
 * The user's explicit choice is persisted in localStorage; without a saved
 * choice the app follows the OS `prefers-color-scheme` automatically.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") ||
      "light") as Theme;
    setTheme(current);
    // Keep in sync if the OS preference changes mid-session AND the user
    // hasn't picked one explicitly.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function onSystem(e: MediaQueryListEvent) {
      if (!localStorage.getItem("theme")) {
        const next: Theme = e.matches ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", next);
        setTheme(next);
      }
    }
    mq.addEventListener?.("change", onSystem);
    return () => mq.removeEventListener?.("change", onSystem);
  }, []);

  if (theme === null) {
    // Reserve space (44px) so the header layout doesn't shift after hydrate.
    return <span aria-hidden="true" className="inline-block w-11 h-11 shrink-0" />;
  }

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // ignore (private mode etc.)
    }
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={
        theme === "dark"
          ? "Activar modo claro"
          : "Activar modo noche"
      }
      title={theme === "dark" ? "Modo claro" : "Modo noche"}
      className="grid place-items-center w-11 h-11 rounded-full text-[var(--ink-soft)] hover:bg-[var(--vellum)] hover:text-[var(--gold-text)] transition-colors shrink-0"
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4.5" />
      <line x1="12" y1="19.5" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4.5" y2="12" />
      <line x1="19.5" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="4.93" x2="6.7" y2="6.7" />
      <line x1="17.3" y1="17.3" x2="19.07" y2="19.07" />
      <line x1="4.93" y1="19.07" x2="6.7" y2="17.3" />
      <line x1="17.3" y1="6.7" x2="19.07" y2="4.93" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
