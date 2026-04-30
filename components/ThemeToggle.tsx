"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/**
 * Reads the current theme from <html data-theme="…"> on mount and lets the
 * user toggle between light and dark within the current session. The initial
 * value is hardcoded to "light" by the inline script in app/layout.tsx — the
 * choice is intentionally NOT persisted, so every fresh page load starts in
 * light mode. (The user explicitly asked for this behavior; persisting via
 * localStorage was causing confusion when the OS dark preference and saved
 * choice diverged.)
 *
 * The visible theme transition uses the View Transitions API where
 * supported.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") ||
      "light") as Theme;
    setTheme(current);
    setMounted(true);
  }, []);

  function applyTheme(next: Theme) {
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
  }

  function toggle() {
    // Always read the *current* DOM theme — covers the case where the
    // component just mounted and our state may still be stale.
    const current = (document.documentElement.getAttribute("data-theme") ||
      "light") as Theme;
    const next: Theme = current === "dark" ? "light" : "dark";

    // View Transitions API gives us a free crossfade between old/new
    // root snapshots.
    type DocWithVT = Document & {
      startViewTransition?: (cb: () => void) => unknown;
    };
    const doc = document as DocWithVT;
    if (typeof doc.startViewTransition === "function") {
      doc.startViewTransition(() => applyTheme(next));
    } else {
      applyTheme(next);
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Activar modo claro" : "Activar modo noche"}
      title={theme === "dark" ? "Modo claro" : "Modo noche"}
      className="grid place-items-center w-11 h-11 rounded-full text-[var(--ink-soft)] hover:bg-[var(--vellum)] hover:text-[var(--gold-text)] transition-colors shrink-0"
      // Avoid a hydration warning if the icon differs between server and
      // client — the icon depends on the theme attribute, which is set by
      // the inline script before hydration.
      suppressHydrationWarning
    >
      {/* Hide the icon until the client has read the actual theme so the
          server-rendered icon doesn't briefly mismatch. */}
      <span style={{ visibility: mounted ? "visible" : "hidden" }}>
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </span>
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
