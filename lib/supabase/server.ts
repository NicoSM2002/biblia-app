/**
 * Server-side Supabase client. Use inside Route Handlers, Server Components,
 * Server Actions, and middleware.
 *
 * The cookies() integration keeps the user's session in sync between
 * server-rendered pages and client-side fetches.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll can throw inside a Server Component — that's expected
            // when middleware is also refreshing the session. Ignore.
          }
        },
      },
    },
  );
}
