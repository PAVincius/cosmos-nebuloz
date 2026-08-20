"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

/* ════════════════════════════════════════════════════════════
   MOTION PRIMITIVES — Nebuloz readiness
   ─────────────────────────────────────────────────────────────
   Small composable building blocks, ported from the design
   prototype's src/magic.jsx. Every effect reads var(--c-*), so
   nothing here can introduce a colour outside the locked
   palette. The keyframes and the .nz-* classes live in
   app/[locale]/styles.css, not in a runtime <style> injection.

   Deliberately separate from components/cosmos/*: that set was
   built for the retired Cosmos-cyan page and its nearest
   equivalents differ in easing, element type and behaviour.
   ════════════════════════════════════════════════════════════ */

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Palette tone → CSS var, so tone names stay out of the markup. */
export const TONE = {
  violet: "var(--c-violet)",
  indigo: "var(--c-indigo)",
  cyan: "var(--c-cyan)",
  success: "var(--c-success)",
  warning: "var(--c-warning)",
} as const;

export type Tone = keyof typeof TONE;

/* ── BlurFade — reveal with blur, the house transition ────── */

/* An explicit allow-list rather than `motion[as]`: `keyof typeof motion`
   includes non-component keys like `create`, so it never narrows, and casting
   through it would need `any`.

   All three are typed as `motion.div` so the union of their `ref` props does not
   collapse into an unsatisfiable intersection. The only thing the ref is used
   for is `useInView`, which needs nothing narrower than `Element`. */
type MotionTag = typeof motion.div;

const AS: Record<"div" | "li" | "section", MotionTag> = {
  div: motion.div,
  li: motion.li as unknown as MotionTag,
  section: motion.section as unknown as MotionTag,
};

type BlurFadeProps = {
  as?: keyof typeof AS;
  blur?: number;
  children: ReactNode;
  className?: string;
  delay?: number;
  once?: boolean;
  y?: number;
};

export function BlurFade({
  as = "div",
  blur = 6,
  children,
  className = "",
  delay = 0,
  once = true,
  y = 18,
}: BlurFadeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-8%", once });
  const Tag = AS[as];

  /* No `if (reduced) return <Tag>{children}</Tag>` here — that early return left
     the whole page blank for anyone with Reduce Motion on (measured: 111 text
     elements stuck under 0.05 opacity, permanently, below the hero).
     It was a hydration mismatch, not a hook problem. The server has no
     matchMedia, so it always rendered the motion branch and baked
     `style="opacity:0;filter:blur(6px);transform:translateY(18px)"` into the
     HTML. On the client `useReducedMotion()` was already true on the first
     render, so it took the early return — which passes no style, no initial and
     no animate. React 19 does not repair that attribute mismatch, framer never
     took ownership of the node, and the inline opacity:0 simply stayed.
     `<MotionConfig reducedMotion="user">` in app.tsx already does what this
     branch was trying to do by hand: it drops transform and layout animation
     and keeps opacity, so the content still fades in and still ends up visible. */
  return (
    <Tag
      animate={inView ? { filter: "blur(0px)", opacity: 1, y: 0 } : {}}
      className={className}
      initial={{ filter: `blur(${blur}px)`, opacity: 0, y }}
      ref={ref}
      transition={{ delay, duration: 0.7, ease: EASE_OUT }}
    >
      {children}
    </Tag>
  );
}

/* ── BorderBeam — a light that travels the border ─────────── */

type BorderBeamProps = {
  delay?: number;
  duration?: number;
};

export function BorderBeam({ delay = 0, duration = 7 }: BorderBeamProps) {
  return (
    <div aria-hidden="true" className="nz-beam-mask">
      <div
        className="nz-beam"
        style={
          {
            "--nz-beam-delay": `${delay}s`,
            "--nz-beam-dur": `${duration}s`,
          } as CSSProperties
        }
      />
    </div>
  );
}

/* ── Spotlight — cursor-tracked highlight on a surface ────── */

type SpotlightProps = {
  children: ReactNode;
  className?: string;
};

export function Spotlight({ children, className = "" }: SpotlightProps) {
  const ref = useRef<HTMLDivElement>(null);

  const onMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const rect = node.getBoundingClientRect();
    node.style.setProperty("--nz-x", `${event.clientX - rect.left}px`);
    node.style.setProperty("--nz-y", `${event.clientY - rect.top}px`);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: purely decorative pointer tracking — the highlight carries no state, has no keyboard affordance to mirror, and the interactive content is the children.
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: same — onMouseMove only moves a CSS custom property on a pointer-events:none overlay.
    <div className={`nz-spot ${className}`} onMouseMove={onMouseMove} ref={ref}>
      <div aria-hidden="true" className="nz-spot-light" />
      {children}
    </div>
  );
}

/* ── ShimmerText — slow light sweep across a headline ─────── */

type ShimmerTextProps = {
  children: ReactNode;
  className?: string;
};

export function ShimmerText({ children, className = "" }: ShimmerTextProps) {
  return <span className={`nz-shimmer ${className}`}>{children}</span>;
}

/* ── NumberTicker — counts up once, in view ───────────────── */

type NumberTickerProps = {
  className?: string;
  duration?: number;
  pad?: number;
  value: number;
};

export function NumberTicker({
  className = "",
  duration = 1400,
  pad = 2,
  value,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { amount: 0.6, once: true });
  const reduced = useReducedMotion();
  // Server-render the final value so the facts are in the HTML, then let the
  // count-up replay it on hydration.
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (reduced) {
      setShown(value);
      return;
    }
    if (!inView) {
      setShown(0);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      const p = Math.min((now - start) / duration, 1);
      setShown(Math.round(value * (1 - (1 - p) ** 4)));
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration, inView, reduced, value]);

  return (
    <span className={className} ref={ref}>
      {String(shown).padStart(pad, "0")}
    </span>
  );
}

/* ── PulseDot — a status dot with an expanding ring ───────── */

type PulseDotProps = {
  tone?: Tone;
};

export function PulseDot({ tone = "violet" }: PulseDotProps) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex h-[7px] w-[7px] shrink-0"
    >
      <span className={`dot dot-${tone} absolute inset-0`} />
      <span className={`dot dot-${tone} nz-pulse-ring absolute inset-0`} />
    </span>
  );
}

/* ── DotPattern — faint dotted field, masked to fade ──────── */

type DotPatternProps = {
  className?: string;
  opacity?: number;
};

const DOT_MASK =
  "radial-gradient(ellipse 70% 60% at 50% 40%, #000 20%, transparent 78%)";

export function DotPattern({ className = "", opacity = 0.5 }: DotPatternProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        WebkitMaskImage: DOT_MASK,
        backgroundImage:
          "radial-gradient(rgba(255,255,255,0.11) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
        maskImage: DOT_MASK,
        opacity,
      }}
    />
  );
}

/* ── RuleDraw — a hairline that draws itself in view ───────
   Named RuleDraw, not DrawLine: components/cosmos/draw-line.tsx already
   exports a DrawLine that is a <motion.path pathLength> and must live inside
   an <svg>. This one is a <div> that scales on X. Same name over incompatible
   semantics would guarantee a wrong import later. */

type RuleDrawProps = {
  className?: string;
  delay?: number;
};

export function RuleDraw({ className = "", delay = 0 }: RuleDrawProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-10%", once: true });

  return (
    <motion.div
      animate={inView ? { scaleX: 1 } : {}}
      aria-hidden="true"
      className={`h-px origin-left ${className}`}
      initial={{ scaleX: 0 }}
      ref={ref}
      style={{
        background:
          "linear-gradient(90deg, var(--c-violet), var(--c-cyan), transparent)",
      }}
      transition={{ delay, duration: 0.9, ease: EASE_OUT }}
    />
  );
}
