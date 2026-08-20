"use client";

import { SectionHead } from "./section-head";
import type { PositionCopy } from "./types";

type PositionProps = {
  copy: PositionCopy;
};

/** 06 · POSITION — what we are and are not, stated plainly. */
export function Position({ copy }: PositionProps) {
  return (
    <section
      className="relative border-hairline border-t bg-surface/40 py-16 sm:py-24 md:py-36"
      id="position"
    >
      <div className="mx-auto max-w-[1080px] px-6">
        <SectionHead
          align="center"
          dot="violet"
          eyebrow={copy.eyebrow}
          titleA={copy.titleA}
          titleB={copy.titleB}
        />
        <div className="spot-card overflow-hidden rounded-2xl border border-hairline">
          {copy.rows.map((row, i) => (
            <div
              className={`grid md:grid-cols-2 ${i > 0 ? "border-hairline border-t" : ""}`}
              key={row.yes}
            >
              <div className="flex items-start gap-3 p-6 md:p-7">
                <span
                  aria-hidden="true"
                  className="dot dot-success mt-1.5 shrink-0"
                />
                <span className="text-[15px] text-ink leading-[1.55]">
                  {row.yes}
                </span>
              </div>
              <div className="flex items-start gap-3 border-hairline border-t p-6 md:border-t-0 md:border-l md:p-7">
                <span
                  aria-hidden="true"
                  className="mt-3 h-px w-[7px] shrink-0 bg-white/25"
                />
                <span className="text-[15px] text-muted leading-[1.55]">
                  {row.no}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
