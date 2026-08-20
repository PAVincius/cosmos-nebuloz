"use client";

import { MotionConfig } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ReadinessCta } from "./cta";
import { ReadinessFooter } from "./footer";
import { TheGap } from "./gap";
import { ReadinessHero } from "./hero";
import { Ladder } from "./ladder";
import { Method } from "./method";
import { ReadinessNav } from "./nav";
import { SceneSignalsProvider } from "./nebula-store";
import { Position } from "./position";
import { Products } from "./products";
import { Proof } from "./proof";
import { ReadinessShape } from "./shape";
import type { ReadinessCopy } from "./types";
import { useSpotCards } from "./use-spot-cards";

/**
 * Backdrop for <main>. Mostly opaque so the copy holds, with one window opened
 * over "Your shape" — that section's whole promise is "the sphere beside you is
 * your organisation", and behind a flat 0.88 scrim there is no sphere to see.
 *
 * Built at runtime from the section's measured position rather than written as
 * fixed percentages: the sections are copy-driven, so their offsets move with
 * translation, wrapping and viewport width. A hardcoded window drifts off the
 * thing it is meant to frame.
 */
const SCRIM_FALLBACK =
  "linear-gradient(180deg, rgba(7,8,12,0) 0%, rgba(7,8,12,0.88) 6%, rgba(7,8,12,0.88) 82%, rgba(7,8,12,0.3) 100%)";

function buildScrim(main: HTMLElement, shape: HTMLElement): string {
  const height = main.offsetHeight;
  if (height <= 0) {
    return SCRIM_FALLBACK;
  }
  const pct = (px: number) => (px / height) * 100;
  const top = pct(shape.offsetTop - main.offsetTop);
  const bottom = top + pct(shape.offsetHeight);

  /* Shoulders are a fraction of the section, not fixed percentage points. The
     section is only ~10% of main's height, so fixed shoulders (+6 / -8) cross
     over each other and collapse the window to nothing. */
  const span = bottom - top;
  const shoulder = Math.min(span * 0.22, 4);
  const fadeIn = top + shoulder * 0.5;
  const openFrom = top + shoulder;
  const openTo = bottom - shoulder;
  const fadeOut = bottom - shoulder * 0.5;

  // Bail rather than emit a gradient with out-of-order stops.
  if (!(fadeIn < openFrom && openFrom < openTo && openTo < fadeOut)) {
    return SCRIM_FALLBACK;
  }

  return [
    "linear-gradient(180deg",
    "rgba(7,8,12,0) 0%",
    "rgba(7,8,12,0.88) 6%",
    `rgba(7,8,12,0.88) ${fadeIn.toFixed(2)}%`,
    `rgba(7,8,12,0.22) ${openFrom.toFixed(2)}%`,
    `rgba(7,8,12,0.22) ${openTo.toFixed(2)}%`,
    `rgba(7,8,12,0.88) ${fadeOut.toFixed(2)}%`,
    "rgba(7,8,12,0.88) 82%",
    "rgba(7,8,12,0.3) 100%)",
  ].join(", ");
}

type ReadinessAppProps = {
  copy: ReadinessCopy;
  logoLabel: string;
};

export function ReadinessApp({ copy, logoLabel }: ReadinessAppProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [scrim, setScrim] = useState(SCRIM_FALLBACK);
  useSpotCards(rootRef);

  // Re-measure the window over "Your shape" whenever the layout can move it.
  useEffect(() => {
    const measure = () => {
      const main = mainRef.current;
      const shape = document.getElementById("shape");
      if (main && shape) {
        setScrim(buildScrim(main, shape));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (mainRef.current) {
      observer.observe(mainRef.current);
    }
    return () => observer.disconnect();
  }, []);

  /* The hidden-tab nudge that used to live here — three setTimeouts plus a
     visibilitychange listener forcing re-renders — is gone. It was written for
     a failure that does not happen: rAF is suspended in a background tab, so
     the animation simply has not started yet, and the moment the tab comes
     forward rAF resumes and framer finishes on its own. Reproduced with a real
     backgrounded tab, then resumed rAF *without* firing visibilitychange, and
     the copy went to opacity 1 by itself.
     The one case where copy really did stay invisible was reduced motion, and
     that was a hydration mismatch in BlurFade — fixed at the source. */

  return (
    // framer-motion is JS-driven, so the `prefers-reduced-motion` sledgehammer in
    // globals.css (which only kills CSS animations/transitions) never reaches it.
    // `reducedMotion="user"` is the library's own switch: it drops transform and
    // layout animation for those users and keeps opacity, so nothing is left
    // invisible the way a blanket disable would.
    <MotionConfig reducedMotion="user">
      <SceneSignalsProvider>
        <div
          className="relative bg-canvas"
          data-screen-label="Nebuloz Readiness Home"
          ref={rootRef}
        >
          <ReadinessNav copy={copy.nav} logoLabel={logoLabel} />
          <ReadinessHero copy={copy.hero} />
          <main
            className="relative z-10"
            id="main-content"
            ref={mainRef}
            style={{ background: scrim }}
          >
            <TheGap copy={copy.gap} />
            <Ladder copy={copy.ladder} />
            <ReadinessShape copy={copy.shape} />
            <Method copy={copy.method} />
            <Products copy={copy.products} />
            <Proof copy={copy.proof} />
            <Position copy={copy.position} />
            <ReadinessCta copy={copy.cta} />
          </main>
          <ReadinessFooter copy={copy.footer} logoLabel={logoLabel} />
        </div>
      </SceneSignalsProvider>
    </MotionConfig>
  );
}
