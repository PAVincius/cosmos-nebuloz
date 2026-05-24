"use client";

import { motion } from "framer-motion";
import { BookOpen, User } from "lucide-react";
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
      initial={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2 }}
    >
      <div className="mb-4 flex justify-end">
        <div className="flex max-w-[80%] items-start gap-2">
          <div className="rounded-2xl bg-violet-600 px-4 py-2.5 text-sm text-white leading-relaxed">
            {userMessage.content}
          </div>
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white">
            <User className="h-4 w-4" />
          </div>
        </div>
      </div>

      {!!assistantMessage && (
        <div className="space-y-2">
          {(assistantMessage.toolInvocations?.length ?? 0) > 0 && (
            <CopilotStepsTimeline
              invocations={assistantMessage.toolInvocations ?? []}
            />
          )}

          {(getDisplayContent(assistantMessage.content) || isStreaming) && (
            <div>
              {(assistantMessage.toolInvocations?.length ?? 0) > 0 && (
                <div className="mb-2 flex items-center gap-1.5 text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5" />
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
        </div>
      )}
    </motion.div>
  );
}
