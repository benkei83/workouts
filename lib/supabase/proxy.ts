import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";

/**
 * Refreshes the Supabase session on every request, BEFORE any Server Component
 * runs.
 *
 * This has to live in middleware. Server Components cannot write cookies, so if
 * the refresh happens there the rotated token is silently dropped (see the empty
 * `catch {}` in ./server.ts) and the browser keeps replaying a burned refresh
 * token — which Supabase rejects with `refresh_token_already_used` forever.
 *
 * Refreshing here also collapses what used to be one refresh per Server
 * Component (layout + page = 4 concurrent, racing calls) into a single one.
 *
 * Deliberately does NOT redirect: every page already does its own auth check
 * and `redirect('/sign-in')`. Keeping this to refresh-only avoids breaking
 * public routes (share links, /offline, /auth/*).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!hasEnvVars) {
    return supabaseResponse;
  }

  // With Fluid compute, don't put this client in a global variable.
  // Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write into `request` too, so Server Components downstream in this
          // same request read the freshly rotated token instead of the old one.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and supabase.auth.getClaims().
  // A simple mistake could make it very hard to debug issues with users being
  // randomly logged out.
  try {
    // getClaims() surfaces auth failures as a returned `error` rather than a
    // throw, but the underlying refresh can still throw on network faults —
    // handle both shapes.
    const { error } = await supabase.auth.getClaims();
    if (error) throw error;
  } catch (error) {
    // The refresh token is unusable (already rotated, revoked, or expired).
    // Nothing downstream can recover it, and leaving it in place means the
    // client replays the same dead token on every request — the permanent
    // black-screen loop. Drop the auth cookies so the app falls back to the
    // signed-out path and the user can log in again.
    if (isUnrecoverableAuthError(error)) {
      clearAuthCookies(request, supabaseResponse);
    } else {
      // Transient (network blip, Supabase 5xx). Leave the session alone.
      console.error("[middleware] session refresh failed:", error);
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure
  // to copy over the cookies, or the browser and server will go out of sync and
  // terminate the user's session prematurely.
  return supabaseResponse;
}

const UNRECOVERABLE_AUTH_CODES = new Set([
  "refresh_token_already_used",
  "refresh_token_not_found",
  "session_not_found",
  "session_expired",
  "bad_jwt",
]);

function isUnrecoverableAuthError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const err = error as { __isAuthError?: boolean; code?: string; status?: number };
  if (!err.__isAuthError) return false;
  if (err.code && UNRECOVERABLE_AUTH_CODES.has(err.code)) return true;
  // Any 4xx from the auth API means the credential itself is bad, not the network.
  return err.status !== undefined && err.status >= 400 && err.status < 500;
}

/** Supabase stores the session in `sb-<ref>-auth-token`, possibly chunked (`.0`, `.1`). */
function clearAuthCookies(request: NextRequest, response: NextResponse) {
  for (const cookie of request.cookies.getAll()) {
    if (/^sb-.*-auth-token(\.\d+)?$/.test(cookie.name)) {
      request.cookies.delete(cookie.name);
      response.cookies.set(cookie.name, "", { maxAge: 0, path: "/" });
    }
  }
}
