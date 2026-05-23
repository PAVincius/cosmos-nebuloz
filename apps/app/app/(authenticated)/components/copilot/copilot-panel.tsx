"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SendHorizonal } from "lucide-react";
import { useEffect, useRef } from "react";
import { CopilotChat } from "./copilot-chat";
import { CopilotHeader } from "./copilot-header";
import { CopilotPromptChips } from "./copilot-prompt-chips";
import { useCopilot } from "./copilot-provider";
import { useCopilotChat } from "./use-copilot-chat";

const panelVariants = {
  hidden: { opacity: 0, scale: 0.88, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.88, y: 8 },
};

export function CopilotPanel() {
  const { isOpen, config, closeCopilot } = useCopilot();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const shouldReduce = useReducedMotion();

  const {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading,
  } = useCopilotChat({
    api: "/api/copilot/chat",
    body: {
      mode: config.mode,
      surface: config.surface,
      contextRef: config.contextRef,
      sessionId: config.sessionId,
    },
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closeCopilot();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, closeCopilot]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        handleSubmit(e as unknown as React.FormEvent);
      }
    }
  };

  const handleChipSelect = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  const transition = shouldReduce
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.25, 0, 0, 1] as const };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          animate="visible"
          className="fixed right-6 bottom-6 z-50 flex w-[380px] flex-col overflow-hidden rounded-[24px] border border-black/[0.08] bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)_inset,_0_24px_80px_rgba(0,0,0,0.15)] dark:border-white/[0.08] dark:bg-zinc-950 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,_0_24px_80px_rgba(0,0,0,0.50)]"
          exit="exit"
          initial="hidden"
          key="copilot-panel"
          style={{ transformOrigin: "bottom right", height: "540px" }}
          transition={transition}
          variants={panelVariants}
        >
          <CopilotHeader
            mode={config.mode}
            onClose={closeCopilot}
            surface={config.surface}
          />

          <CopilotChat
            isLoading={isLoading}
            messages={messages}
            sessionId={config.sessionId}
          />

          <Separator className="opacity-30" />

          {messages.length === 0 ? (
            <CopilotPromptChips
              disabled={isLoading}
              mode={config.mode}
              onSelect={handleChipSelect}
            />
          ) : null}

          <form
            className="flex items-end gap-2 border-black/[0.06] border-t bg-white p-3 dark:border-white/[0.06] dark:bg-zinc-950"
            onSubmit={handleSubmit}
          >
            <Textarea
              className="max-h-32 min-h-[44px] resize-none border-black/[0.08] bg-gray-50/80 text-sm placeholder:text-gray-400 focus-visible:ring-violet-500/30 dark:border-white/[0.08] dark:bg-zinc-900/50 dark:placeholder:text-zinc-500"
              disabled={isLoading}
              onChange={handleInputChange}
              onKeyDown={onKeyDown}
              placeholder="Perguntar ao Copilot... (Enter para enviar)"
              ref={textareaRef}
              rows={1}
              value={input}
            />
            <Button
              className="h-[44px] w-[44px] shrink-0 bg-violet-600 hover:bg-violet-500"
              disabled={isLoading || !input.trim()}
              size="icon"
              type="submit"
            >
              <SendHorizonal className="h-4 w-4" />
            </Button>
          </form>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
