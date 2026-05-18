"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { type ReactNode, useRef } from "react";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  maxTilt?: number;
  glowColor?: string;
}

export function TiltCard({
  children,
  className = "",
  style,
  maxTilt = 6,
  glowColor = "rgba(0, 212, 255, 0.15)",
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rawGlowX = useMotionValue(50);
  const rawGlowY = useMotionValue(50);

  const x = useSpring(rawX, { stiffness: 300, damping: 30 });
  const y = useSpring(rawY, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(y, [-1, 1], [maxTilt, -maxTilt]);
  const rotateY = useTransform(x, [-1, 1], [-maxTilt, maxTilt]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    rawX.set(nx * 2 - 1);
    rawY.set(ny * 2 - 1);
    rawGlowX.set(nx * 100);
    rawGlowY.set(ny * 100);
  };

  const handleMouseLeave = () => {
    rawX.set(0);
    rawY.set(0);
    rawGlowX.set(50);
    rawGlowY.set(50);
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        ...style,
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        transformPerspective: 800,
        position: "relative",
        cursor: "default",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: 1.01 }}
      transition={{ scale: { duration: 0.2 } }}
    >
      {/* Dynamic glow that follows cursor */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-[inherit] z-0"
        style={{
          background: `radial-gradient(circle at ${rawGlowX.get()}% ${rawGlowY.get()}%, ${glowColor}, transparent 55%)`,
          opacity: 0,
        }}
        whileHover={{ opacity: 1 }}
        transition={{ opacity: { duration: 0.2 } }}
      />
      <div className="relative z-10" style={{ transform: "translateZ(20px)" }}>
        <>{children}</>
      </div>
    </motion.div>
  );
}
