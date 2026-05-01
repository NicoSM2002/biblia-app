/**
 * Resolves an API path into the URL the browser should actually fetch.
 *
 * The web app uses relative paths like `/api/iglesias` — the deployed
 * Vercel domain serves them directly. When the app gets wrapped in a
 * Capacitor shell, however, the page is served from `capacitor://localhost`
 * (iOS) or `https://localhost` (Android), so a relative path no longer
 * points to the API server. We need absolute URLs in that case.
 *
 * Usage:
 *   fetch(apiUrl("/api/daily-verse"))
 *
 * Configuration:
 *   - Web (current): NEXT_PUBLIC_API_BASE is unset → returns the path as-is.
 *   - Capacitor:     NEXT_PUBLIC_API_BASE="https://biblia-app-lyart.vercel.app"
 *                    is set at build time → returns the absolute URL.
 *
 * Either way, web behavior is identical to before. The helper is a no-op
 * until we decide to set the env var for the Capacitor build.
 */
export function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_BASE;
  if (!base) return path;
  // Defensive: collapse double slashes when joining base + path.
  if (path.startsWith("/")) return `${base.replace(/\/$/, "")}${path}`;
  return `${base.replace(/\/$/, "")}/${path}`;
}
