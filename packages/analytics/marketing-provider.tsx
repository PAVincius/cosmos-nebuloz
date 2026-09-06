import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import type { ReactNode } from "react";

/**
 * Analytics for the public marketing site — deliberately smaller than
 * `AnalyticsProvider`.
 *
 * The signed-in apps and the marketing site are not in the same legal position.
 * Inside apps/app there is a contract with the account holder and a stated
 * purpose, so product analytics has a lawful basis to stand on. A visitor who
 * lands on nebuloz.ai has agreed to nothing, and under the LGPD an identifier
 * written to their device for our convenience is our problem to justify.
 *
 * So this provider carries Vercel Web Analytics and nothing else. It is
 * cookieless and stores no identifier in the browser — the page view is
 * aggregated server-side — which is what keeps the site out of the
 * consent-banner conversation entirely.
 *
 * Deliberately absent, and please keep them absent:
 *
 *   · Google Analytics. Writes `_ga` and `_ga_*`. Non-essential, so it needs
 *     opt-in consent collected before the script loads — not a banner that
 *     appears while gtag is already running.
 *   · PostHog. `packages/analytics/instrumentation-client.ts` initialises it
 *     with `autocapture` and `enable_heatmaps`, which records what visitors
 *     click and hover. Measured on the live site, even a placeholder key wrote
 *     a `ph_…_posthog` cookie plus four storage keys.
 *
 * Adding either one back means the privacy policy stops being true the moment
 * it deploys, and the site needs a consent gate before the first request. That
 * is a product decision, not a config tweak — take it deliberately.
 */
type MarketingAnalyticsProviderProps = {
  readonly children: ReactNode;
};

export const MarketingAnalyticsProvider = ({
  children,
}: MarketingAnalyticsProviderProps) => (
  <>
    {children}
    <VercelAnalytics />
  </>
);
