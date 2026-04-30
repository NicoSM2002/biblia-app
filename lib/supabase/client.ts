/**
 * Browser-side Supabase client. Use inside Client Components.
 */

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Synchronous, optimistic check for an existing session, used to seed
 * `useState` so conditional auth UI doesn't flicker into existence after
 * the async getUser() resolves. We just look for the Supabase auth token
 * cookie — getUser() runs right after to correct stale guesses.
 */
export function hasSessionCookie(): boolean {
  if (typeof document === "undefined") return false;
  return /\bsb-[^=;]+-auth-token=/.test(document.cookie);
}
