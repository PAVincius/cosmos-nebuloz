"use client";

import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

type SplitTextProps = {
  children: string;
  className?: string;
  /** Applied to each individual word/char span (for gradient text etc.) */
  childClassName?: string;
  style?: CSSProperties;
  /** Delay before first word, in seconds */
  delay?: number;
  /** Stagger between words, in seconds */
  stagger?: number;
  /** "words" or "chars" */
  by?: "words" | "chars";
  /** Use blur + y reveal (premium) or just y reveal */
  blur?: boolean;
};

const WORD_VARIANTS = (blur: boolean) => ({
  hidden: {
    opacity: 0,
    y: 18,
    filter: blur ? "blur(8px)" : "none",
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.45,
      ease: [0.25, 0, 0, 1] as [number, number, number, number],
    },
  },
});

export function SplitText({
  children,
  className = "",
  childClassName = "",
  style,
  delay = 0,
  stagger = 0.06,
  by = "words",
  blur = true,
}: SplitTextProps) {
  const units = by === "words" ? children.split(" ") : children.split("");

  return (
    <motion.span
      animate="visible"
      className={`inline ${className}`}
      initial="hidden"
      style={style}
      variants={{
        visible: {
          transition: {
            delayChildren: delay,
            staggerChildren: stagger,
          },
        },
      }}
    >
      {units.map((unit, i) => (
        <motion.span
          className={`inline-block ${childClassName}`}
          key={i}
          style={{ marginRight: by === "words" ? "0.25em" : 0 }}
          variants={WORD_VARIANTS(blur)}
        >
          {unit}
        </motion.span>
      ))}
    </motion.span>
  );
}

/** Reveal block — wraps any children with a staggered upward reveal */
export function RevealBlock({
  children,
  delay = 0,
  className = "",
  style,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      className={className}
      initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
      style={style}
      transition={{
        duration: 0.5,
        ease: [0.25, 0, 0, 1] as [number, number, number, number],
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}
