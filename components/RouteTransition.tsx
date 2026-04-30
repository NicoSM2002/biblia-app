"use client";

import { usePathname } from "next/navigation";

/**
 * Pure-CSS route transition.
 *
 * Earlier attempts used framer-motion's AnimatePresence to crossfade between
 * routes. Two things kept biting us:
 *   1) `display: contents` silently disables opacity animations.
 *   2) AnimatePresence + Next.js App Router children swap doesn't always
 *      detect the change cleanly enough to fire enter/exit on every nav,
 *      especially with absolutely-positioned panes.
 *
 * The simplest reliable approach: re-key a single wrapper by pathname so
 * React unmounts the old route and mounts the new one. The new wrapper
 * fires a CSS @keyframes fade-in on mount. The old route is gone instantly,
 * but because <body> carries the paper background already, the eye sees
 * "paper → content fading in" instead of a flash to blank.
 *
 * No exit animation — but in practice the fade-in is enough to read as a
 * soft turn-of-the-page, and there's no parpadeo because the wrapper
 * starts at opacity 0 and animates upward against the paper background.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="route-fade">
      {children}
    </div>
  );
}
