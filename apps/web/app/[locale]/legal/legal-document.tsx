import type { Dictionary } from "@repo/internationalization";
import Link from "next/link";

/*
 * Shared chrome for the legal documents.
 *
 * Deliberately a component and NOT a `legal/layout.tsx`. The last layout in this
 * folder rendered BaseHub's <Toolbar /> as a sibling of {children}, which put an
 * unguarded network call outside every error boundary and made the whole route
 * answer 500 about half the time. A component composed by each page keeps the
 * render surface inspectable from the page itself.
 *
 * Content comes from the i18n dictionary, not from a CMS. A privacy policy that
 * depends on a marketing CMS credential disappears the moment that credential
 * rotates — which is exactly what happened here before.
 */

type LegalCopy =
  | Dictionary["web"]["legal"]["privacy"]
  | Dictionary["web"]["legal"]["terms"];

type LegalDocumentProps = {
  copy: LegalCopy;
  shared: Dictionary["web"]["legal"]["shared"];
};

type Section = LegalCopy["sections"][number];

/* `sections` is derived from the dictionary, so its element type is a union of
   the shapes that appear in it — some carry `items`, some do not. Narrowing with
   `"items" in section` inside JSX leaves TypeScript treating the array as
   possibly undefined at each use. Normalising to a plain array once keeps both
   the type checker and the render branch simple. */
const itemsOf = (section: Section): string[] =>
  "items" in section && Array.isArray(section.items) ? section.items : [];

/** Splits `[[…]]` placeholders out so they render as visible gaps, not prose. */
function Prose({ text }: { text: string }) {
  const parts = text.split(/(\[\[[^\]]*\]\])/g);

  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("[[") ? (
          <mark
            className="rounded-[4px] bg-warning/15 px-1.5 py-0.5 text-[0.92em] text-warning"
            // biome-ignore lint/suspicious/noArrayIndexKey: split fragments have no stable id
            key={i}
          >
            {part.replace(/^\[\[|\]\]$/g, "")}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export function LegalDocument({ copy, shared }: LegalDocumentProps) {
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
          {copy.title}
        </h1>
        <p className="mb-6 text-[16px] text-body leading-[1.7]">{copy.lead}</p>
        <p className="mono mb-10 text-[12px] text-muted">
          {shared.updatedLabel}: <Prose text={copy.updated} />
        </p>

        {/* Stated at the top, not buried. Publishing an unreviewed policy as if
            it were reviewed is the failure mode worth guarding against. */}
        <aside className="mb-14 rounded-xl border border-warning/30 bg-warning/[0.06] p-5">
          <div className="label mb-2 text-warning">{shared.draftHeading}</div>
          <p className="text-[14px] text-body leading-[1.65]">
            {shared.draftBody}
          </p>
        </aside>

        <div className="flex flex-col gap-12">
          {copy.sections.map((section, i) => (
            <section key={section.heading}>
              <h2 className="display mb-4 flex gap-4 text-[clamp(20px,2.4vw,26px)] leading-tight">
                <span className="mono shrink-0 pt-1 text-[12px] text-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{section.heading}</span>
              </h2>
              <div className="flex flex-col gap-4 pl-0 sm:pl-10">
                {section.body.map((paragraph) => (
                  <p
                    className="text-[15px] text-body leading-[1.7]"
                    key={paragraph.slice(0, 48)}
                  >
                    <Prose text={paragraph} />
                  </p>
                ))}
                {itemsOf(section).length > 0 ? (
                  <ul className="mt-1 flex flex-col gap-2.5 border-hairline border-l pl-5">
                    {itemsOf(section).map((item) => (
                      <li
                        className="text-[14.5px] text-body leading-[1.65]"
                        key={item.slice(0, 48)}
                      >
                        <Prose text={item} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 border-hairline border-t pt-8">
          <div className="label mb-2 text-faint">{shared.contactHeading}</div>
          <p className="text-[15px] text-body leading-[1.7]">
            <Prose text={shared.contactBody} />
          </p>
        </div>
      </div>
    </main>
  );
}
