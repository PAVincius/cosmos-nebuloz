import { defaultLocale, getDictionary } from "@repo/internationalization";
import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import { LegalDocument } from "../legal-document";

/*
 * A static segment, so it takes precedence over the `[slug]` route that used to
 * serve this path from BaseHub. That CMS route is gone: it had no published
 * content, so /legal/privacy 404'd, and a privacy policy must not depend on a
 * marketing CMS credential being valid.
 */

type PrivacyProps = {
  params: Promise<{ locale: string }>;
};

export const generateMetadata = async ({
  params,
}: PrivacyProps): Promise<Metadata> => {
  const { locale } = await params;
  const dictionary = await getDictionary(locale);
  const path = "/legal/privacy";

  return createMetadata({
    alternates: {
      canonical: locale === defaultLocale ? path : `/${locale}${path}`,
    },
    description: dictionary.web.legal.privacy.meta.description,
    title: dictionary.web.legal.privacy.meta.title,
  });
};

const PrivacyPage = async ({ params }: PrivacyProps) => {
  const { locale } = await params;
  const dictionary = await getDictionary(locale);

  return (
    <LegalDocument
      copy={dictionary.web.legal.privacy}
      shared={dictionary.web.legal.shared}
    />
  );
};

export default PrivacyPage;
