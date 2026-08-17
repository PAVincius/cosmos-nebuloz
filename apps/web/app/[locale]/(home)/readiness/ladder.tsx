"use client";

import { BlurFade, BorderBeam, PulseDot, type Tone } from "./magic";
import { SectionHead } from "./section-head";
import type { LadderCopy } from "./types";

/** Which palette tone each stage carries. Behaviour, not copy. */
const STAGE_TONES: Tone[] = ["violet", "indigo", "cyan", "violet"];

type LadderRowProps = {
  index: number;
  stage: LadderCopy["stages"][number];
};

function LadderRow({ index, stage }: LadderRowProps) {
  return (
    <BlurFade
      as="li"
      className="relative grid gap-6 border-hairline border-t py-9 md:grid-cols-12 md:gap-8 md:py-11"
      delay={0.05}
    >
      <div className="flex items-baseline gap-3 md:col-span-3 md:flex-col md:items-start md:gap-2">
        <span className="label text-faint">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div>
          <div className="display mb-1.5 text-[26px] leading-none">
            {stage.name}
          </div>
          <div className="label flex items-center gap-2 text-muted">
            <PulseDot tone={STAGE_TONES[index] ?? "violet"} />
            <span>{stage.role}</span>
          </div>
        </div>
      </div>

      <div className="md:col-span-5">
        <h3 className="display grad-text mb-3 text-[clamp(21px,2.1vw,27px)] leading-[1.18]">
          {stage.claim}
        </h3>
        <p className="max-w-[420px] text-[14.5px] text-body leading-[1.65]">
          {stage.desc}
        </p>
      </div>

      <div className="md:col-span-4">
        <div className="label mb-3 text-faint">{stage.itemsCap}</div>
        <ul className="border-hairline border-t">
          {stage.items.map((item, k) => (
            <BlurFade
              as="li"
              blur={4}
              className="flex items-baseline gap-3.5 border-hairline border-b py-2.5 text-[13.5px] text-body"
              delay={0.12 + k * 0.06}
              key={item}
              y={10}
            >
              <span className="mono w-5 shrink-0 text-[11px] text-faint">
                {String(k + 1).padStart(2, "0")}
              </span>
              <span>{item}</span>
            </BlurFade>
          ))}
        </ul>
      </div>
    </BlurFade>
  );
}

type CosmosRowProps = {
  copy: LadderCopy["cosmos"];
};

/** The fifth stage sits outside the <ol>: it is the destination, not a step. */
function CosmosRow({ copy }: CosmosRowProps) {
  return (
    <BlurFade className="grad-shell spot-card mt-8 rounded-[19px]" delay={0.05}>
      <div className="grad-shell-inner relative overflow-hidden p-8 md:p-11">
        <BorderBeam duration={9} />
        <div className="relative grid items-center gap-6 md:grid-cols-12 md:gap-8">
          <div className="flex items-baseline gap-3 md:col-span-3 md:flex-col md:items-start md:gap-2">
            <span className="label text-faint">{copy.stage}</span>
            <div>
              <div className="display mb-1.5 text-[30px] leading-none">
                {copy.name}
              </div>
              <div className="label flex items-center gap-2 text-muted">
                <PulseDot tone="success" />
                <span>{copy.role}</span>
              </div>
            </div>
          </div>
          <div className="md:col-span-6">
            <h3 className="display mb-3 text-[clamp(22px,2.3vw,30px)] leading-[1.15]">
              <span className="accent-text">{copy.claim}</span>
            </h3>
            <p className="max-w-[460px] text-[15px] text-body leading-[1.65]">
              {copy.desc}
            </p>
          </div>
          <div className="md:col-span-3">
            <div className="label mb-3 text-faint">{copy.bestFitCap}</div>
            <ul className="space-y-2.5">
              {copy.bestFit.map((item) => (
                <li
                  className="flex items-start gap-2.5 text-[13px] text-body"
                  key={item}
                >
                  <svg
                    aria-hidden="true"
                    className="mt-1.5 shrink-0"
                    focusable="false"
                    height="9"
                    style={{ color: "var(--c-cyan)", opacity: 0.75 }}
                    viewBox="0 0 9 9"
                    width="9"
                  >
                    <path
                      d="M0 4.5h7m-2.5 -2.5l2.5 2.5l-2.5 2.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                    />
                  </svg>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </BlurFade>
  );
}

type LadderProps = {
  copy: LadderCopy;
};

/** 02 · THE LADDER — the five stages, in order. */
export function Ladder({ copy }: LadderProps) {
  return (
    <section
      className="relative border-hairline border-t py-16 sm:py-24 md:py-36"
      id="ladder"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(58% 44% at 50% 0%, rgba(92,180,228,0.06), transparent 62%)",
        }}
      />
      <div className="relative mx-auto max-w-[1280px] px-6">
        <SectionHead
          align="center"
          desc={copy.desc}
          dot="cyan"
          eyebrow={copy.eyebrow}
          titleA={copy.titleA}
          titleB={copy.titleB}
        />
        <ol className="relative">
          {copy.stages.map((stage, index) => (
            <LadderRow index={index} key={stage.name} stage={stage} />
          ))}
        </ol>
        <CosmosRow copy={copy.cosmos} />
      </div>
    </section>
  );
}
