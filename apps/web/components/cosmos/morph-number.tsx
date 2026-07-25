"use client";
import { useInView, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useRef } from "react";

type MorphNumberProps = {
  from?: number;
  to?: number;
  className?: string;
  style?: React.CSSProperties;
};

export function MorphNumber({
  from = 21,
  to = 2,
  className = "",
  style,
}: MorphNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  const mv = useMotionValue(from);
  const spring = useSpring(mv, { stiffness: 40, damping: 15, restDelta: 0.1 });

  useEffect(() => {
    if (inView) {
      mv.set(to);
    }
  }, [inView, mv, to]);

  useEffect(() => {
    return spring.on("change", (v) => {
      const rounded = Math.round(v);
      if (spanRef.current) {
        spanRef.current.textContent = String(rounded);
        // Interpolate warning (#f5b942) → success (#29cc7a)
        const t = Math.max(0, Math.min(1, 1 - (v - to) / (from - to)));
        const r = Math.round(245 + (41 - 245) * t);
        const g = Math.round(185 + (204 - 185) * t);
        const b = Math.round(66 + (122 - 66) * t);
        spanRef.current.style.color = `rgb(${r},${g},${b})`;
      }
    });
  }, [spring, from, to]);

  return (
    <span className={className} ref={ref} style={style}>
      <span ref={spanRef} style={{ color: "var(--warning)" }}>
        {from}
      </span>
    </span>
  );
}
