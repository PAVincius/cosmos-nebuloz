"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import { useContactDialog } from "./contact-dialog";
import { EASE_OUT } from "./magic";
import { useSceneSignals } from "./nebula-store";
import { ReadinessScene } from "./scene-client";
import { useNebulaMount } from "./scene-gate";
import type { HeroCopy } from "./types";

/** World-space X the sphere is composed around while the hero is on screen. */
const HERO_OFFSET_X = 1.5;
/** How long the nebula takes to assemble on its own, before scroll takes over. */
const INTRO_MS = 5200;

type SplitLineProps = {
  accent?: boolean;
  delay?: number;
  text: string;
};

/**
 * CSS reveal, deliberately not framer-motion.
 *
 * `initial={{ opacity: 0, y: 22 }}` bakes
 * `style="opacity:0;transform:translateY(22px)"` into the server HTML, and the
 * h1 is the LCP element — so the largest paint waited on the JS bundle
 * downloading, parsing and hydrating. With JS blocked or broken the page was a
 * black screen (measured: 72 elements shipped with inline opacity:0).
 *
 * A keyframe runs at paint, costs no bundle, and leaves the markup visible.
 * `backwards` holds the from-state through the delay; the whole rule sits
 * inside `prefers-reduced-motion: no-preference`, so anyone who asked for less
 * motion gets the text immediately with no animation at all.
 */
function SplitLine({ accent = false, delay = 0, text }: SplitLineProps) {
  return (
    <span className="block">
      <span
        className={`hero-line inline-block ${accent ? "accent-text" : "grad-text"}`}
        style={{ animationDelay: `${delay}s` }}
      >
        {text}
      </span>
    </span>
  );
}

/**
 * Drives the scene from page scroll, and dims the fixed layer so the sphere
 * recedes while you read and returns at the CTA. One rAF loop writes the
 * signals; a separate passive scroll listener owns the opacity, because that is
 * a style write and does not need to run every frame.
 */
function useSceneChoreography(
  sceneRef: RefObject<HTMLDivElement | null>,
  active: boolean
) {
  const signals = useSceneSignals();

  useEffect(() => {
    /* Nothing to choreograph without a scene. This used to run regardless, so
       the weakest devices — the ones the gate just spared from WebGL — still
       paid for a 60fps rAF and a scroll listener driving a sphere that was
       never mounted. */
    if (!active) {
      return;
    }
    const current = signals.current;
    current.offsetX = HERO_OFFSET_X;

    let raf = 0;
    let start: number | null = null;
    /* How much of the viewport "Your shape" holds, 0–1. Measured once per
       scroll rather than per frame, and shared by the two things that need it:
       the scene's opacity and where the sphere sits. */
    let shapeCover = 0;

    /* Cached: reading `scrollHeight` forces a layout recalculation, and doing
       that every frame against a ~13,000px document is the single most
       expensive thing this loop did. Re-measured on resize instead. */
    let scrollMax = 0;
    const measure = () => {
      scrollMax = document.documentElement.scrollHeight - window.innerHeight;
    };
    measure();

    const scrollProgress = () =>
      scrollMax > 0 ? Math.min(window.scrollY / scrollMax, 1) : 0;

    const tick = (now: number) => {
      start ??= now;
      const intro = Math.min((now - start) / INTRO_MS, 1);
      const sp = scrollProgress();
      // Intro ramp gets it most of the way; scroll finishes the assembly.
      current.build = Math.min(intro * 0.9 + sp * 0.35, 1);
      // Quiet mid-page, surging through the last quarter.
      current.energy = (Math.max(sp - 0.72, 0) / 0.28) ** 1.6;
      // The sphere slides to centre as soon as the hero leaves.
      const c = Math.min(
        Math.max(window.scrollY / window.innerHeight - 0.25, 0) / 0.55,
        1
      );
      const centred = HERO_OFFSET_X * (1 - c * c * (3 - 2 * c));
      /* …and slides back out to the right across "Your shape". The copy there
         reads "the sphere beside you is your organisation", and a centred
         sphere sits behind the question column instead of beside it. Held
         right, it lands under the axis readout — the thing that is actually
         reporting its state. */
      current.offsetX = centred + (HERO_OFFSET_X - centred) * shapeCover;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onScroll = () => {
      if (!sceneRef.current) {
        return;
      }
      const sp = scrollProgress();
      // 1 → 0.16 over the first 30%, hold, then back to 0.85 in the last 25%.
      let dim = 0.16;
      if (sp < 0.3) {
        dim = 1 - (sp / 0.3) * 0.84;
      } else if (sp >= 0.75) {
        dim = 0.16 + ((sp - 0.75) / 0.25) * 0.69;
      }

      /* "Your shape" is the one mid-page section that needs the sphere: the
         quiz drives its geometry and the copy points straight at it. Lift the
         scene back up in proportion to how much of the viewport that section
         holds, so it surfaces on approach instead of cutting in. */
      const shape = document.getElementById("shape");
      if (shape) {
        const rect = shape.getBoundingClientRect();
        const vh = window.innerHeight;
        const overlap = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
        shapeCover = Math.max(0, Math.min(overlap / vh, 1));
        dim = Math.max(dim, 0.16 + shapeCover * 0.66);
      } else {
        shapeCover = 0;
      }

      sceneRef.current.style.opacity = dim.toFixed(3);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const onResize = () => {
      measure();
      onScroll();
    };
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      current.energy = 0;
    };
    // `active` belongs here: the gate resolves after mount, so the effect has
    // to re-run when it flips from false to true or the loop never starts.
  }, [sceneRef, signals, active]);
}

type ReadinessHeroProps = {
  copy: HeroCopy;
};

export function ReadinessHero({ copy }: ReadinessHeroProps) {
  const { open: openContact } = useContactDialog();
  const ref = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  /* Lifted out of ReadinessScene so the choreography, the fixed layer and the
     scrim can all be skipped together. Without the scene there is nothing for
     any of them to reveal — and every scrim stop is rgba(7,8,12,α) over a
     rgb(7,8,12) page, so they paint the exact same colour either way. */
  const { mount, tier } = useNebulaMount();
  const { scrollYProgress } = useScroll({
    offset: ["start start", "end start"],
    target: ref,
  });
  const textY = useTransform(scrollYProgress, [0, 1], [0, 70]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  useSceneChoreography(sceneRef, mount);

  return (
    <>
      {/* The scene is fixed behind the WHOLE page, not just the hero. */}
      {mount ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0"
          ref={sceneRef}
        >
          <ReadinessScene label={copy.sceneAlt} tier={tier} />
          {/* Scrim: solid under the headline, open over the sphere.
              The prototype held 0.78 out to 58% and only reached 0.35 at the far
              edge, which put ~0.6 of black across the sphere itself and flattened
              the rim the whole scene is built around. The copy column ends near
              57%, so everything past it can clear out. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, #07080c 0%, #07080c 30%, rgba(7,8,12,0.88) 41%, rgba(7,8,12,0.62) 52%, rgba(7,8,12,0.34) 64%, rgba(7,8,12,0.13) 78%, rgba(7,8,12,0.02) 91%, rgba(7,8,12,0) 100%)",
            }}
          />
        </div>
      ) : null}

      <section
        className="relative flex min-h-[92svh] items-center overflow-hidden"
        id="top"
        ref={ref}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[1] bg-grid opacity-[0.18]"
        />

        <div className="relative z-10 mx-auto w-full max-w-[1280px] px-6 pt-24 pb-16">
          {/* MotionValues bound straight to `style` bypass MotionConfig — it
              only governs animations, so reduced-motion users were still
              getting the parallax drift and the fade-out. */}
          <motion.div
            className="max-w-[720px]"
            style={reduced ? undefined : { opacity: textOpacity, y: textY }}
          >
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="label mb-7 inline-flex items-center gap-2 rounded-full border border-hairline bg-white/[0.025] px-3.5 py-1.5 text-[11px] text-body"
              initial={{ opacity: 0, y: 10 }}
              transition={{ delay: 0.25, duration: 0.7, ease: EASE_OUT }}
            >
              <span aria-hidden="true" className="dot dot-violet" />
              <span>{copy.badge}</span>
            </motion.div>

            {/* Separate mobile clamp. The single `clamp(42px,6.6vw,96px)` had a
                FIXED floor, so at 360px — a very common Android width — vw lost
                to the floor and the headline broke into five ragged lines. The
                mobile ceiling stays at today's 42px on purpose: raising it would
                also enlarge the 467–767px band, which nobody asked for. */}
            <h1 className="display hero-heading mb-7 text-[clamp(34px,9vw,42px)] md:text-[clamp(48px,6.6vw,96px)]">
              {copy.lines.map((line, i) => (
                <SplitLine
                  accent={i === copy.lines.length - 1}
                  delay={0.4 + i * 0.12}
                  key={line}
                  text={line}
                />
              ))}
            </h1>

            <motion.p
              animate={{ opacity: 1, y: 0 }}
              className="mb-9 max-w-[520px] text-[17px] text-body leading-[1.6]"
              initial={{ opacity: 0, y: 10 }}
              transition={{ delay: 1.05, duration: 0.8, ease: EASE_OUT }}
            >
              {copy.lead}
            </motion.p>

            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="mb-12 flex flex-wrap items-center gap-3"
              initial={{ opacity: 0, y: 10 }}
              transition={{ delay: 1.3, duration: 0.7, ease: EASE_OUT }}
            >
              <button
                className="btn-primary group"
                onClick={openContact}
                type="button"
              >
                <span>{copy.primaryCta}</span>
                <svg
                  aria-hidden="true"
                  className="opacity-70 transition-transform group-hover:translate-x-0.5"
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
              <a className="btn-ghost" href="#ladder">
                <span>{copy.secondaryCta}</span>
              </a>
            </motion.div>

            {/* The ladder, previewed as the site's spine. */}
            <motion.div
              animate={{ opacity: 1 }}
              className="border-hairline border-t pt-7"
              initial={{ opacity: 0 }}
              transition={{ delay: 1.6, duration: 0.9 }}
            >
              <div className="label mb-4 text-faint">{copy.sequenceLabel}</div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
                {copy.sequence.map((stage, i) => (
                  <span className="flex items-center gap-x-3" key={stage}>
                    <span
                      className={`mono text-[13px] tracking-[0.04em] ${i === copy.sequence.length - 1 ? "text-muted" : "text-body"}`}
                    >
                      <span className="mr-1.5 text-faint">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {stage}
                    </span>
                    {i < copy.sequence.length - 1 ? (
                      <span
                        aria-hidden="true"
                        className="h-px w-4 bg-white/15"
                      />
                    ) : null}
                  </span>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
