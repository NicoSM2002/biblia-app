"use client";

import { useEffect, useState } from "react";
import { LatinCross } from "./Cross";

/**
 * Splash overlay — a brief moment of stillness when the app first opens.
 * Just a breathing cross on a paper background. Auto-dismisses after a
 * short delay so the user lands on the home naturally.
 *
 * This replaces the previous daily-verse overlay; the actual verse now
 * lives as a section inside the home page itself.
 *
 * Like the old overlay, we use sessionStorage so the splash only appears
 * on a fresh load (or reload), not on every internal navigation back to
 * the home.
 */
const VISIBLE_MS = 1100;
const FADE_MS = 500;

export function Splash() {
  const [phase, setPhase] = useState<"visible" | "fading" | "gone">(() => {
    if (typeof window === "undefined") return "gone";
    try {
      // Same trick as daily verse: type === 'reload' clears the seen flag,
      // anything else (in-app nav, deep link, etc.) honors it.
      const entries = performance.getEntriesByType(
        "navigation",
      ) as PerformanceNavigationTiming[];
      const navType = entries[0]?.type ?? "navigate";
      if (navType !== "reload") {
        if (sessionStorage.getItem("splashSeen") === "1") return "gone";
      }
    } catch {
      // ignore
    }
    return "visible";
  });

  useEffect(() => {
    if (phase !== "visible") return;
    const t1 = setTimeout(() => setPhase("fading"), VISIBLE_MS);
    const t2 = setTimeout(() => {
      setPhase("gone");
      try {
        sessionStorage.setItem("splashSeen", "1");
      } catch {
        // ignore
      }
    }, VISIBLE_MS + FADE_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[80] grid place-items-center bg-[var(--paper)] no-print"
      style={{
        opacity: phase === "fading" ? 0 : 1,
        transition: `opacity ${FADE_MS}ms cubic-bezier(0.2, 0.7, 0.2, 1)`,
        pointerEvents: phase === "fading" ? "none" : "auto",
      }}
    >
      <div className="cross-breathing">
        <LatinCross className="text-[var(--gold)]" size={40} />
      </div>
    </div>
  );
}
