import { defaultLocale, getDictionary } from "@repo/internationalization";
import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import Link from "next/link";

/*
 * `/legal` used to 301 to `/legal/privacy` from next.config, which was a
 * permanent redirect into a 404 for as long as the CMS had no content. It is a
 * real page now — the one entry point that names both documents.
 */

type LegalIndexProps = {
  params: Promise<{ locale: string }>;
};

export const generateMetadata = async ({
  params,
}: LegalIndexProps): Promise<Metadata> => {
  const { locale } = await params;
  const dictionary = await getDictionary(locale);

  return createMetadata({
    alternates: {
      canonical: locale === defaultLocale ? "/legal" : `/${locale}/legal`,
    },
    description: dictionary.web.legal.index.meta.description,
    title: dictionary.web.legal.index.meta.title,
  });
};

const LegalIndexPage = async ({ params }: LegalIndexProps) => {
  const { locale } = await params;
  const dictionary = await getDictionary(locale);
  const copy = dictionary.web.legal.index;
  const shared = dictionary.web.legal.shared;

  return (
    <main className="relative bg-canvas" id="main-content">
      <div className="mx-auto max-w-[760px] px-6 py-16 sm:py-24 md:py-32">
        <Link
          className="mono inline-flex min-h-11 items-center gap-2 text-[12px] text-muted transition-colors hover:text-ink"
          href="/"
        >
          ← {shared.backLabel}
        </Link>

        <div className="label mt-10 mb-4 text-faint">{copy.eyebrow}</div>
        <h1 className="display hero-heading mb-6 text-[clamp(32px,7vw,52px)]">
          {copy.titleA}
          <br />
          <span className="accent-text">{copy.titleB}</span>
        </h1>
        <p className="mb-12 text-[16px] text-body leading-[1.7]">{copy.lead}</p>

        <ul className="flex flex-col gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline">
          {copy.docs.map((doc) => (
            <li key={doc.href}>
              <Link
                className="group flex flex-col gap-2 bg-canvas p-6 transition-colors hover:bg-surface/60 md:p-7"
                href={doc.href}
              >
                <span className="display flex items-center gap-2 text-[19px] leading-none">
                  {doc.title}
                  <span
                    aria-hidden="true"
                    className="text-muted transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </span>
                <span className="text-[14.5px] text-muted leading-[1.6]">
                  {doc.desc}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <aside className="mt-10 rounded-xl border border-warning/30 bg-warning/[0.06] p-5">
          <div className="label mb-2 text-warning">{shared.draftHeading}</div>
          <p className="text-[14px] text-body leading-[1.65]">
            {shared.draftBody}
          </p>
        </aside>
      </div>
    </main>
  );
};

export default LegalIndexPage;
