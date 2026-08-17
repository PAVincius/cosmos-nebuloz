import { siteUrl } from "@repo/seo/metadata";
import type { MetadataRoute } from "next";
import { headers } from "next/headers";

/*
 * Lives at `app/`, not `app/[locale]/`. Crawlers fetch `/robots.txt` and
 * nothing else; under the dynamic segment that path matched no route, so it
 * answered 404 while `/en/robots.txt` redirected back to it.
 *
 * The origin comes from `siteUrl`, which normalises the scheme. The previous
 * `startsWith("https") ? "https" : "http"` test read the *host* Vercel injects
 * (a bare `nebuloz.ai`, no scheme), so it always chose `http` and advertised
 * the sitemap over plaintext.
 */

/**
 * AI crawlers, named on purpose.
 *
 * `User-agent: *` already allows every one of these — naming them changes
 * nothing today. It exists so the decision survives the next edit: the most
 * common way a site disappears from AI answers is someone adding a Disallow
 * block for training bots and catching the search bots in the same net,
 * because the two groups are easy to confuse and the names look alike.
 *
 * Two groups, and they are independent:
 *
 *  · RETRIEVAL — fetch a page because a user asked something right now, and
 *    can cite it. Blocking these removes Nebuloz from the answer.
 *  · TRAINING — collect pages into a corpus. Blocking these has no effect on
 *    whether an answer cites the site today.
 *
 * Both are allowed. Nebuloz has no proprietary text to protect and a
 * discovery problem instead; being absent from the corpus only lowers the
 * odds the brand exists in a model's memory at all.
 *
 * Caveat worth keeping honest: a bot that ignores robots.txt is not controlled
 * by this file. Reports of that behaviour exist for some crawlers, and the
 * only real lever there is a WAF rule, not this list.
 */
const AI_RETRIEVAL = [
  "OAI-SearchBot", // OpenAI — ChatGPT Search index
  "ChatGPT-User", // OpenAI — live fetch on a user's request
  "Claude-SearchBot", // Anthropic — search index
  "Claude-User", // Anthropic — live fetch on a user's request
  "PerplexityBot", // Perplexity — index
  "Perplexity-User", // Perplexity — live fetch
];

const AI_TRAINING = [
  "GPTBot", // OpenAI
  "ClaudeBot", // Anthropic
  "Google-Extended", // Google — Gemini training, not Search ranking
  "Applebot-Extended", // Apple — training opt-out token
  "CCBot", // Common Crawl, feeds many corpora
  "Meta-ExternalAgent",
  "Amazonbot",
  "Bytespider", // ByteDance
];

const SEARCH = ["Googlebot", "Bingbot", "DuckDuckBot", "Applebot"];

/* Read per request so the answer follows the host actually being served. */
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const servingHost = (await headers()).get("host");

  /* Only the canonical host invites crawlers.
     Every page sets `canonical` to siteUrl, which is whatever domain is
     assigned as the project's production URL. While that domain's DNS still
     points somewhere else — a parked page, an old host — any OTHER hostname
     serving this build is an indexable page whose canonical points at content
     Google cannot use. That pairing (indexable here, canonical to a noindex
     elsewhere) is how a whole cluster gets dropped, so preview and interim
     hosts say Disallow until the canonical host is the one answering.
     Self-correcting: the moment DNS points the canonical domain at this
     deployment, `servingHost` matches and the allow rules come back with no
     code change. */
  const isCanonicalHost = Boolean(
    siteUrl && servingHost && servingHost.split(":")[0] === siteUrl.hostname
  );

  if (!(siteUrl && isCanonicalHost)) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: [
      { userAgent: "*", allow: "/" },
      { userAgent: [...SEARCH], allow: "/" },
      { userAgent: [...AI_RETRIEVAL], allow: "/" },
      { userAgent: [...AI_TRAINING], allow: "/" },
    ],
    sitemap: new URL("/sitemap.xml", siteUrl).href,
  };
}
