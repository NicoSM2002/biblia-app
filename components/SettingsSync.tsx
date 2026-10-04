"use client";

import { useEffect } from "react";
import { applySettings, loadSettings } from "@/lib/settings";

/**
 * Re-applies the saved Ajustes after hydration (belt-and-braces over the
 * pre-paint script) and, when the theme is "system", follows the OS switching
 * between light and dark while the app is open. Also forwards password-
 * recovery links that Supabase sent to the wrong page. Renders nothing.
 */
export function SettingsSync() {
  useEffect(() => {
    // Password-recovery links land on the Supabase "Site URL" (usually "/")
    // when /auth?modo=nueva isn't in the project's Redirect URLs allow-list.
    // Forward them, tokens and all, to the screen that sets the new password.
    const { hash, pathname } = window.location;
    if (pathname !== "/auth" && /(^|[#&])type=recovery(&|$)/.test(hash)) {
      window.location.replace(`/auth?modo=nueva${hash}`);
      return;
    }

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
