import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every path except:
     * - _next/static, _next/image  (build output)
     * - sw.js, manifest, icons     (PWA assets — must stay reachable and
     *                               uncookied, and never need a session)
     * - static image/font files
     *
     * Everything else goes through the session refresh, including Server
     * Actions, so a long logging session can't drift into an expired token.
     */
    "/((?!_next/static|_next/image|favicon\.ico|sw\.js|manifest\.webmanifest|icon|apple-icon|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
