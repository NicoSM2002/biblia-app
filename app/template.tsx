"use client";

import { motion } from "motion/react";

/**
 * `template.tsx` re-renders on every navigation (unlike `layout.tsx` which is
 * cached). We use it to fade in each route so transitions between /, /auth,
 * etc. feel calm instead of snappy.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
      className="contents"
    >
      {children}
    </motion.div>
  );
}
