"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useCopilotDrawer } from "../../components/copilot/use-copilot-drawer";

export function CopilotSideDrawer() {
  const { open, title, renderContent, closeDrawer } = useCopilotDrawer();

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          animate={{ x: 0, opacity: 1 }}
          className="flex w-[420px] shrink-0 flex-col overflow-hidden border-hairline border-l bg-surface"
          exit={{ x: 40, opacity: 0 }}
          initial={{ x: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="flex shrink-0 items-center justify-between border-hairline border-b px-4 py-3">
            <span className="font-semibold text-ink text-sm">{title}</span>
            <button
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={closeDrawer}
              title="Fechar"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 [scrollbar-width:thin]">
            {renderContent?.()}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
