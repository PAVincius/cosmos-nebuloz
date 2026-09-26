import type { Breadcrumb } from "@sentry/nextjs";

/**
 * Routes whose path segment right after the prefix is a bearer credential —
 * a single-use password-reset/magic-link/invite token, not an opaque id safe
 * to keep — so it has to be redacted from the PATH, not just the query
 * string. One list so a new sensitive route is one line here, not a scrub
 * call to remember at every Sentry hook (and the one thing `client.ts` checks
 * before deciding whether Session Replay may even start — see there).
 */
export const SENSITIVE_ROUTE_PREFIXES = [
  "/meridian-responder/",
  "/invite/",
] as const;

/**
 * Routes with no token in the path, but whose query string carries one
 * (`/reset-password?token=...`) — already covered by `scrubUrl`'s query-string
 * strip below, but still a route Session Replay must stay off of: it records
 * `pathname + hash + search` as one raw string, and that capture happens
 * outside `scrubUrl` entirely (see `client.ts`).
 */
const SENSITIVE_EXACT_PATHS = ["/reset-password"] as const;

/** True when `pathname` is a route that must keep Session Replay off — one
 * that carries a token in its path, or one whose query string does. */
export const isSensitivePath = (pathname: string): boolean =>
  SENSITIVE_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
  SENSITIVE_EXACT_PATHS.some((path) => pathname === path);

const redactSensitiveSegment = (url: string): string => {
  for (const prefix of SENSITIVE_ROUTE_PREFIXES) {
    const start = url.indexOf(prefix);
    if (start === -1) {
      continue;
    }
    const afterPrefix = start + prefix.length;
    const rest = url.slice(afterPrefix);
    const end = rest.search(/[/?#]/);
    const token = end === -1 ? rest : rest.slice(0, end);
    if (!token) {
      continue;
    }
    return `${url.slice(0, afterPrefix)}:token${rest.slice(token.length)}`;
  }
  return url;
};

const stripQueryString = (url: string): string => url.split("?")[0] ?? url;

/**
 * Query strings can carry one-shot secrets — password-reset tokens, magic-link
 * codes, invite codes — that must never leave the app; some of the same
 * tokens live in the PATH instead (`/meridian-responder/<token>`,
 * `/invite/<token>`), which is why this doesn't stop at the query string.
 * Stripped/redacted wholesale rather than by param name: an allowlist of
 * "safe" query keys drifts as new routes are added, a denylist of
 * "dangerous" ones is exactly the list an attacker checks first. Works on
 * both absolute URLs (`request.url` on the server) and bare paths
 * (breadcrumb `data.url`/`to`/`from`, `transaction` on the client) — it never
 * parses the string as a URL, so it can't mis-serialize either shape.
 */
export const scrubUrl = (url: string): string =>
  stripQueryString(redactSensitiveSegment(url));

const NAVIGATION_LIKE_BREADCRUMB_CATEGORIES = new Set([
  "navigation",
  "xhr",
  "fetch",
]);

/** For `Sentry.init({ beforeBreadcrumb })`: scrubs the URL(s) carried by
 * navigation/xhr/fetch breadcrumbs before they ever reach the buffer that
 * feeds error events and Session Replay. */
export const scrubBreadcrumb = (breadcrumb: Breadcrumb): Breadcrumb => {
  if (
    !(
      breadcrumb.category &&
      NAVIGATION_LIKE_BREADCRUMB_CATEGORIES.has(breadcrumb.category) &&
      breadcrumb.data
    )
  ) {
    return breadcrumb;
  }
  const data = { ...breadcrumb.data };
  for (const key of ["url", "to", "from"]) {
    if (typeof data[key] === "string") {
      data[key] = scrubUrl(data[key]);
    }
  }
  return { ...breadcrumb, data };
};

type UrlBearingEvent = {
  request?: { url?: string; query_string?: unknown } | null;
  transaction?: string;
};

/** For `beforeSend`/`beforeSendTransaction`: scrubs `request.url` (and the
 * companion `request.query_string`, when the SDK populated it separately) plus
 * `transaction`, which some instrumentations set to the full pathname instead
 * of just the route pattern. */
export const scrubRequestUrl = <E extends UrlBearingEvent>(event: E): E => {
  if (event.request?.url) {
    event.request = {
      ...event.request,
      url: scrubUrl(event.request.url),
      query_string: undefined,
    };
  }
  if (event.transaction) {
    event.transaction = scrubUrl(event.transaction);
  }
  return event;
};
