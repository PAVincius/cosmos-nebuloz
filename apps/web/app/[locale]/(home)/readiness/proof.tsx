"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { BorderBeam, EASE_OUT } from "./magic";
import { SectionHead } from "./section-head";
import type { ProofCopy } from "./types";

type ProofProps = {
  copy: ProofCopy;
};

/**
 * 05 · THE ASSESSMENT — the five questions most roadmaps skip.
 *
 * Every answer stays mounted and is collapsed by height rather than unmounted.
 * This is the densest block of prose on the page, so it needs to be in the
 * server-rendered HTML whether or not a row happens to be open.
 */
export function Proof({ copy }: ProofProps) {
  const [open, setOpen] = useState(0);

  // Hoisted out of the JSX attribute: a ternary inline there trips
  // nursery/noLeakedRender, which cannot tell a state setter from a render.
  const toggle = (index: number) =>
    setOpen((previous) => (previous === index ? -1 : index));

  return (
    <section
      className="relative border-hairline border-t py-16 sm:py-24 md:py-36"
      id="assessment"
    >
      <div className="mx-auto max-w-[1280px] px-6">
        <SectionHead
          desc={copy.desc}
          dot="cyan"
          eyebrow={copy.eyebrow}
          titleA={copy.titleA}
          titleB={copy.titleB}
        />
        <div className="spot-card relative overflow-hidden rounded-2xl border border-hairline">
          <BorderBeam duration={11} />
          {copy.axes.map((axis, i) => {
            const isOpen = open === i;
            const panelId = `proof-panel-${axis.title.toLowerCase()}`;
            return (
              <button
                aria-controls={panelId}
                aria-expanded={isOpen}
                className={`group relative w-full p-6 text-left transition-colors hover:bg-white/[0.015] md:p-8 ${i > 0 ? "border-hairline border-t" : ""}`}
                key={axis.title}
                onClick={() => toggle(i)}
                type="button"
              >
                <div className="flex items-start gap-4 md:gap-6">
                  <span className="label mt-1 w-6 shrink-0 text-faint">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-4">
                      <h3 className="display text-[20px] md:text-[24px]">
                        {axis.title}
                      </h3>
                      <span className="label shrink-0 text-faint transition-colors group-hover:text-muted">
                        {isOpen ? "—" : "+"}
                      </span>
                    </div>
                    <p className="mt-2 max-w-[620px] text-[14.5px] text-body leading-[1.6]">
                      {axis.q}
                    </p>
                    <motion.div
                      animate={{
                        height: isOpen ? "auto" : 0,
                        opacity: isOpen ? 1 : 0,
                      }}
                      className="overflow-hidden"
                      id={panelId}
                      initial={false}
                      transition={{ duration: 0.35, ease: EASE_OUT }}
                    >
                      <p className="mt-4 max-w-[620px] border-hairline border-t pt-4 text-[14px] text-muted leading-[1.7]">
                        {axis.desc}
                      </p>
                    </motion.div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
