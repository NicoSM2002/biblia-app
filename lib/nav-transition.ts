"use client";

/**
 * Native-feeling page transitions.
 *
 * The App Router swaps pages in one frame: the old screen vanished and the
 * new one faded in on its own, which felt like a reload. Here navigation
 * runs inside document.startViewTransition(): the browser keeps a snapshot
 * of the old screen and animates it together with the new one (CSS in
 * app/globals.css, keyed off html[data-vt]):
 *
 *   tab-left / tab-right  between tabs — old drifts out and fades while the
 *                         new one drifts in from the tapped side.
 *   push / pop            into / out of a detail (a parish) — the iOS
 *                         navigation slide, with the old screen receding.
 *
 * Only the page wrapper (.vt-page) is named during a navigation; the tab
 * bar is named separately and not animated, so it stays put and its active
 * capsule glides. Without the API (older iOS) or with "reduce motion", it's
 * a plain router.push and the per-page fallback animation.
 */

export type NavKind = "tab-left" | "tab-right" | "push" | "pop";

type Router = { push: (href: string) => void };
type VTDoc = Document & {
  startViewTransition?: (cb: () => Promise<void> | void) => {
    finished: Promise<void>;
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
  };
};

let settle: (() => void) | null = null;

/** Called by the persistent nav once the new route has rendered. */
export function routeSettled() {
  const s = settle;
  settle = null;
  s?.();
}

export function navigate(router: Router, href: string, kind: NavKind) {
  const doc = document as VTDoc;
  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!doc.startViewTransition || reduce) {
    // Fallback animation (.page-content-fade reads data-nav-dir).
    if (kind === "tab-right" || kind === "push") root.dataset.navDir = "right";
    else root.dataset.navDir = "left";
    router.push(href);
    return;
  }
  root.dataset.vt = kind;
  const t = doc.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        const timer = window.setTimeout(() => {
          settle = null;
          resolve();
        }, 1500);
        // Resolve right away: this runs from the nav's useEffect, after
        // React committed the new page. NOT via requestAnimationFrame —
        // rendering is frozen until this promise resolves, so a rAF never
        // fires and the browser aborts the transition after 4 s.
        settle = () => {
          window.clearTimeout(timer);
          resolve();
        };
        router.push(href);
      }),
  );
  // A skipped/aborted transition rejects these; the navigation itself
  // still happens, so there's nothing to report.
  t.ready.catch(() => {});
  t.updateCallbackDone.catch(() => {});
  t.finished.finally(() => {
    // The new page's own entrance fades were suppressed during the
    // transition; pin them so they don't start once data-vt is removed.
    document
      .querySelectorAll<HTMLElement>(".page-content-fade, .page-head-fade")
      .forEach((el) => (el.style.animation = "none"));
    delete root.dataset.vt;
  });
}

/** For <Link onClick>: keep cmd/ctrl-click (new tab) working normally. */
export function plainClick(e: React.MouseEvent): boolean {
  return !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);
}
