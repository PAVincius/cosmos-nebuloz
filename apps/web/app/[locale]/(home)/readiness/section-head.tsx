"use client";

import { BlurFade, RuleDraw, type Tone } from "./magic";

type SectionHeadProps = {
  /** `grid` splits heading and description across 12 columns; `center` stacks. */
  align?: "grid" | "center";
  desc?: string;
  dot?: Tone;
  eyebrow: string;
  titleA: string;
  titleB: string;
};

export function SectionHead({
  align = "grid",
  desc,
  dot = "violet",
  eyebrow,
  titleA,
  titleB,
}: SectionHeadProps) {
  if (align === "center") {
    return (
      <div className="mx-auto mb-10 max-w-[720px] text-center md:mb-16">
        <BlurFade blur={4} y={12}>
          <div className="label mb-4 inline-flex items-center gap-2 text-muted">
            <span aria-hidden="true" className={`dot dot-${dot}`} />
            <span>{eyebrow}</span>
          </div>
          <h2 className="display display-tight mb-5 text-[clamp(34px,4.4vw,60px)]">
            <span className="grad-text">{titleA}</span>{" "}
            <span className="accent-text">{titleB}</span>
          </h2>
          {desc ? (
            <p className="mx-auto max-w-[560px] text-[16px] text-body leading-[1.6]">
              {desc}
            </p>
          ) : null}
          <RuleDraw className="mx-auto mt-8 max-w-[120px]" delay={0.25} />
        </BlurFade>
      </div>
    );
  }

  return (
    <div className="mb-10 grid gap-8 md:mb-16 md:grid-cols-12">
      <div className="md:col-span-7">
        <BlurFade blur={5} y={14}>
          <div className="label mb-4 flex items-center gap-2 text-muted">
            <span aria-hidden="true" className={`dot dot-${dot}`} />
            <span>{eyebrow}</span>
          </div>
          <h2 className="display display-tight text-[clamp(34px,4.6vw,64px)]">
            <span className="grad-text">{titleA}</span>
            <br />
            <span className="accent-text">{titleB}</span>
          </h2>
          <RuleDraw className="mt-6 max-w-[160px]" delay={0.3} />
        </BlurFade>
      </div>
      {desc ? (
        <div className="self-end md:col-span-5">
          <BlurFade blur={4} delay={0.15} y={12}>
            <p className="max-w-md text-[16px] text-body leading-[1.6]">
              {desc}
            </p>
          </BlurFade>
        </div>
      ) : null}
    </div>
  );
}
