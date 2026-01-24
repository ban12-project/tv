import { match as matchLocale } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { i18n } from "./i18n-config";
import { getSessionCookie } from "better-auth/cookies";

const locales = i18n.locales.join("|");

const PROTECTED_PATTERN = new URLPattern({
  pathname: `/:locale(${locales})?/:path((?!.*(?:sign-in|sign-up)).*)`,
});

const WITH_TOKEN_CONFLICT_PATTERN = new URLPattern({
  pathname: `/:locale(${locales})?/:action(sign-in|sign-up){/}?`,
});

function getLocale(request: NextRequest): string | undefined {
  // Negotiator expects plain object so we need to transform headers
  const negotiatorHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    negotiatorHeaders[key] = value;
  });

  const locales = i18n.locales as unknown as string[];

  // Use negotiator and intl-localematcher to get best locale
  const languages = new Negotiator({ headers: negotiatorHeaders }).languages(
    locales,
  );

  const locale = matchLocale(languages, locales, i18n.defaultLocale);

  return locale;
}

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const sessionCookie = getSessionCookie(request);

  const locale = i18n.locales.find(
    (locale) => pathname.split("/")[1] === locale,
  );

  if (!sessionCookie && PROTECTED_PATTERN.test({ pathname })) {
    const redirectUrl = encodeURIComponent(request.url);

    return NextResponse.redirect(
      new URL(
        `${locale ? `/${locale}` : ""}/sign-in?redirectUrl=${redirectUrl}`,
        request.url,
      ),
    );
  }

  if (sessionCookie && WITH_TOKEN_CONFLICT_PATTERN.test({ pathname })) {
    const isInvalidSession =
      request.nextUrl.searchParams.get("error") === "invalid_session";

    if (isInvalidSession) return NextResponse.next();

    return NextResponse.redirect(
      new URL(
        `${locale ? `/${locale}` : "/"}${request.nextUrl.search}`,
        request.url,
      ),
    );
  }

  // // `/_next/` and `/api/` are ignored by the watcher, but we need to ignore files in `public` manually.
  // // If you have one
  // if (
  //   [
  //     '/manifest.json',
  //     '/favicon.ico',
  //     // Your other files in `public`
  //   ].includes(pathname)
  // )
  //   return

  // Check if there is any supported locale in the pathname
  const pathnameIsMissingLocale = i18n.locales.every(
    (locale) =>
      !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`,
  );

  // Redirect if there is no locale
  if (pathnameIsMissingLocale) {
    const locale = getLocale(request);

    if (locale === i18n.defaultLocale)
      return NextResponse.rewrite(
        new URL(
          `/${locale}${pathname.startsWith("/") ? "" : "/"}${pathname}${request.nextUrl.search}`,
          request.url,
        ),
      );

    // e.g. incoming request is /products
    // The new URL is now /en-US/products
    return Response.redirect(
      new URL(
        `/${locale}${pathname.startsWith("/") ? "" : "/"}${pathname}${request.nextUrl.search}`,
        request.url,
      ),
    );
  }

  return NextResponse.next();
}

export const config = {
  // Matcher ignoring `/_next/` and `/api/`
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
