"use client";

import { motion } from "framer-motion";

type Props = { count: number; limit: number };

export function WipLimitWarning({ count, limit }: Props) {
  if (count <= limit) {
    return null;
  }
  return (
    <motion.span
      animate={{ scale: [1, 1.06, 1] }}
      className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 font-semibold text-[10px] text-red-700 dark:bg-red-950 dark:text-red-400"
      initial={{ scale: 1 }}
      transition={{
        duration: 1.4,
        ease: "easeInOut",
        repeat: Number.POSITIVE_INFINITY,
        repeatDelay: 2.5,
      }}
    >
      <span>⚠ WIP</span>
      <span>
        {count}/{limit}
      </span>
    </motion.span>
  );
}
