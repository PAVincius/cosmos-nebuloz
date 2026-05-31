"use client";

import { useOthers } from "@repo/collaboration/hooks";
import { AnimatePresence, motion } from "framer-motion";

export function MultiplayerCursors() {
  const others = useOthers();

  return (
    <AnimatePresence>
      {others.map(({ connectionId, presence, info }) => {
        if (!presence.cursor) {
          return null;
        }

        const color = info?.color ?? "var(--color-primary)";

        return (
          <motion.div
            animate={{ opacity: 1 }}
            className="pointer-events-none fixed z-50 flex items-center gap-1"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key={connectionId}
            style={{
              transform: `translate(${presence.cursor.x}px, ${presence.cursor.y}px)`,
            }}
            transition={{ duration: 0.1 }}
          >
            <svg
              aria-hidden="true"
              fill="none"
              height="14"
              viewBox="0 0 14 14"
              width="14"
            >
              <path d="M0 0L9 5.5L5.5 6.5L3.5 11L0 0Z" fill={color} />
            </svg>
            {!!info?.name && (
              <span
                className="rounded-sm px-1.5 py-0.5 font-medium text-[10px] text-white"
                style={{ backgroundColor: color }}
              >
                {info.name}
              </span>
            )}
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
}
