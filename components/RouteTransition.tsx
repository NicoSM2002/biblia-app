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
 *
 * Critical: do NOT use display:contents on the wrapper — opacity does not
 * apply to display:contents boxes (the element is removed from the render
 * tree), so the fade simply doesn't happen. Use a real flex column that
 * fills the body so the inner h-[100dvh] continues to work.
 *
 * Timing follows Material's "exit faster than enter" rule:
 *   exit  ~140ms  (light, lets the user feel they advanced)
 *   enter ~340ms  (intentional, registers as a turning page)
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.14, ease: "easeIn" } }}
        transition={{ duration: 0.34, ease: [0.2, 0.7, 0.2, 1] }}
        className="route-transition-wrapper"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
