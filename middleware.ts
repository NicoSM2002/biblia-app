/**
 * Refreshes the Supabase auth session on every server-rendered request so
 * cookies stay valid as the user moves between pages. Skips static assets.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // This refreshes the session if the cookie is close to expiring.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Match everything except static assets, images, favicons, and the api
    // route paths that don't need auth refresh (chat is public).
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|api/chat).*)",
  ],
};
