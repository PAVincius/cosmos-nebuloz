"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpenIcon, UserIcon } from "./copilot-icons";
import { CopilotMarkdown } from "./copilot-markdown";
import { CopilotReport, parseReports, stripReportTags } from "./copilot-report";
import { CopilotStepsTimeline } from "./copilot-steps-timeline";
import { CopilotSuggestions } from "./copilot-suggestions";
import type { ChatMessage } from "./copilot-types";

type Props = {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage | null;
  isStreaming: boolean;
  sessionId?: string;
};

function getDisplayContent(content: string): string {
  return stripReportTags(
    content.replace(/<suggestion[\s\S]*?<\/suggestion>/g, "")
  ).trim();
}

/** Gradient-pulse thinking bubble shown before first assistant token. */
function ThinkingBubble() {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.96 }}
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        className="relative inline-flex items-center gap-1.5 overflow-hidden rounded-2xl border px-4 py-3"
        style={{
          borderColor: "rgba(124, 108, 255, 0.2)",
          background:
            "linear-gradient(135deg, rgba(124,108,255,0.07) 0%, rgba(0,212,255,0.05) 100%)",
        }}
      >
        {/* shimmer sweep */}
        <motion.div
          animate={{ x: ["-100%", "200%"] }}
          className="pointer-events-none absolute inset-0"
          transition={{
            duration: 1.8,
            ease: "linear",
            repeat: Number.POSITIVE_INFINITY,
            repeatDelay: 0.5,
          }}
        >
          <div
            className="h-full w-full"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(124,108,255,0.24) 50%, rgba(0,212,255,0.16) 65%, transparent 100%)",
            }}
          />
        </motion.div>

        {/* bouncing dots */}
        {[0, 1, 2].map((i) => (
          <motion.span
            animate={{
              opacity: [0.35, 1, 0.35],
              scale: [1, 1.3, 1],
              y: [0, -3, 0],
            }}
            className="relative h-1.5 w-1.5 rounded-full bg-violet-400 dark:bg-violet-500"
            key={i}
            transition={{
              delay: i * 0.17,
              duration: 1.1,
              ease: "easeInOut",
              repeat: Number.POSITIVE_INFINITY,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

export function CopilotThreadItem({
  userMessage,
  assistantMessage,
  isStreaming,
  sessionId,
}: Props) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
      initial={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* User bubble */}
      <div className="mb-4 flex justify-end">
        <div className="flex max-w-[80%] items-start gap-2">
          <div className="rounded-2xl bg-violet-600 px-4 py-2.5 text-sm text-white leading-relaxed">
            {userMessage.content}
          </div>
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white">
            <UserIcon className="h-3 w-3" />
          </div>
        </div>
      </div>

      {/* Thinking bubble — shown while waiting for first token */}
      <AnimatePresence>
        {isStreaming && !assistantMessage && (
          <ThinkingBubble key="thinking" />
        )}
      </AnimatePresence>

      {/* Assistant response */}
      {!!assistantMessage && (
        <motion.div
          animate={{ opacity: 1 }}
          className="space-y-2"
          initial={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {(assistantMessage.toolInvocations?.length ?? 0) > 0 && (
            <CopilotStepsTimeline
              invocations={assistantMessage.toolInvocations ?? []}
            />
          )}

          {(getDisplayContent(assistantMessage.content) || isStreaming) && (
            <div>
              {(assistantMessage.toolInvocations?.length ?? 0) > 0 && (
                <div className="mb-2 flex items-center gap-1.5 text-muted-foreground">
                  <BookOpenIcon className="h-3 w-3" />
                  <span className="font-medium text-xs">Resposta</span>
                </div>
              )}
              <CopilotMarkdown
                content={getDisplayContent(assistantMessage.content)}
                isStreaming={isStreaming}
              />
            </div>
          )}

          {!isStreaming && assistantMessage.content && (
            <>
              {parseReports(assistantMessage.content).map((report) => (
                <CopilotReport key={report.title} report={report} />
              ))}
              {!!sessionId && (
                <CopilotSuggestions
                  content={assistantMessage.content}
                  sessionId={sessionId}
                />
              )}
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
