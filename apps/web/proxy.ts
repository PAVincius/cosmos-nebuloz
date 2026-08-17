import { authMiddleware } from "@repo/auth/proxy";
import { internationalizationMiddleware } from "@repo/internationalization/proxy";
import { parseError } from "@repo/observability/error";
import { secure } from "@repo/security";
import {
  noseconeOptions,
  noseconeOptionsWithToolbar,
  securityMiddleware,
} from "@repo/security/proxy";
import { createNEMO } from "@rescale/nemo";
import { type NextProxy, type NextRequest, NextResponse } from "next/server";
import { env } from "@/env";

export const config = {
  // matcher tells Next.js which routes to run the middleware on. This runs the
  // middleware on all routes except for static assets and Posthog ingest.
  //
  // Everything after `ingest` is a root-only metadata file. The i18n middleware
  // rewrote them into the locale tree (`/en/robots.txt`, `/en/icon.png`), where
  // no route exists — so robots.txt, the sitemap, the favicon and the Open Graph
  // image all answered 404, to crawlers and social unfurlers respectively.
  matcher: [
    "/((?!_next/static|_next/image|ingest|favicon.ico|robots.txt|sitemap.xml|icon.png|apple-icon.png|opengraph-image.png).*)",
  ],
};

const securityHeaders = env.FLAGS_SECRET
  ? securityMiddleware(noseconeOptionsWithToolbar)
  : securityMiddleware(noseconeOptions);

// Custom middleware for Arcjet security checks
const arcjetMiddleware = async (request: NextRequest) => {
  if (!env.ARCJET_KEY) {
    return;
  }

  try {
    await secure(
      [
        // See https://docs.arcjet.com/bot-protection/identifying-bots
        //
        // This is an ALLOWLIST and `detectBot` runs in LIVE mode: anything not
        // named here is denied. That makes omissions silent and expensive.
        "CATEGORY:SEARCH_ENGINE", // Allow search engines
        "CATEGORY:PREVIEW", // Allow preview links to show OG images
        "CATEGORY:MONITOR", // Allow uptime monitoring services
        /* Allow AI crawlers — retrieval and training alike, matching the
           decision documented in app/robots.ts. Without this line, the moment
           ARCJET_KEY is set every one of them (GPTBot, ClaudeBot, OAI-SearchBot,
           PerplexityBot…) starts getting 403 while robots.txt still says they
           are welcome. The site would quietly stop appearing in AI answers and
           robots.txt would look innocent, because the block lives here. */
        "CATEGORY:AI",
      ],
      request
    );
  } catch (error) {
    const message = parseError(error);
    return NextResponse.json({ error: message }, { status: 403 });
  }
};

// Compose non-Clerk middleware with Nemo
const _composedMiddleware = createNEMO(
  {},
  {
    before: [internationalizationMiddleware, arcjetMiddleware],
  }
);

export default authMiddleware(async (request) => {
  const headersResponse = securityHeaders();
  try {
    const i18nResponse = await internationalizationMiddleware(request);
    return i18nResponse || headersResponse;
  } catch (error) {
    console.error("[proxy] i18n middleware threw:", error);
    return headersResponse;
  }
}) as unknown as NextProxy;
