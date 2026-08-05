"use client";

import { useEffect, useState } from "react";

/**
 * Splash overlay — a brief moment of stillness when the app first opens.
 *
 * It used to be a static cross fading its opacity up and down for 1.4s. Same
 * duration now, but the cross draws itself stroke by stroke and then dissolves
 * into a bloom of light, so the wait has a beginning and an end instead of
 * just being a wait.
 *
 * Implementation note: we use a module-scoped boolean instead of
 * sessionStorage to track whether the splash already ran. Module state
 * persists across React mounts/remounts within the same JS execution
 * context (so navigating to /chat and back doesn't replay the splash),
 * but a hard reload (F5 / Cmd+R) reloads the JS bundle and resets the
 * flag — which is exactly the behavior the user wants.
 *
 * The flag is flipped in an effect, never in the state initializer. Two
 * reasons, and the first one was a live bug:
 *
 *   1. The initializer used to return "gone" on the server and "visible" on
 *      the client, which is a hydration mismatch. React responded by throwing
 *      the tree away and re-rendering — and on that second render the flag was
 *      already true, so the splash returned "gone" and never appeared at all.
 *   2. Module state on the server is shared across every request, so setting
 *      the flag during render would make the server stop emitting the splash
 *      after the very first page load of the process.
 *
 * Rendering "visible" on both sides means the splash is in the server HTML
 * and paints before JS even arrives.
 */
const VISIBLE_MS = 1400;
const FADE_MS = 500;

let alreadyShown = false;

export function Splash() {
  const [phase, setPhase] = useState<"visible" | "fading" | "gone">(() =>
    alreadyShown ? "gone" : "visible",
  );

  useEffect(() => {
    if (phase !== "visible") return;
    alreadyShown = true;
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
      <div className="relative grid place-items-center">
        <span
          className="bloom absolute w-9 h-9 rounded-full"
          style={{
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--gold) 55%, transparent), transparent 70%)",
          }}
        />
        <DrawnCross />
      </div>
    </div>
  );
}

/**
 * The same Latin cross as components/Cross.tsx, but with the three strokes
 * as separate <line>s so each can draw in sequence via stroke-dashoffset.
 */
function DrawnCross() {
  return (
    <svg
      className="cross-draw relative"
      width="44"
      height="64"
      viewBox="0 0 24 36"
      fill="none"
      stroke="var(--gold)"
      strokeWidth="1.6"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <line x1="12" y1="2" x2="12" y2="34" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="9" y1="34" x2="15" y2="34" />
    </svg>
  );
}
