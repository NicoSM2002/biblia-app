"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Lets an overlay play its exit animation before it unmounts: call close()
 * instead of onClose(); `closing` turns on the exit class, and onClose runs
 * when the animation is done. Without this, sheets and dialogs vanished in
 * one frame while they arrived with a slide.
 */
export function useClosable(onClose: () => void, ms = 220) {
  const [closing, setClosing] = useState(false);
  const started = useRef(false);
  // Latest onClose without making `close` change identity every render
  // (callers pass inline arrows; effects depend on `close`).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const close = useCallback(() => {
    if (started.current) return;
    started.current = true;
    setClosing(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => onCloseRef.current(), reduce ? 0 : ms);
  }, [ms]);
  return { closing, close };
}
