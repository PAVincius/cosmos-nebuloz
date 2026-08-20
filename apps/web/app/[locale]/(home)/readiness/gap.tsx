"use client";

import { BlurFade, Spotlight } from "./magic";
import { SectionHead } from "./section-head";
import type { GapCopy } from "./types";

type BlockerProps = {
  index: number;
  item: GapCopy["items"][number];
};

function BlockerCell({ index, item }: BlockerProps) {
  return (
    <BlurFade className="bg-canvas" delay={index * 0.07}>
      <Spotlight className="h-full">
        <div className="h-full p-8 md:p-10">
          <div className="mb-4 flex items-baseline gap-4">
            <span className="label text-faint">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="display text-[22px] leading-[1.15] md:text-[26px]">
              {item.title}
            </h3>
          </div>
          <p className="text-[14.5px] text-body leading-[1.65] md:pl-10">
            {item.text}
          </p>
        </div>
      </Spotlight>
    </BlurFade>
  );
}

type TheGapProps = {
  copy: GapCopy;
};

/** 01 · THE GAP — why readiness stalls. */
export function TheGap({ copy }: TheGapProps) {
  return (
    <section className="relative py-16 sm:py-24 md:py-36" id="gap">
      <div className="mx-auto max-w-[1280px] px-6">
        <SectionHead
          desc={copy.desc}
          dot="violet"
          eyebrow={copy.eyebrow}
          titleA={copy.titleA}
          titleB={copy.titleB}
        />
        <div className="spot-card grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline md:grid-cols-2">
          {copy.items.map((item, index) => (
            <BlockerCell index={index} item={item} key={item.title} />
          ))}
        </div>
      </div>
    </section>
  );
}
