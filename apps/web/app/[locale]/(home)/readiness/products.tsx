"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  BlurFade,
  BorderBeam,
  EASE_OUT,
  PulseDot,
  Spotlight,
  type Tone,
} from "./magic";
import { SectionHead } from "./section-head";
import type { ProductsCopy } from "./types";

/** Tone per product, in ladder order. Cosmos is the only success-green one —
 *  it is the destination, not a step. */
const PRODUCT_TONES: Tone[] = ["violet", "indigo", "cyan", "violet", "success"];

const ROTATE_MS = 10_000;

type TabsProps = {
  active: number;
  copy: ProductsCopy;
  onSelect: (index: number) => void;
};

function ProductTabs({ active, copy, onSelect }: TabsProps) {
  return (
    <div
      aria-label={copy.tablistLabel}
      className="mb-8 flex flex-wrap gap-2"
      role="tablist"
    >
      {copy.items.map((product, i) => (
        <button
          aria-selected={active === i}
          className="group inline-flex min-h-11 items-center gap-2.5 rounded-full border px-4 py-2.5 transition-all duration-200"
          key={product.name}
          onClick={() => onSelect(i)}
          role="tab"
          style={{
            background:
              active === i
                ? "rgba(92,180,228,0.08)"
                : "rgba(255,255,255,0.015)",
            /* Inactive tabs sit on rgba(255,255,255,0.015) — effectively no
               background — so the border is the only thing marking the control.
               0.10 measured 1.24:1 against the canvas; --c-border-control is
               the 3.48:1 value. The active tab keeps its sky tint, which
               already reads on its own. */
            borderColor:
              active === i
                ? "rgba(92,180,228,0.55)"
                : "var(--c-border-control)",
            color: active === i ? "var(--c-ink)" : "var(--c-muted)",
          }}
          type="button"
        >
          <span
            aria-hidden="true"
            className={`dot dot-${PRODUCT_TONES[i] ?? "violet"}`}
          />
          <span className="display text-[15px] leading-none">
            {product.name}
          </span>
          <span className="label text-[10px] opacity-70">{product.role}</span>
        </button>
      ))}
    </div>
  );
}

type PanelProps = {
  copy: ProductsCopy;
  index: number;
  product: ProductsCopy["items"][number];
};

function ProductPanel({ copy, index, product }: PanelProps) {
  return (
    <motion.div
      animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
      className="relative grid gap-8 p-6 sm:p-8 md:grid-cols-12 md:gap-10 md:p-12"
      exit={{ filter: "blur(5px)", opacity: 0, y: -10 }}
      initial={{ filter: "blur(5px)", opacity: 0, y: 14 }}
      key={product.name}
      transition={{ duration: 0.42, ease: EASE_OUT }}
    >
      <div className="md:col-span-6 lg:col-span-4">
        <div className="label mb-3 flex items-center gap-2 text-muted">
          <PulseDot tone={PRODUCT_TONES[index] ?? "violet"} />
          <span>{product.role.toUpperCase()}</span>
        </div>
        <div className="display mb-4 text-[clamp(34px,4vw,52px)] leading-none">
          {product.name}
        </div>
        <p className="display mb-6 text-[19px] leading-[1.25] accent-text">
          {product.line}
        </p>
        <dl className="space-y-3 border-hairline border-t pt-5">
          <div>
            <dt className="label mb-1 text-faint">{copy.whoCap}</dt>
            <dd className="text-[13.5px] text-body">{product.who}</dd>
          </div>
          <div>
            <dt className="label mb-1 text-faint">{copy.cadenceCap}</dt>
            <dd className="text-[13.5px] text-body">{product.cadence}</dd>
          </div>
        </dl>
      </div>

      <div className="md:col-span-6 lg:col-span-5">
        <p className="mb-7 text-[15px] text-body leading-[1.65]">
          {product.desc}
        </p>
        <div className="label mb-3 text-faint">{copy.outputsCap}</div>
        <ul className="border-hairline border-t">
          {product.outputs.map((output, k) => (
            <BlurFade
              as="li"
              blur={3}
              className="flex items-baseline gap-3.5 border-hairline border-b py-2.5 text-[13.5px] text-body"
              delay={k * 0.05}
              key={output}
              y={8}
            >
              <span className="mono w-5 shrink-0 text-[11px] text-faint">
                {String(k + 1).padStart(2, "0")}
              </span>
              <span>{output}</span>
            </BlurFade>
          ))}
        </ul>
      </div>

      <div className="md:col-span-12 lg:col-span-3">
        <Spotlight className="h-full rounded-xl border border-hairline bg-white/[0.015]">
          <div className="flex h-full flex-col p-6">
            <div className="label mb-3 text-faint">{copy.aloneCap}</div>
            <p className="flex-1 text-[14px] text-ink leading-[1.6]">
              {product.alone}
            </p>
            <a
              className="mono mt-6 inline-flex min-h-11 items-center gap-2 border-hairline border-t pt-5 text-[12.5px] text-body transition-colors hover:text-ink"
              href="#start"
            >
              <span>{copy.talk.replace("{name}", product.name)}</span>
              <svg
                aria-hidden="true"
                focusable="false"
                height="11"
                viewBox="0 0 14 14"
                width="11"
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
            </a>
          </div>
        </Spotlight>
      </div>
    </motion.div>
  );
}

type ProductsProps = {
  copy: ProductsCopy;
};

/** 04 · THE PRODUCTS — parity for all five, each standing alone. */
export function Products({ copy }: ProductsProps) {
  const [active, setActive] = useState(0);
  /* One-way latch, and state rather than a ref so the stop control can take
     itself off screen. This used to be a `paused` ref set true on pointerenter
     and back to false on pointerleave — which on a touchscreen means any tap
     inside the section that is not a tab (reading the panel, starting a scroll,
     hitting the link) ends in a pointerleave that re-arms rotation, and the
     panel then swaps under the reader's thumb. Once the reader shows intent,
     rotation is done for the rest of the visit. */
  const [rotating, setRotating] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);
  const total = copy.items.length;

  // Auto-rotate only while the section is on screen and the tab is visible.
  useEffect(() => {
    if (!rotating) {
      return;
    }
    let inView = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
      },
      { threshold: 0.25 }
    );
    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    const id = setInterval(() => {
      if (inView && !document.hidden) {
        setActive((a) => (a + 1) % total);
      }
    }, ROTATE_MS);
    return () => {
      clearInterval(id);
      observer.disconnect();
    };
  }, [total, rotating]);

  const pick = (index: number) => {
    setRotating(false);
    setActive(index);
  };

  const product = copy.items[active];

  return (
    <section
      className="relative border-hairline border-t py-16 sm:py-24 md:py-36"
      id="products"
      ref={sectionRef}
    >
      <div className="mx-auto max-w-[1280px] px-6">
        <SectionHead
          desc={copy.desc}
          dot="indigo"
          eyebrow={copy.eyebrow}
          titleA={copy.titleA}
          titleB={copy.titleB}
        />

        <ProductTabs active={active} copy={copy} onSelect={pick} />

        {/* WCAG 2.2.2: the panel rotates every 10s, so there has to be a way to
            stop it that is not "guess that tapping a tab also stops it". Gone
            once rotation is off — a dead control is worse than none. */}
        {rotating ? (
          <button
            className="mono -mt-2 mb-4 inline-flex min-h-11 items-center gap-2 text-[12px] text-muted transition-colors hover:text-ink"
            onClick={() => setRotating(false)}
            type="button"
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-[1px] bg-current"
            />
            {copy.stopRotation}
          </button>
        ) : null}

        <div className="grad-shell spot-card rounded-[19px]">
          <div className="grad-shell-inner relative overflow-hidden">
            <BorderBeam duration={10} />
            <AnimatePresence mode="wait">
              <ProductPanel copy={copy} index={active} product={product} />
            </AnimatePresence>
          </div>
        </div>

        <BlurFade delay={0.1}>
          <div className="spot-card mono mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-hairline bg-white/[0.01] p-5 text-[12.5px] text-muted">
            <span className="text-ink">{copy.orderLabel}</span>
            {/* Decoration, so exempt from 1.4.3 — but at white/20 it measured
                1.75:1 and was effectively invisible, which defeats the point of
                having a separator. white/40 lands near 3.6:1. */}
            <span aria-hidden="true" className="text-white/40">
              →
            </span>
            {copy.items.map((item, i) => (
              <span className="flex items-center gap-3" key={item.name}>
                <button
                  className={`transition-colors hover:text-ink ${active === i ? "text-ink" : ""}`}
                  onClick={() => pick(i)}
                  type="button"
                >
                  {item.name}
                </button>
                {i < total - 1 ? (
                  // Same call as the arrow above: decorative, exempt, but 1.75:1
                  // was invisible rather than subtle.
                  <span aria-hidden="true" className="text-white/40">
                    ·
                  </span>
                ) : null}
              </span>
            ))}
            {/* Was text-white/30 — 2.55:1 at 12.5px. This is real information
                ("most teams start at Meridian and stop when the gap closes"),
                not decoration, so it owes the full 4.5:1. --c-muted is 6.83:1
                and is already the quiet-but-readable tier. */}
            <span className="ml-auto hidden text-muted lg:block">
              {copy.orderNote}
            </span>
          </div>
        </BlurFade>
      </div>
    </section>
  );
}
