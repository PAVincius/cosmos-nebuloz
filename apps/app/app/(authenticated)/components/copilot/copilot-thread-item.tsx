"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { UserIcon } from "./copilot-icons";
import { CopilotMarkdown } from "./copilot-markdown";
import { CopilotReport, parseReports, stripReportTags } from "./copilot-report";
import { CopilotStepsTimeline } from "./copilot-steps-timeline";
import { CopilotSuggestions, parseSuggestions } from "./copilot-suggestions";
import type { ChatMessage } from "./copilot-types";

type Props = {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage | null;
  isStreaming: boolean;
  sessionId?: string;
};

function getDisplayContent(content: string): string {
  // strip complete tags, then any incomplete tag at end of stream
  return stripReportTags(
    content
      .replace(/<suggestion[\s\S]*?<\/suggestion>/g, "")
      .replace(/<suggestion[\s\S]*/g, "")
  )
    .replace(/<report[\s\S]*/g, "")
    .trim();
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      aria-label="Copiar resposta"
      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/40 transition-all hover:bg-muted hover:text-muted-foreground"
      onClick={handleCopy}
      type="button"
    >
      {copied ? (
        <CheckIcon className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <CopyIcon className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

export function CopilotThreadItem({
  userMessage,
  assistantMessage,
  isStreaming,
  sessionId,
}: Props) {
  const invocations = assistantMessage?.toolInvocations ?? [];

  // Hide output-only tools from the steps timeline
  const timelineInvocations = invocations.filter(
    (inv) =>
      inv.toolName !== "submitSuggestion" && inv.toolName !== "submitReport"
  );

  // Structured channel (new): suggestions/reports from tool invocations
  const toolSuggestions = invocations
    .filter(
      (inv) => inv.toolName === "submitSuggestion" && inv.state === "result"
    )
    .map((inv) => ({
      type: inv.args.type as string,
      payload: inv.args.payload,
    }));

  const toolReports = invocations
    .filter((inv) => inv.toolName === "submitReport" && inv.state === "result")
    .map((inv) => ({
      title: inv.args.title as string,
      columns: inv.args.columns as string[],
      rows: inv.args.rows as (string | number | null)[][],
    }));

  // Backward compat: also parse XML tags from stored messages
  const allSuggestions = [
    ...parseSuggestions(assistantMessage?.content ?? ""),
    ...toolSuggestions,
  ];
  const allReports = [
    ...parseReports(assistantMessage?.content ?? ""),
    ...toolReports,
  ];

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
        {isStreaming && !assistantMessage && <ThinkingBubble key="thinking" />}
      </AnimatePresence>

      {/* Assistant response */}
      {!!assistantMessage && (
        <motion.div
          animate={{ opacity: 1 }}
          className="space-y-2"
          initial={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {(getDisplayContent(assistantMessage.content) || isStreaming) && (
            <div className="group relative">
              <CopilotMarkdown
                content={getDisplayContent(assistantMessage.content)}
                isStreaming={isStreaming}
              />
              {!isStreaming && getDisplayContent(assistantMessage.content) && (
                <div className="absolute top-0 right-0 opacity-0 transition-opacity group-hover:opacity-100">
                  <CopyButton
                    text={getDisplayContent(assistantMessage.content)}
                  />
                </div>
              )}
            </div>
          )}

          {timelineInvocations.length > 0 && (
            <CopilotStepsTimeline invocations={timelineInvocations} />
          )}

          {!isStreaming && assistantMessage.content && (
            <>
              {allReports.map((report) => (
                <CopilotReport key={report.title} report={report} />
              ))}
              {!!sessionId && allSuggestions.length > 0 && (
                <CopilotSuggestions
                  sessionId={sessionId}
                  suggestions={allSuggestions}
                />
              )}
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
