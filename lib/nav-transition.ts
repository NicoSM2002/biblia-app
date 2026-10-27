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
// Where the scheduled push goes. A second tap during the leave only updates
// it: navigating at once let the first tap's push land afterwards and win,
// so two quick taps ended on the FIRST tab.
let target: string | null = null;
let abortLeave: (() => void) | null = null;

/** A leave is under way and its push hasn't happened yet. */
export function leaving() {
  return target !== null;
}

/**
 * Freeze the entrances of the screen that is on now. Setting data-nav-dir
 * swaps the animation of every .page-content-fade that BottomNav hasn't
 * pinned yet (Oración mounts a new one per phase), which restarted it from
 * opacity 0 while the screen was leaving.
 */
export function pinEntrances() {
  document
    .querySelectorAll<HTMLElement>(".page-content-fade, .page-head-fade")
    .forEach((el) => (el.style.animation = "none"));
}

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
  pinEntrances();
  delete root.dataset.navBack;
  // Once you've moved around, the home's first-load flourishes (drop cap,
  // light across the arch) don't replay on every return (globals.css).
  root.dataset.navSeen = "";
  root.dataset.navDir = dir;

  // Still leaving: just retarget the push that is already scheduled.
  // Back to the screen that is leaving: stay on it.
  if (target !== null) {
    if (href === location.pathname) abortLeave?.();
    else target = href;
    return;
  }
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!page || reduce || busy) {
    router.push(href);
    return;
  }

  busy = true;
  target = href;
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
  const timer = window.setTimeout(() => {
    abortLeave = null;
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
    const to = target ?? href;
    target = null;
    router.push(to);
  }, LEAVE_MS);
  abortLeave = () => {
    window.clearTimeout(timer);
    abortLeave = null;
    target = null;
    delete root.dataset.navDir;
    cleanup();
  };
}

/** For <Link onClick>: keep cmd/ctrl-click (new tab) working normally. */
export function plainClick(e: React.MouseEvent): boolean {
  return !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);
}
