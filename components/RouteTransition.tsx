"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";

/**
 * Route transitions = real crossfade.
 *
 * Earlier versions used `mode="wait"`, which holds the new page off-screen
 * until the old page finishes its exit animation. That left a visible gap
 * — a single frame where the body background showed through and the user
 * read it as a flash / parpadeo. Calling display:contents on the wrapper
 * also silently broke opacity (the box is removed from the render tree).
 *
 * This version layers the two pages on top of each other with absolute
 * positioning so the old fades out *while* the new fades in. No gap, no
 * flash. The container stays at viewport size and each page sits inside
 * with its existing h-[100dvh] layout.
 *
 * Critical: opacity does NOT apply to display:contents elements, so the
 * wrapper has to be a real positioned box (the .route-stage class does
 * this — relative + size:100% — so the absolutely-positioned children
 * have something to stack inside).
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="route-stage">
      <AnimatePresence initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}
          className="route-page"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
