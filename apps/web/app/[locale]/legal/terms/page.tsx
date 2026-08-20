import { defaultLocale, getDictionary } from "@repo/internationalization";
import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import { LegalDocument } from "../legal-document";

type TermsProps = {
  params: Promise<{ locale: string }>;
};

export const generateMetadata = async ({
  params,
}: TermsProps): Promise<Metadata> => {
  const { locale } = await params;
  const dictionary = await getDictionary(locale);
  const path = "/legal/terms";

  return createMetadata({
    alternates: {
      canonical: locale === defaultLocale ? path : `/${locale}${path}`,
    },
    description: dictionary.web.legal.terms.meta.description,
    title: dictionary.web.legal.terms.meta.title,
  });
};

const TermsPage = async ({ params }: TermsProps) => {
  const { locale } = await params;
  const dictionary = await getDictionary(locale);

  return (
    <LegalDocument
      copy={dictionary.web.legal.terms}
      shared={dictionary.web.legal.shared}
    />
  );
};

export default TermsPage;
