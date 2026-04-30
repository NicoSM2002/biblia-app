"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";

/**
 * Wraps each route's content in an AnimatePresence+motion.div keyed by the
 * pathname so navigating between /, /chat, /misas, /auth, etc. fades the
 * old page out and the new one in instead of swapping instantly.
 *
 * Lives in the root layout (which persists across navigations) so exit
 * animations actually have a host element to keep alive while the next
 * route mounts. `mode="wait"` plays the exit before the enter, which keeps
 * the screen calm and avoids cross-fade overlap on the missal-page card.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}
        className="contents"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
