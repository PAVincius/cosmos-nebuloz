"use client";

// card-header-glow.tsx — "Sangria + Sinal Vivo · Escuro" canonical card header.
// Layers (z, low → high): dot-grid texture (dark only) → radial tonal wash
// (dark only) → top highlight line (dark only) → neon left bar (always) →
// mouse-enter radial pulse (always) → content.
// See design handoff doc: Card-Header-Glow-Pattern.md.

import type { Tone } from "@repo/design-system/cosmos/kit";
import { useThemeName } from "@repo/design-system/cosmos/kit";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type {
  CSSProperties,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
} from "react";
import { useState } from "react";

type PulseState = { x: number; y: number; key: number };

type CardHeaderGlowProps = {
  tone: Tone;
  onActivate?: () => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function CardHeaderGlow({
  tone,
  onActivate,
  children,
  className,
  style,
}: CardHeaderGlowProps) {
  const dark = useThemeName() === "dark";
  const reduceMotion = useReducedMotion();
  const [pulse, setPulse] = useState<PulseState | null>(null);

  function handleEnter(e: MouseEvent<HTMLDivElement>) {
    if (reduceMotion) {
      return; // skip pulse entirely for reduced-motion users
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setPulse({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      key: Date.now(),
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (onActivate && e.key === "Enter") {
      onActivate();
    }
  }

  return (
    <div
      className={className}
      onClick={onActivate}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleEnter}
      role={onActivate ? "button" : undefined}
      style={{
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        padding: "16px 20px 16px 23px",
        borderBottom: "1px solid var(--hairline)",
        background: dark ? "var(--surface-2)" : "var(--surface)",
        cursor: onActivate ? "pointer" : undefined,
        ...style,
      }}
      tabIndex={onActivate ? 0 : undefined}
    >
      {/* neon left bar — always on */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: `var(--${tone})`,
          boxShadow: `0 0 10px 2px rgba(var(--${tone}-rgb),.7), 0 0 24px 4px rgba(var(--${tone}-rgb),.35)`,
        }}
      />

      {/* single radial pulse, born at cursor, one-shot per mouseenter */}
      <AnimatePresence>
        {pulse && (
          <motion.span
            animate={{ opacity: 0, scale: 16 }}
            initial={{ opacity: 0.55, scale: 0 }}
            key={pulse.key}
            onAnimationComplete={() => setPulse(null)}
            style={{
              position: "absolute",
              left: pulse.x,
              top: pulse.y,
              width: 12,
              height: 12,
              marginLeft: -6,
              marginTop: -6,
              borderRadius: "50%",
              background: `radial-gradient(circle, rgba(var(--${tone}-rgb),.5) 0%, transparent 70%)`,
              pointerEvents: "none",
              zIndex: 2,
            }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </AnimatePresence>

      {/* dot-grid texture — dark only */}
      {dark && (
        <div
          className="cosmos-dot-texture"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            opacity: 0.55,
            color: `rgba(var(--${tone}-rgb),.28)`,
            WebkitMaskImage:
              "radial-gradient(160% 140% at 100% 100%, #000 0%, transparent 55%)",
            maskImage:
              "radial-gradient(160% 140% at 100% 100%, #000 0%, transparent 55%)",
          }}
        />
      )}

      {/* radial tonal wash — dark only */}
      {dark && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            background: `radial-gradient(80% 110% at 0% 50%, rgba(var(--${tone}-rgb),.11) 0%, transparent 70%)`,
          }}
        />
      )}

      {/* top highlight line — dark only */}
      {dark && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            zIndex: 1,
            pointerEvents: "none",
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,.1) 30%, rgba(255,255,255,.06) 70%, transparent 100%)",
          }}
        />
      )}

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          flex: 1,
          minWidth: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Rounded tone-colored icon box used inside CardHeaderGlow headers. */
export function IconBadge({
  tone,
  children,
}: {
  tone: Tone;
  children: ReactNode;
}) {
  return (
    <span
      style={{
        display: "grid",
        placeItems: "center",
        width: 40,
        height: 40,
        borderRadius: "var(--r-md)",
        flexShrink: 0,
        color: `var(--${tone})`,
        background: `var(--${tone}-soft)`,
        border: `1px solid rgba(var(--${tone}-rgb),.22)`,
      }}
    >
      {children}
    </span>
  );
}
