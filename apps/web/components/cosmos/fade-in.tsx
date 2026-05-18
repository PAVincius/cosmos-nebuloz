"use client";

import { motion, type Variants } from "framer-motion";
import { type ReactNode } from "react";

const REVEAL: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0, 0, 0.2, 1] },
  },
};

const STAGGER: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

interface FadeInProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

/** Single element fade-in on scroll */
export function FadeIn({ children, className = "", delay = 0 }: FadeInProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={{
        hidden: REVEAL.hidden,
        visible: {
          ...REVEAL.visible,
          transition: { duration: 0.6, ease: [0, 0, 0.2, 1], delay },
        },
      }}
    >
      <>{children}</>
    </motion.div>
  );
}

/** Stagger container — children should use <FadeInChild> */
export function FadeInGroup({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={STAGGER}
    >
      <>{children}</>
    </motion.div>
  );
}

/** Individual child inside a <FadeInGroup> */
export function FadeInChild({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={REVEAL}>
      <>{children}</>
    </motion.div>
  );
}
