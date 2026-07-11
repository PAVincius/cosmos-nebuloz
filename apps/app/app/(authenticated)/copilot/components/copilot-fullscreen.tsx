"use client";

import { Badge } from "@repo/design-system/components/cosmos/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Bot, Calendar, Gauge, RefreshCw, RotateCw, ShieldAlert } from "lucide-react";
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
import { PageHeader } from "../../components/page-header";
import { RelationChip } from "../../components/relation-chip";
import { CopilotSideDrawer } from "./copilot-side-drawer";
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

  const handleSessionDeleted = useCallback(
    (id: string) => {
      if (id === activeSessionId) {
        handleNewSession();
      }
    },
    [activeSessionId, handleNewSession]
  );

  return (
    <div className="flex h-full overflow-hidden">
      <SessionSidebar
        activeSessionId={activeSessionId}
        isCreating={isCreating}
        onNew={handleNewSession}
        onSelect={handleSelectSession}
        onSessionDeleted={handleSessionDeleted}
        onSessionsChange={setSessions}
        sessions={sessions}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Main column: header + chat + input */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <PageHeader
            actions={
              <>
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
                <Button
                  className="h-8 gap-1.5 px-3 text-xs"
                  disabled={isCreating}
                  onClick={handleNewSession}
                  size="sm"
                  variant="secondary"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Nova conversa
                </Button>
              </>
            }
            badge={
              <>
                <Badge tone="accent">
                  <Bot aria-hidden className="h-3 w-3" />
                  Modelo ORBIT
                </Badge>
                <Badge dot tone="green">
                  Conectado aos 16 módulos
                </Badge>
                <RelationChip
                  eyebrow="Priorização"
                  href="/portfolio"
                  icon={<Gauge />}
                  label="Portfolio"
                  tone="accent"
                />
                <RelationChip
                  eyebrow="Planejamento"
                  href="/pi-planning"
                  icon={<Calendar />}
                  label="PI Planning"
                  tone="blue"
                />
                <RelationChip
                  eyebrow="Governança"
                  href="/risks"
                  icon={<ShieldAlert />}
                  label="Riscos"
                  tone="red"
                />
              </>
            }
            subtitle="Seu copiloto de portfólio. Pergunte sobre saúde, riscos, custos e priorização — respostas fundamentadas nos dados do COSMOS."
            title="Copilot"
          />

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

        {/* Side drawer */}
        <CopilotSideDrawer />
      </div>
    </div>
  );
}
