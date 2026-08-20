import { defaultLocale, getDictionary } from "@repo/internationalization";
// schema-dts is not a direct dependency of apps/web; @repo/seo/json-ld
// re-exports its types for exactly this reason.
import { JsonLd, type Organization, type WithContext } from "@repo/seo/json-ld";
import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import { ReadinessApp } from "./readiness/app";

type HomeProps = {
  params: Promise<{
    locale: string;
  }>;
};

export const generateMetadata = async ({
  params,
}: HomeProps): Promise<Metadata> => {
  const { locale } = await params;
  const dictionary = await getDictionary(locale);
  return createMetadata({
    /* Locale-aware, not `/${locale}`. next-international runs
       `urlMappingStrategy: "rewriteDefault"`, so the default locale is served
       at `/` and `/en` answers 307 — a canonical pointing at a redirect is a
       signal Google discards, and it contradicted the sitemap, which lists the
       root. Not hardcoded to "/" either: every future locale would then claim
       the root as its canonical. */
    alternates: {
      canonical: locale === defaultLocale ? "/" : `/${locale}`,
    },
    description: dictionary.web.readiness.meta.description,
    title: dictionary.web.readiness.meta.title,
    // No `image`: app/[locale]/opengraph-image.png is already wired by Next's
    // file convention, and passing a string here would override it.
  });
};

/**
 * Nebuloz home — AI readiness and adoption.
 *
 * Server component on purpose. The previous home rendered through
 * `dynamic(..., { ssr: false })`, so `/` shipped no marketing copy at all. Here
 * only the WebGL canvas is client-only (see readiness/scene-client.tsx);
 * everything else server-renders and is crawlable.
 *
 * The old "sovereign AI infrastructure" home is still on disk under
 * ./nebuloz/ and ./nebuloz-client.tsx — kept, but no longer rendered.
 */
const Home = async ({ params }: HomeProps) => {
  const { locale } = await params;
  const dictionary = await getDictionary(locale);
  const copy = dictionary.web.readiness;

  // Organization only. No aggregateRating, no offers, no headcount — the brand
  // rules ban unverifiable claims, and structured data is the easiest place to
  // smuggle one in by accident.
  const organization: WithContext<Organization> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    description: copy.meta.description,
    name: "Nebuloz",
  };

  return (
    <>
      <ReadinessApp copy={copy} logoLabel="Nebuloz — Home" />
      {/* After the app, not before: PostHog injects its own <script> at the top
          of the page body, and a raw <script> as the page's first child hydrates
          against it and mismatches. */}
      <JsonLd code={organization} />
    </>
  );
};

export default Home;
