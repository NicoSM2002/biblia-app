/**
 * Server-side Supabase client for Route Handlers.
 *
 * The browser stores the session in localStorage and sends the access
 * token as an `Authorization: Bearer …` header on each authenticated
 * request (see `lib/auth-fetch.ts`). This helper takes the incoming
 * Request, lifts that header, and creates a Supabase client that uses
 * the same identity — so `getUser()` and RLS work as expected.
 *
 * Why not @supabase/ssr's `createServerClient`? That helper is built
 * around cookies. Cookies are unreliable when the client lives at
 * `capacitor://localhost` (iOS WebView) and the API at a Vercel
 * domain — different origins, no cookie sharing. Bearer tokens in a
 * header sidestep all of that.
 */

import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

export function createClient(req: Request): SupabaseClient {
  const authorization = req.headers.get("Authorization") ?? "";
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { Authorization: authorization },
      },
    },
  );
}
