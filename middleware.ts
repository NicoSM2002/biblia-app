/**
 * Middleware deliberately disabled.
 *
 * Previously this refreshed the Supabase auth cookie on every request.
 * The app now stores the session in localStorage on the client and ships
 * the access token to the API as an `Authorization: Bearer …` header,
 * so there's no cookie to refresh. Supabase's browser client refreshes
 * the access token on its own using the refresh token.
 *
 * The empty matcher means this never runs. The file stays so removing
 * it doesn't show up as an unrelated diff in git history.
 */
import { NextResponse, type NextRequest } from "next/server";

export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
