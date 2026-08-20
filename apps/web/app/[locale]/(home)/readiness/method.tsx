"use client";

import { BlurFade, DotPattern, NumberTicker, PulseDot } from "./magic";
import { SectionHead } from "./section-head";
import type { MethodCopy } from "./types";

/** Structural facts, not invented metrics: two weeks to a scored assessment,
 *  eight to a repeatable pattern, one framework the team keeps. Values are
 *  behaviour (they drive the ticker), so they live here, not in the copy. */
const FACT_VALUES = [2, 8, 1];

type StepProps = {
  index: number;
  last: boolean;
  step: MethodCopy["steps"][number];
};

function MethodCell({ index, last, step }: StepProps) {
  return (
    <BlurFade
      className="relative overflow-hidden bg-canvas"
      delay={index * 0.08}
      y={16}
    >
      <DotPattern opacity={0.35} />
      <div className="relative p-7 md:p-8">
        <div className="mb-5 flex items-center gap-2.5">
          <PulseDot tone={last ? "success" : "violet"} />
          <span className="label text-muted">{step.when}</span>
        </div>
        <h3 className="display mb-2.5 text-[21px]">{step.title}</h3>
        <p className="text-[13.5px] text-body leading-[1.6]">{step.desc}</p>
      </div>
    </BlurFade>
  );
}

type MethodProps = {
  copy: MethodCopy;
};

/** 03 · METHOD — what the first eight weeks look like. */
export function Method({ copy }: MethodProps) {
  return (
    <section
      className="relative border-hairline border-t bg-surface/40 py-16 sm:py-24 md:py-36"
      id="method"
    >
      <div className="mx-auto max-w-[1280px] px-6">
        <SectionHead
          desc={copy.desc}
          dot="indigo"
          eyebrow={copy.eyebrow}
          titleA={copy.titleA}
          titleB={copy.titleB}
        />

        {/* One column on phones. At three, each cell was 104px wide with p-6,
            leaving ~56px for a 12px mono label — every label wrapped to three or
            four lines under a number wider than the column it sat in. Stacked,
            each fact is one line: number left, label beside it. */}
        <div className="spot-card mb-5 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-3">
          {copy.facts.map((label, i) => (
            <BlurFade
              className="flex items-baseline gap-4 bg-canvas p-5 sm:block sm:p-6 md:p-7"
              delay={i * 0.09}
              key={label}
            >
              <div className="display hero-heading grad-text mb-0 text-[clamp(34px,4vw,54px)] leading-none sm:mb-2">
                <NumberTicker value={FACT_VALUES[i] ?? 0} />
              </div>
              <div className="mono text-[12px] text-muted leading-[1.5]">
                {label}
              </div>
            </BlurFade>
          ))}
        </div>

        <div className="spot-card grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline md:grid-cols-4">
          {copy.steps.map((step, i) => (
            <MethodCell
              index={i}
              key={step.title}
              last={i === copy.steps.length - 1}
              step={step}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
