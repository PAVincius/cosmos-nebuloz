"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Bot, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import { syncTenantKnowledge } from "@/app/actions/safe-copilot/indexer";
import type { SessionPreview } from "@/app/actions/safe-copilot/sessions";
import {
  createCopilotSession,
  listCopilotSessions,
  loadCopilotSession,
} from "@/app/actions/safe-copilot/sessions";
import { CopilotChat } from "../../components/copilot/copilot-chat";
import { CopilotInputArea } from "../../components/copilot/copilot-input-area";
import { CopilotPromptChips } from "../../components/copilot/copilot-prompt-chips";
import type { CopilotMode } from "../../components/copilot/copilot-provider";
import { useCopilotChat } from "../../components/copilot/use-copilot-chat";
import { SessionSidebar } from "./session-sidebar";

function runSync(): Promise<{ total: number }> {
  return syncTenantKnowledge();
}

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
  const [syncState, setSyncState] = useState<
    "idle" | "syncing" | "done" | "error"
  >("idle");
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const { messages, setMessages, handleSubmitText, isLoading, stop, reset } =
    useCopilotChat({
      api: "/api/copilot/chat",
      body: {
        mode,
        surface: "global",
        contextRef: {},
        sessionId: activeSessionId,
      },
    });

  const handleChipSelect = useCallback(
    (prompt: string) => {
      handleSubmitText(prompt);
    },
    [handleSubmitText]
  );

  const handleSync = useCallback(async () => {
    setSyncState("syncing");
    setSyncResult(null);
    try {
      const result = await runSync();
      setSyncState("done");
      setSyncResult(`${result.total} itens indexados`);
      setTimeout(() => {
        setSyncState("idle");
        setSyncResult(null);
      }, 4000);
    } catch {
      setSyncState("error");
      setSyncResult("Erro ao sincronizar");
      setTimeout(() => {
        setSyncState("idle");
        setSyncResult(null);
      }, 3000);
    }
  }, []);

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
    async (id: string) => {
      if (id === activeSessionId) {
        return;
      }
      reset();
      setActiveSessionId(id);
      const stored = await loadCopilotSession(id);
      if (stored.length > 0) {
        setMessages(stored);
      }
    },
    [activeSessionId, reset, setMessages]
  );

  return (
    <div className="flex h-full overflow-hidden">
      <SessionSidebar
        activeSessionId={activeSessionId}
        isCreating={isCreating}
        onNew={handleNewSession}
        onSelect={handleSelectSession}
        onSessionsChange={setSessions}
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

          <div className="flex items-center gap-2">
            <Button
              className="h-8 gap-1.5 px-3 text-xs"
              disabled={syncState === "syncing"}
              onClick={handleSync}
              size="sm"
              title="Sincronizar base de conhecimento para busca semântica"
              variant="outline"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${syncState === "syncing" ? "animate-spin" : ""}`}
              />
              {syncResult ??
                (syncState === "syncing" ? "Sincronizando..." : "Sync KB")}
            </Button>
          </div>
        </div>

        {/* Chat area */}
        <CopilotChat
          isLoading={isLoading}
          messages={messages}
          sessionId={activeSessionId}
        />

        {messages.length === 0 ? (
          <>
            <Separator className="opacity-30" />
            <CopilotPromptChips
              disabled={isLoading}
              mode={mode}
              onSelect={handleChipSelect}
            />
          </>
        ) : null}

        <CopilotInputArea
          activeSessionId={activeSessionId}
          isLoading={isLoading}
          mode={mode}
          onModeChange={setMode}
          onStop={stop}
          onSubmitText={handleSubmitText}
        />
      </div>
    </div>
  );
}
