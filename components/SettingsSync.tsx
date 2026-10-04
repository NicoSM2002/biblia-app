"use client";

import { useEffect } from "react";
import { applySettings, loadSettings } from "@/lib/settings";

/**
 * Re-applies the saved Ajustes after hydration (belt-and-braces over the
 * pre-paint script) and, when the theme is "system", follows the OS switching
 * between light and dark while the app is open. Renders nothing.
 */
export function SettingsSync() {
  useEffect(() => {
    applySettings(loadSettings());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const s = loadSettings();
      if (s.theme === "system") applySettings(s);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return null;
}
