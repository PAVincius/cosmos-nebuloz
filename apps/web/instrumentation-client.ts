import { initializeSentry } from "@repo/observability/client";

/* No `initializeAnalytics()` here, unlike apps/app and apps/api.
 *
 * That call initialises PostHog with autocapture and heatmaps, which writes an
 * identifier to the visitor's device before they have agreed to anything. On
 * the marketing site there is no account and no contract to hang that on, so it
 * would need consent collected up front — and the privacy policy would have to
 * say so. See packages/analytics/marketing-provider.tsx for the full reasoning.
 *
 * Sentry stays: it catches errors so the site can be fixed, which is a
 * legitimate interest under LGPD art. 10, and it is disclosed in the privacy
 * policy alongside the hosting logs it resembles. */
initializeSentry();
