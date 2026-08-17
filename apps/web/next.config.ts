import { withToolbar } from "@repo/feature-flags/lib/toolbar";
import { config, withAnalyzer } from "@repo/next-config";
import { withLogging, withSentry } from "@repo/observability/next-config";
import type { NextConfig } from "next";
import { env } from "@/env";

let nextConfig: NextConfig = withToolbar(withLogging(config));

/*
 * The `/legal` -> `/legal/privacy` 301 that used to live here is gone. Legal
 * pages come from BaseHub, which has no published content, so `/legal/privacy`
 * 404s — and a permanent redirect into a 404 is worse than no redirect: it is
 * the only publicly reachable entry point to that tree, and 301s are cached by
 * browsers and crawlers long after the destination is fixed.
 *
 * Restore it once Privacy and Terms actually resolve.
 */

/*
 * www -> apex, 308.
 *
 * Both hostnames are attached to the project, and measured on the live domain
 * both answered 200 with identical content — two URLs for every page. The
 * canonical tag points at the apex so Google would probably consolidate, but
 * "probably" is not a redirect: until one host actually forwards, both are
 * crawlable and link equity splits between them.
 *
 * Host comes from the production URL rather than a literal, so this follows the
 * domain instead of pinning `nebuloz.ai` into the build. Declared in
 * next.config rather than in proxy.ts because the proxy matcher deliberately
 * skips robots.txt, sitemap.xml and the icons — those need forwarding too.
 */
const apex = env.VERCEL_PROJECT_PRODUCTION_URL?.replace(
  /^[a-z][a-z0-9+.-]*:\/\//i,
  ""
);

if (apex && !apex.startsWith("www.") && !apex.includes("localhost")) {
  nextConfig.redirects = async () => [
    {
      source: "/:path*",
      has: [{ type: "host", value: `www.${apex}` }],
      destination: `https://${apex}/:path*`,
      permanent: true,
    },
  ];
}

if (env.VERCEL) {
  nextConfig = withSentry(nextConfig);
}

if (env.ANALYZE === "true") {
  nextConfig = withAnalyzer(nextConfig);
}

export default nextConfig;
