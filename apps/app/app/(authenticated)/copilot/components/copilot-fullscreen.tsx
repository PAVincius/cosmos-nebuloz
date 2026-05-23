"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { Bot, SendHorizonal, Sparkles } from "lucide-react";
import { useCallback, useRef, useState, useTransition } from "react";
import type { SessionPreview } from "@/app/actions/safe-copilot/sessions";
import {
  createCopilotSession,
  listCopilotSessions,
} from "@/app/actions/safe-copilot/sessions";
import { CopilotChat } from "../../components/copilot/copilot-chat";
import { CopilotPromptChips } from "../../components/copilot/copilot-prompt-chips";
import type { CopilotMode } from "../../components/copilot/copilot-provider";
import { useCopilotChat } from "../../components/copilot/use-copilot-chat";
import { SessionSidebar } from "./session-sidebar";

const MODE_LABELS: Record<CopilotMode, string> = {
  rte: "RTE Copilot",
  lpm: "LPM Copilot",
  pm: "PM/PO Copilot",
  team: "Team Copilot",
  spc: "SPC Copilot",
  global: "Cosmos Copilot",
};

type CopilotFullscreenProps = {
  initialSessions: SessionPreview[];
  initialSessionId: string;
};

export function CopilotFullscreen({
  initialSessions,
  initialSessionId,
}: CopilotFullscreenProps) {
  const [sessions, setSessions] = useState<SessionPreview[]>(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState(initialSessionId);
  const [mode, setMode] = useState<CopilotMode>("global");
  const [isCreating, startCreating] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading,
    reset,
  } = useCopilotChat({
    api: "/api/copilot/chat",
    body: {
      mode,
      surface: "global",
      contextRef: {},
      sessionId: activeSessionId,
    },
  });

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

  const handleNewSession = useCallback(() => {
    startCreating(async () => {
      const session = await createCopilotSession("global", mode);
      const refreshed = await listCopilotSessions();
      setSessions(refreshed);
      setActiveSessionId(session.id);
      reset();
    });
  }, [mode, reset]);

  const handleSelectSession = useCallback(
    (id: string) => {
      if (id === activeSessionId) {
        return;
      }
      setActiveSessionId(id);
      reset();
    },
    [activeSessionId, reset]
  );

  return (
    <div className="flex h-full overflow-hidden">
      <SessionSidebar
        activeSessionId={activeSessionId}
        isCreating={isCreating}
        onNew={handleNewSession}
        onSelect={handleSelectSession}
        sessions={sessions}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between border-black/[0.06] border-b px-6 py-3 dark:border-white/[0.06]"
          style={{
            background:
              "linear-gradient(135deg, rgba(124,108,255,0.08) 0%, rgba(0,212,255,0.04) 100%)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{
                background: "linear-gradient(135deg, #7c6cff 0%, #00D4FF 100%)",
              }}
            >
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 text-sm dark:text-white">
                  Cosmos Copilot
                </span>
                <span className="flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 font-semibold text-[10px] text-cyan-500 uppercase tracking-wider dark:text-cyan-400">
                  <Sparkles className="h-2.5 w-2.5" />
                  AI
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-zinc-500">
                Chat inteligente com os dados da sua organização
              </p>
            </div>
          </div>

          <Select onValueChange={(v) => setMode(v as CopilotMode)} value={mode}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(MODE_LABELS) as [CopilotMode, string][]).map(
                ([key, label]) => (
                  <SelectItem className="text-xs" key={key} value={key}>
                    {label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Chat area */}
        <CopilotChat
          isLoading={isLoading}
          messages={messages}
          sessionId={activeSessionId}
        />

        <Separator className="opacity-30" />

        {messages.length === 0 ? (
          <CopilotPromptChips
            disabled={isLoading}
            mode={mode}
            onSelect={handleChipSelect}
          />
        ) : null}

        {/* Input */}
        <form
          className="flex items-end gap-3 border-black/[0.06] border-t bg-white p-4 dark:border-white/[0.06] dark:bg-zinc-950"
          onSubmit={handleSubmit}
        >
          <Textarea
            className="max-h-40 min-h-[52px] flex-1 resize-none border-black/[0.08] bg-gray-50/80 text-sm placeholder:text-gray-400 focus-visible:ring-violet-500/30 dark:border-white/[0.08] dark:bg-zinc-900/50 dark:placeholder:text-zinc-500"
            disabled={isLoading}
            onChange={handleInputChange}
            onKeyDown={onKeyDown}
            placeholder="Pergunte qualquer coisa sobre seus dados... (Enter para enviar, Shift+Enter para nova linha)"
            ref={textareaRef}
            rows={2}
            value={input}
          />
          <Button
            className="h-[52px] w-[52px] shrink-0 bg-violet-600 hover:bg-violet-500"
            disabled={isLoading || !input.trim()}
            size="icon"
            type="submit"
          >
            <SendHorizonal className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
