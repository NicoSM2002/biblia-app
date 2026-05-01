"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * fetch() that attaches the user's Supabase access token as a Bearer
 * header. The server reads it via `lib/supabase/server.ts` and uses it
 * for both authentication and RLS enforcement.
 *
 * Use this for any /api/* call that needs auth (conversations, turns,
 * etc.). For genuinely public endpoints (daily-verse, iglesias) plain
 * fetch is fine — the extra header just adds a few bytes.
 *
 * If there's no session, the request is sent without the header. The
 * server will respond 401 if it requires auth.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(input, { ...init, headers });
}
