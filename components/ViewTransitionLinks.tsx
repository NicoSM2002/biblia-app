"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Global click interceptor that wraps in-app navigation in
 * `document.startViewTransition()` so the browser plays a native
 * crossfade between the old and new page snapshots.
 *
 * Critical implementation detail: the listener is registered in **capture
 * phase** (the third arg to addEventListener is `true`). React's synthetic
 * event system, and any onClick handler on a Next.js <Link>, runs in
 * bubble phase — so without capture phase, Next.js's internal navigation
 * runs *before* our handler can take over. By the time we'd call
 * `startViewTransition`, the navigation is already in flight and the
 * snapshot would be wrong.
 *
 * In capture phase we:
 *   1. preventDefault()  — block the browser's default <a> navigation
 *   2. stopImmediatePropagation()  — stop React from getting the event
 *   3. start the view transition + router.push() ourselves
 *
 * We render a small fixed debug panel at the bottom-left while we're
 * verifying this works in production. Once confirmed, we'll set
 * SHOW_DEBUG to false.
 */
const SHOW_DEBUG = true;

export function ViewTransitionLinks() {
  const router = useRouter();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [intercepts, setIntercepts] = useState(0);
  const [lastHref, setLastHref] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    type DocWithVT = Document & {
      startViewTransition?: (cb: () => void) => unknown;
    };
    const doc = document as DocWithVT;
    const isSupported = typeof doc.startViewTransition === "function";
    setSupported(isSupported);

    if (!isSupported) return;

    function handleClick(e: MouseEvent) {
      // Plain left-clicks only.
      if (
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      const link = (e.target as HTMLElement | null)?.closest("a");
      if (!link) return;
      if (link.target === "_blank") return;
      if (link.hasAttribute("download")) return;

      const href = link.getAttribute("href");
      if (!href) return;

      // Skip external + special links — let them navigate normally.
      if (
        href.startsWith("http") ||
        href.startsWith("//") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("#")
      ) {
        return;
      }

      // Skip same-path clicks.
      if (href === window.location.pathname) return;

      // Take over before Next.js Link's onClick runs.
      e.preventDefault();
      e.stopImmediatePropagation();

      setIntercepts((n) => n + 1);
      setLastHref(href);
      setLastError(null);

      try {
        doc.startViewTransition!(() => {
          router.push(href);
        });
      } catch (err) {
        setLastError((err as Error).message ?? "unknown");
        // Fallback: navigate anyway, no transition.
        router.push(href);
      }
    }

    document.addEventListener("click", handleClick, true); // capture phase
    return () =>
      document.removeEventListener("click", handleClick, true);
  }, [router]);

  if (!SHOW_DEBUG) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        left: 8,
        zIndex: 9999,
        padding: "6px 10px",
        background: "rgba(0, 0, 0, 0.78)",
        color: "white",
        fontFamily: "ui-monospace, monospace",
        fontSize: 11,
        lineHeight: 1.5,
        borderRadius: 6,
        pointerEvents: "none",
        maxWidth: 260,
      }}
    >
      <div>
        VT API:{" "}
        <strong style={{ color: supported ? "#7CFFB2" : "#FF8888" }}>
          {supported === null ? "…" : supported ? "yes" : "NO"}
        </strong>
      </div>
      <div>
        intercepts: <strong>{intercepts}</strong>
      </div>
      {lastHref && (
        <div style={{ wordBreak: "break-all" }}>last: {lastHref}</div>
      )}
      {lastError && (
        <div style={{ color: "#FF8888", wordBreak: "break-all" }}>
          err: {lastError}
        </div>
      )}
    </div>
  );
}
