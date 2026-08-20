"use client";
import { motion, useScroll } from "framer-motion";

// Matches the design source's `.progress`: a 1px hairline of palette light,
// tracking raw scroll position. No spring — the lag reads as the bar falling
// behind the scrollbar.
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();

  return (
    <motion.div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        background: "linear-gradient(90deg, var(--c-violet), var(--c-cyan))",
        transformOrigin: "0%",
        scaleX: scrollYProgress,
        zIndex: 200,
      }}
    />
  );
}
