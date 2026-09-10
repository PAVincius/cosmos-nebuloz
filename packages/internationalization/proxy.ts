import { match as matchLocale } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import type { NextRequest } from "next/server";
import { createI18nMiddleware } from "next-international/middleware";
import languine from "./languine.json" with { type: "json" };

const locales = [languine.locale.source, ...languine.locale.targets];

/** The locale served without a prefix, and the fallback for a request whose
 *  `Accept-Language` matches nothing. Hardcoded to `en` until the ICP made it
 *  wrong: the source locale is the one we author in, so it is the one an
 *  unnegotiated request — curl, uptime monitor, every AI crawler that sends no
 *  header — should get. `index.ts` derives its own copy from the same field; it
 *  cannot import this module, and this module cannot import it (`server-only`). */
const DEFAULT_LOCALE = languine.locale.source;

/** True only for tags `Intl` will canonicalise; everything else throws. */
const isWellFormedTag = (tag: string): boolean => {
  try {
    return Intl.getCanonicalLocales(tag).length > 0;
  } catch {
    return false;
  }
};

/**
 * Negotiator answers `["*"]` for a request that sends no `Accept-Language` — or
 * sends the wildcard — which is normal for curl, uptime monitors and a good
 * share of crawlers. `@formatjs`'s matcher pushes every tag through
 * `Intl.getCanonicalLocales`, and that throws `RangeError` on `"*"` and on any
 * malformed tag.
 *
 * The throw propagated out of the middleware, so the locale rewrite never ran
 * and `/` fell through to a 404 — the site's front door answering "not found"
 * to precisely the clients least likely to retry with a better header. Drop
 * what Intl cannot read and fall back to the default locale.
 */
const resolveLocaleFromRequest = (request: NextRequest): string => {
  const headers = Object.fromEntries(request.headers.entries());
  const accepted = new Negotiator({ headers })
    .languages()
    .filter(isWellFormedTag);

  if (accepted.length === 0) {
    return DEFAULT_LOCALE;
  }

  try {
    return matchLocale(accepted, locales, DEFAULT_LOCALE);
  } catch {
    return DEFAULT_LOCALE;
  }
};

const I18nMiddleware = createI18nMiddleware({
  locales,
  defaultLocale: DEFAULT_LOCALE,
  urlMappingStrategy: "rewriteDefault",
  resolveLocaleFromRequest,
});

export const internationalizationMiddleware = (request: NextRequest) =>
  I18nMiddleware(request);

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

//https://nextjs.org/docs/app/building-your-application/routing/internationalization
//https://github.com/vercel/next.js/tree/canary/examples/i18n-routing
//https://github.com/QuiiBz/next-international
//https://next-international.vercel.app/docs/app-middleware-configuration
