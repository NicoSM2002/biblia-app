"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Global click interceptor that wraps all in-app navigation in
 * `document.startViewTransition()` so the browser plays a native
 * crossfade between the old and new page snapshots.
 *
 * Why this instead of framer-motion / a CSS @keyframes wrapper:
 *
 * Next.js 16 with Turbopack has a known scheduling quirk where
 * `<div key={pathname}>` in the root layout doesn't reliably remount
 * during soft navigation — so a mount-triggered CSS animation
 * silently doesn't fire. AnimatePresence has the same family of
 * issues with App Router's children swap. The View Transitions API
 * sidesteps both: it operates on the *browser's* before/after DOM
 * snapshots, totally independent of React reconciliation. As long
 * as the navigation goes through `router.push()`, the crossfade
 * happens.
 *
 * The actual animation curves live in globals.css under
 * `::view-transition-old(root)` and `::view-transition-new(root)`,
 * shared with the theme toggle.
 *
 * Browser support: Chrome 111+, Edge 111+, Safari 18.2+. Older
 * browsers fall through to a regular Next.js navigation (no
 * animation, no flash — body keeps its paper background).
 */
export function ViewTransitionLinks() {
  const router = useRouter();

  useEffect(() => {
    type DocWithVT = Document & {
      startViewTransition?: (cb: () => void) => unknown;
    };
    const doc = document as DocWithVT;
    if (typeof doc.startViewTransition !== "function") return;

    function handleClick(e: MouseEvent) {
      // Plain left-clicks only — let the browser handle modifier keys
      // (cmd-click for new tab, etc.).
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

      // Skip same-path clicks — no transition needed for them.
      if (href === window.location.pathname) return;

      e.preventDefault();
      doc.startViewTransition!(() => {
        router.push(href);
      });
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [router]);

  return null;
}
