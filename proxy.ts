import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { updateSession } from "./lib/supabase/proxy";

const intl = createIntlMiddleware(routing);

const LOCALE_PATH = /^\/(es|en|pt)(\/.*)?$/;
const GUEST_ONLY = ["/login", "/signup", "/forgot-password"];

export async function proxy(request: NextRequest) {
  const response = intl(request);

  // next-intl ya decidió redirigir (por ejemplo "/" → "/es"): no hace falta tocar la sesión.
  if (response.headers.has("location")) return response;

  const { isAuthenticated } = await updateSession(request, response);

  const { pathname, search } = request.nextUrl;
  const match = pathname.match(LOCALE_PATH);
  const locale = match?.[1] ?? routing.defaultLocale;
  const rest = match?.[2] ?? "/";

  if (!isAuthenticated && (rest === "/app" || rest.startsWith("/app/"))) {
    const url = new URL(`/${locale}/login`, request.url);
    url.searchParams.set("next", pathname + search);
    return redirectKeepingCookies(url, response);
  }

  if (isAuthenticated && GUEST_ONLY.includes(rest)) {
    return redirectKeepingCookies(new URL(`/${locale}/app`, request.url), response);
  }

  return response;
}

/** Una redirección nueva pierde las cookies de sesión refrescadas; se copian a mano. */
function redirectKeepingCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  // Todo menos API, callback de auth, internos de Next/Vercel y archivos con extensión.
  matcher: ["/((?!api|auth|_next|_vercel|.*\\..*).*)"],
};
