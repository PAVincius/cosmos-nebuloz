"use client";

import { useContactDialog } from "./contact-dialog";
import { ShimmerText } from "./magic";
import type { CtaCopy } from "./types";

type ReadinessCtaProps = {
  copy: CtaCopy;
};

/** The close. Always the assessment — low commitment, deliverables are theirs. */
export function ReadinessCta({ copy }: ReadinessCtaProps) {
  const { open: openContact } = useContactDialog();
  return (
    <section
      className="relative overflow-hidden border-hairline border-t py-20 sm:py-28 md:py-40"
      id="start"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(56% 48% at 50% 42%, rgba(92,180,228,0.10), transparent 66%)",
        }}
      />
      <div className="relative mx-auto max-w-[820px] px-6 text-center">
        <div className="label mb-6 inline-flex items-center gap-2 text-muted">
          <span aria-hidden="true" className="dot dot-violet" />
          <span>{copy.eyebrow}</span>
        </div>
        <h2 className="display hero-heading mb-6 text-[clamp(40px,6vw,84px)]">
          <span className="grad-text">{copy.titleA}</span>
          <br />
          <ShimmerText>{copy.titleB}</ShimmerText>
        </h2>
        <p className="mx-auto mb-10 max-w-[520px] text-[17px] text-body leading-[1.6]">
          {copy.lead}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button className="btn-primary" onClick={openContact} type="button">
            <span>{copy.primaryCta}</span>
            <svg
              aria-hidden="true"
              focusable="false"
              height="14"
              viewBox="0 0 14 14"
              width="14"
            >
              <path
                d="M1 7h12M8 2l5 5-5 5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.4"
              />
            </svg>
          </button>
          <a className="btn-ghost" href="#assessment">
            {copy.secondaryCta}
          </a>
        </div>
        <div className="mono mt-11 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[12px] text-muted">
          {copy.notes.map((note, i) => (
            <span className="flex items-center gap-x-7" key={note}>
              <span>{note}</span>
              {i < copy.notes.length - 1 ? (
                <span aria-hidden="true" className="h-3 w-px bg-white/10" />
              ) : null}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
