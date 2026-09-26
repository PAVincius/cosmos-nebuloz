import type { Breadcrumb } from "@sentry/nextjs";

/**
 * Query strings can carry one-shot secrets — password-reset tokens, magic-link
 * codes, invite codes — that must never leave the app. Stripped wholesale
 * rather than by param name: an allowlist of "safe" query keys drifts as new
 * routes are added, a denylist of "dangerous" ones is exactly the list an
 * attacker checks first.
 */
const stripQueryString = (url: string): string => url.split("?")[0] ?? url;

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
      data[key] = stripQueryString(data[key]);
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
 * `transaction`, which some instrumentations set to the full pathname
 * including query instead of just the route pattern. */
export const scrubRequestUrl = <E extends UrlBearingEvent>(event: E): E => {
  if (event.request?.url) {
    event.request = {
      ...event.request,
      url: stripQueryString(event.request.url),
      query_string: undefined,
    };
  }
  if (event.transaction?.includes("?")) {
    event.transaction = stripQueryString(event.transaction);
  }
  return event;
};
