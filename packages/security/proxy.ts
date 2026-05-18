import { defaults, type Options, withVercelToolbar } from "@nosecone/next";

// biome-ignore lint/performance/noBarrelFile: "re-exporting"
export { createMiddleware as securityMiddleware } from "@nosecone/next";

/**
 * Extra `connect-src` hosts for Cosmos (Liveblocks, analytics, Knock, GA).
 * Base policy + Next.js script nonces come from `@nosecone/next` defaults.
 */
const CSP_CONNECT_SRC_EXTRAS = [
  "https://*.liveblocks.io",
  "wss://*.liveblocks.io",
  "https://vitals.vercel-insights.com",
  "https://www.google-analytics.com",
  "https://region1.google-analytics.com",
  "https://www.googletagmanager.com",
  "https://*.knock.app",
  "wss://*.knock.app",
] as const;

// Nosecone security headers configuration
// https://docs.arcjet.com/nosecone/quick-start
export const noseconeOptions: Options = {
  ...defaults,
  contentSecurityPolicy: {
    directives: {
      ...defaults.contentSecurityPolicy.directives,
      connectSrc: [
        ...defaults.contentSecurityPolicy.directives.connectSrc,
        ...CSP_CONNECT_SRC_EXTRAS,
      ],
      imgSrc: [
        ...defaults.contentSecurityPolicy.directives.imgSrc,
        "https:",
      ],
    },
  },
};

export const noseconeOptionsWithToolbar: Options =
  withVercelToolbar(noseconeOptions);
