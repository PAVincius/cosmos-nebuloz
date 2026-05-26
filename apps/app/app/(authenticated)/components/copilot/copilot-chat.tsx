"use client";

import { AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";
import { BotIcon } from "./copilot-icons";
import { CopilotThreadItem } from "./copilot-thread-item";
import type { ChatMessage } from "./copilot-types";

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-2xl"
        style={{
          background: "linear-gradient(135deg, #7c6cff 0%, #00D4FF 100%)",
        }}
      >
        <BotIcon className="h-5 w-5 text-white" />
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-foreground text-sm">SAFe AI Copilot</p>
        <p className="max-w-[220px] text-muted-foreground text-xs leading-relaxed">
          Faça uma pergunta ou use os atalhos abaixo para começar.
        </p>
      </div>
    </div>
  );
}

type MessagePair = {
  user: ChatMessage;
  assistant: ChatMessage | null;
};

function buildPairs(messages: ChatMessage[]): MessagePair[] {
  const pairs: MessagePair[] = [];
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];
    if (msg.role === "user") {
      const next = messages[i + 1];
      pairs.push({
        user: msg,
        assistant: next?.role === "assistant" ? next : null,
      });
      i += next?.role === "assistant" ? 2 : 1;
    } else {
      i += 1;
    }
  }
  return pairs;
}

type CopilotChatProps = {
  messages: ChatMessage[];
  isLoading: boolean;
  sessionId?: string;
};

export function CopilotChat({
  messages,
  isLoading,
  sessionId,
}: CopilotChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isStuckRef = useRef(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      isStuckRef.current = distFromBottom < 60;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (isStuckRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  });

  const pairs = buildPairs(messages);
  const lastPairIdx = pairs.length - 1;

  if (messages.length === 0 && !isLoading) {
    return <EmptyState />;
  }

  return (
    <div
      className="flex-1 overflow-y-auto [scrollbar-color:rgba(0,0,0,0.1)_transparent] [scrollbar-width:thin] dark:[scrollbar-color:rgba(255,255,255,0.08)_transparent]"
      ref={containerRef}
    >
      <div className="mx-auto max-w-2xl px-4 py-6 pb-4">
        <AnimatePresence initial={false}>
          {pairs.map((pair, idx) => (
            <CopilotThreadItem
              assistantMessage={pair.assistant}
              isStreaming={isLoading ? idx === lastPairIdx : false}
              key={pair.user.id}
              sessionId={sessionId}
              userMessage={pair.user}
            />
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
