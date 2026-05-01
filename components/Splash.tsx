"use client";

import { useEffect, useState } from "react";
import { LatinCross } from "./Cross";

/**
 * Splash overlay — a brief moment of stillness when the app first opens.
 *
 * Implementation note: we use a module-scoped boolean instead of
 * sessionStorage to track whether the splash already ran. Module state
 * persists across React mounts/remounts within the same JS execution
 * context (so navigating to /chat and back doesn't replay the splash),
 * but a hard reload (F5 / Cmd+R) reloads the JS bundle and resets the
 * flag — which is exactly the behavior the user wants.
 */
const VISIBLE_MS = 1400;
const FADE_MS = 500;

let alreadyShown = false;

export function Splash() {
  const [phase, setPhase] = useState<"visible" | "fading" | "gone">(() => {
    if (typeof window === "undefined") return "gone";
    if (alreadyShown) return "gone";
    alreadyShown = true;
    return "visible";
  });

  useEffect(() => {
    if (phase !== "visible") return;
    const t1 = setTimeout(() => setPhase("fading"), VISIBLE_MS);
    const t2 = setTimeout(() => setPhase("gone"), VISIBLE_MS + FADE_MS);
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
        <LatinCross className="text-[var(--gold)]" size={44} />
      </div>
    </div>
  );
}
