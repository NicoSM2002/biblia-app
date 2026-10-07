"use client";

/**
 * Page transitions, sequenced: the current screen leaves first, THEN the
 * router swaps in the new one, which enters from the tapped side
 * (.page-content-fade + html[data-nav-dir] in app/globals.css).
 *
 * The two screens are never on screen together. A View Transitions version
 * (old and new snapshots animated simultaneously) worked in Chrome but on
 * iPhone Safari the two screens rendered on top of each other, so it was
 * dropped. This approach is plain CSS on the persistent page wrapper
 * (.vt-page in app/layout.tsx) and behaves the same in every browser.
 *
 *   tab-right / push  → leaves to the left,  new one enters from the right
 *   tab-left  / pop   → leaves to the right, new one enters from the left
 */

export type NavKind = "tab-left" | "tab-right" | "push" | "pop";

type Router = { push: (href: string) => void };

const LEAVE_MS = 150;
let pendingCleanup: (() => void) | null = null;
let busy = false;

/** Called by the persistent nav (layout effect) once the new route rendered. */
export function routeSettled() {
  const c = pendingCleanup;
  pendingCleanup = null;
  c?.();
}

export function navigate(router: Router, href: string, kind: NavKind) {
  const root = document.documentElement;
  const page = document.querySelector<HTMLElement>(".vt-page");
  const dir = kind === "tab-right" || kind === "push" ? "right" : "left";
  root.dataset.navDir = dir;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!page || reduce || busy) {
    router.push(href);
    return;
  }

  busy = true;
  // Web Animations API, not a CSS class: Safari started class-triggered
  // animations late and kept painting them after the class was removed;
  // .animate()/.cancel() start and stop exactly when told.
  const leave = page.animate(
    [
      { opacity: 1, transform: "translateX(0)" },
      { opacity: 0, transform: `translateX(${dir === "right" ? -24 : 24}px)` },
    ],
    { duration: LEAVE_MS, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" },
  );
  let failsafe = 0;
  let observer: MutationObserver | null = null;
  const cleanup = () => {
    window.clearTimeout(failsafe);
    observer?.disconnect();
    observer = null;
    pendingCleanup = null;
    leave.cancel();
    busy = false;
  };
  window.setTimeout(() => {
    pendingCleanup = cleanup;
    // Reveal the moment the new page's content is inserted: a
    // MutationObserver callback runs before the browser paints, so the new
    // page's entrance animation is seen from its first frame. (Waiting for
    // the nav's effect was too late in Safari: the new page animated in
    // while still hidden, then popped in.)
    observer = new MutationObserver((records) => {
      for (const r of records)
        for (const n of r.addedNodes)
          if (n instanceof HTMLElement && (n.matches(".page-content-fade") || n.querySelector(".page-content-fade"))) {
            cleanup();
            return;
          }
    });
    observer.observe(page, { childList: true, subtree: true });
    // If nothing new mounts (same URL, error…), don't stay hidden.
    failsafe = window.setTimeout(cleanup, 2500);
    router.push(href);
  }, LEAVE_MS);
}

/** For <Link onClick>: keep cmd/ctrl-click (new tab) working normally. */
export function plainClick(e: React.MouseEvent): boolean {
  return !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);
}
