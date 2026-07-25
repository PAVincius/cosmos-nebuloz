"use client";

import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useRef } from "react";

type AnimatedCounterProps = {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  style?: React.CSSProperties;
  duration?: number;
};

export function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  className = "",
  style,
  duration = 1.8,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  const mv = useMotionValue(0);
  const spring = useSpring(mv, {
    stiffness: 60,
    damping: 18,
    restDelta: 0.1,
  });

  useEffect(() => {
    if (inView) {
      mv.set(value);
    }
  }, [inView, mv, value]);

  useEffect(
    () =>
      spring.on("change", (v) => {
        if (spanRef.current) {
          spanRef.current.textContent = `${prefix}${Math.round(v)}${suffix}`;
        }
      }),
    [spring, prefix, suffix]
  );

  return (
    <span className={className} ref={ref} style={style}>
      <span ref={spanRef}>
        {prefix}0{suffix}
      </span>
    </span>
  );
}

/** Animated bar that fills left→right on scroll into view */
export function AnimatedBar({
  value,
  color = "var(--accent)",
  height = 6,
  delay = 0,
}: {
  value: number;
  color?: string;
  height?: number;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <div
      className="w-full overflow-hidden rounded-full"
      ref={ref}
      style={{ height, background: "var(--surface-3)" }}
    >
      <motion.div
        animate={inView ? { width: `${value}%` } : { width: 0 }}
        initial={{ width: 0 }}
        style={{ height: "100%", background: color, borderRadius: 9999 }}
        transition={{
          duration: 0.9,
          ease: [0.25, 0, 0, 1],
          delay,
        }}
      />
    </div>
  );
}
