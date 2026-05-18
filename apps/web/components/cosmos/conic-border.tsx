"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import { type ReactNode, useRef } from "react";

/**
 * Wraps children in a card with an animated conic-gradient border
 * that "runs" around the perimeter on hover.
 */
export function ConicBorderCard({
  children,
  className = "",
  style,
  radius = "var(--radius-xl)",
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  radius?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const angle = useMotionValue(0);
  const smoothAngle = useSpring(angle, { stiffness: 80, damping: 20 });

  const handleMouseEnter = () => {
    // Animate angle 0 → 360 over 1.6s
    let start: number | null = null;
    let raf: number;

    const animate = (ts: number) => {
      if (!start) start = ts;
      const progress = (ts - start) / 1600; // 1.6s
      angle.set(progress * 360);
      if (progress < 1) {
        raf = requestAnimationFrame(animate);
      } else {
        angle.set(360);
      }
    };

    raf = requestAnimationFrame(animate);
    ref.current?.setAttribute("data-raf", String(raf));
  };

  const handleMouseLeave = () => {
    const rafId = ref.current?.getAttribute("data-raf");
    if (rafId) cancelAnimationFrame(Number(rafId));
    // Fade angle back to 0
    angle.set(0);
  };

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={{ ...style, borderRadius: radius }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Animated conic border (pseudo via wrapper) */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: radius,
          padding: 1,
          background: `conic-gradient(from ${smoothAngle}deg, transparent 0deg, var(--accent) 60deg, var(--violet) 120deg, transparent 180deg)`,
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          opacity: 0,
        }}
        whileHover={{ opacity: 1 }}
        transition={{ opacity: { duration: 0.2 } }}
      />
      <>{children}</>
    </div>
  );
}
