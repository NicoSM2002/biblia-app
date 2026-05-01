/**
 * Browser-side Supabase client. Use inside Client Components.
 *
 * Sessions are stored in window.localStorage (the supabase-js default in
 * browser envs). We deliberately use the plain @supabase/supabase-js
 * `createClient` instead of @supabase/ssr's `createBrowserClient` so the
 * session lives in localStorage, not in cookies. Cookies don't survive
 * the cross-origin jump from `capacitor://localhost` (the iOS WebView
 * origin) to the API domain on Vercel; localStorage does, and we ship
 * the access token to the server as an `Authorization: Bearer` header
 * via `lib/auth-fetch.ts`.
 *
 * The instance is cached so multiple calls share a single auth state
 * machine — this matters for `onAuthStateChange` listeners.
 */

import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (cached) return cached;
  cached = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );
  return cached;
}

export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Synchronous, optimistic check for an existing localStorage session.
 * Used to seed `useState` so auth-conditional UI doesn't flicker into
 * existence after the async getUser() resolves. We only check that a
 * session token exists; getUser() runs right after to validate it.
 *
 * Supabase stores the session under a key like `sb-<project-ref>-auth-token`.
 */
export function hasLocalSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && /^sb-.*-auth-token$/.test(k)) {
        const v = window.localStorage.getItem(k);
        if (v && v.length > 2) return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}
