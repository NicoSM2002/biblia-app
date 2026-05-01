"use client";

import { useState } from "react";

type Theme = "light" | "dark";

/**
 * Theme toggle (sol / luna).
 *
 * The inline script in app/layout.tsx sets `data-theme="light"` on <html>
 * before any paint, so we can confidently start the React state in "light"
 * with no hydration mismatch and no need to hide the icon while we read
 * the DOM. The toggle then operates on local state — one click, one
 * change, no double-tap. View Transitions API gives the swap a soft
 * crossfade where supported.
 *
 * The choice is intentionally NOT persisted across reloads.
 */
export function ThemeToggle() {
  // Lazy init from the DOM — the inline init script in app/layout.tsx
  // sets data-theme BEFORE hydration, so reading it here gives us the
  // true current theme. Without this lazy read, the state would default
  // to "light" while the DOM was already "dark" on the first render,
  // making the very first toggle click a no-op (it would try to apply
  // the same theme the DOM already had).
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === "undefined") return "light";
    return (document.documentElement.getAttribute("data-theme") ||
      "light") as Theme;
  });

  function toggle() {
    // Read the DOM at click time too — bulletproof against any code path
    // that mutates data-theme outside of this component.
    const current = (document.documentElement.getAttribute("data-theme") ||
      theme) as Theme;
    const next: Theme = current === "dark" ? "light" : "dark";
    // Apply synchronously, no view-transition wrapper. The previous
    // implementation wrapped this in document.startViewTransition() for a
    // crossfade, but on iOS Safari the first click would sometimes feel
    // like a no-op because the user perceived the queued transition as
    // "nothing happened". Synchronous = one click, instantaneous swap.
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Activar modo claro" : "Activar modo noche"}
      title={theme === "dark" ? "Modo claro" : "Modo noche"}
      className="grid place-items-center w-11 h-11 rounded-full text-[var(--ink-soft)] hover:bg-[var(--vellum)] hover:text-[var(--gold-text)] active:scale-95 transition-all shrink-0"
      style={{ touchAction: "manipulation" }}
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
