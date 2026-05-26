"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BotIcon } from "./copilot-icons";
import { useCopilot } from "./copilot-provider";

export function CopilotFab() {
  const { isOpen, openCopilot } = useCopilot();

  return (
    <AnimatePresence>
      {!isOpen && (
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          className="fixed right-6 bottom-6 z-[49]"
          exit={{ opacity: 0, scale: 0.8 }}
          initial={{ opacity: 0, scale: 0.8 }}
          key="copilot-fab"
          transition={{ duration: 0.2, ease: [0.25, 0, 0, 1] }}
        >
          {/* Pulse ring — sits behind the button */}
          <motion.div
            animate={{ scale: [1, 1.55], opacity: [0.35, 0] }}
            className="absolute inset-0 rounded-full bg-violet-600"
            transition={{
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeOut",
            }}
          />
          {/* Main button */}
          <button
            aria-label="Abrir Copilot AI"
            className="relative flex h-[52px] w-[52px] items-center justify-center rounded-full text-white shadow-[0_4px_24px_rgba(0,0,0,0.35)] transition-transform hover:scale-105 active:scale-95"
            onClick={() => openCopilot({})}
            style={{
              background: "linear-gradient(135deg, #7c6cff 0%, #00D4FF 100%)",
            }}
            type="button"
          >
            <BotIcon className="h-5 w-5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
