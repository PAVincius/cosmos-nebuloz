import { defaultLocale, getDictionary } from "@repo/internationalization";
import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import { LegalDocument } from "../legal-document";

/*
 * A separate document rather than a section of the privacy policy, because it
 * is the page people look for by name and the one a reviewer asks to see. It
 * says almost nothing, which is the point: the site sets one strictly necessary
 * cookie, so there is nothing to consent to and no banner to dismiss.
 */

type CookiesProps = {
  params: Promise<{ locale: string }>;
};

export const generateMetadata = async ({
  params,
}: CookiesProps): Promise<Metadata> => {
  const { locale } = await params;
  const dictionary = await getDictionary(locale);
  const path = "/legal/cookies";

  return createMetadata({
    alternates: {
      canonical: locale === defaultLocale ? path : `/${locale}${path}`,
    },
    description: dictionary.web.legal.cookies.meta.description,
    title: dictionary.web.legal.cookies.meta.title,
  });
};

const CookiesPage = async ({ params }: CookiesProps) => {
  const { locale } = await params;
  const dictionary = await getDictionary(locale);

  return (
    <LegalDocument
      copy={dictionary.web.legal.cookies}
      shared={dictionary.web.legal.shared}
    />
  );
};

export default CookiesPage;
