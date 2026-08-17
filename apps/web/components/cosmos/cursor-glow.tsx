"use client";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect } from "react";

export function CursorGlow() {
  const rawX = useMotionValue(-500);
  const rawY = useMotionValue(-500);

  // Large glow — slow trail
  const glowX = useSpring(rawX, { stiffness: 120, damping: 28, mass: 0.6 });
  const glowY = useSpring(rawY, { stiffness: 120, damping: 28, mass: 0.6 });

  // Small dot — faster
  const dotX = useSpring(rawX, { stiffness: 500, damping: 42 });
  const dotY = useSpring(rawY, { stiffness: 500, damping: 42 });

  useEffect(() => {
    const move = (e: MouseEvent) => {
      rawX.set(e.clientX);
      rawY.set(e.clientY);
    };
    window.addEventListener("mousemove", move, { passive: true });
    return () => window.removeEventListener("mousemove", move);
  }, [rawX, rawY]);

  return (
    <>
      {/* Large ambient glow */}
      <motion.div
        className="pointer-events-none fixed hidden md:block"
        style={{
          x: glowX,
          y: glowY,
          translateX: "-50%",
          translateY: "-50%",
          zIndex: 9998,
          width: 480,
          height: 480,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(92,180,228,0.07) 0%, transparent 70%)",
          mixBlendMode: "screen",
        }}
      />
      {/* Small precise dot */}
      <motion.div
        className="pointer-events-none fixed hidden md:block"
        style={{
          x: dotX,
          y: dotY,
          translateX: "-50%",
          translateY: "-50%",
          zIndex: 9999,
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "rgba(92,180,228,0.9)",
          boxShadow: "0 0 8px rgba(92,180,228,0.8)",
          mixBlendMode: "screen",
        }}
      />
    </>
  );
}
