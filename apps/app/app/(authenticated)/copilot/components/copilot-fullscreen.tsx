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
import {
  Bot,
  Paperclip,
  RefreshCw,
  SendHorizonal,
  Sparkles,
  Square,
} from "lucide-react";
import { useCallback, useRef, useState, useTransition } from "react";
import { syncTenantKnowledge } from "@/app/actions/safe-copilot/indexer";
import type { SessionPreview } from "@/app/actions/safe-copilot/sessions";
import {
  createCopilotSession,
  listCopilotSessions,
  loadCopilotSession,
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

type UploadState = "idle" | "uploading" | "done" | "error";

function uploadStatusClass(state: UploadState): string {
  if (state === "error") {
    return "text-red-500";
  }
  if (state === "done") {
    return "text-green-600 dark:text-green-400";
  }
  return "text-gray-500 dark:text-zinc-400";
}

function uploadIcon(state: UploadState): string {
  if (state === "uploading") {
    return "⏳ ";
  }
  if (state === "done") {
    return "✓ ";
  }
  return "✗ ";
}

async function uploadFileToSession(
  file: File,
  sessionId: string
): Promise<{ chunks: number }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("sessionId", sessionId);
  const res = await fetch("/api/copilot/upload", { method: "POST", body: fd });
  const json = (await res.json()) as {
    ok?: boolean;
    chunks?: number;
    error?: string;
  };
  if (!(res.ok && json.ok)) {
    throw new Error(json.error ?? "Upload falhou");
  }
  return { chunks: json.chunks ?? 0 };
}

function runSync(): Promise<{ total: number }> {
  return syncTenantKnowledge();
}

function makeKeyDownHandler(
  isLoading: boolean,
  handleSubmitText: (text: string) => void,
  input: string
) {
  return (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        handleSubmitText(input);
      }
    }
  };
}

function UploadStatusLine({
  state,
  label,
}: {
  state: UploadState;
  label: string;
}) {
  return (
    <p className={`text-[11px] ${uploadStatusClass(state)}`}>
      {uploadIcon(state)}
      {label}
    </p>
  );
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
  const [uploadState, setUploadState] = useState<
    "idle" | "uploading" | "done" | "error"
  >("idle");
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    setMessages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    handleSubmitText,
    isLoading,
    stop,
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

  const onKeyDown = makeKeyDownHandler(isLoading, handleSubmitText, input);

  const handleChipSelect = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

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

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) {
        return;
      }
      e.target.value = "";
      setUploadState("uploading");
      setUploadLabel(`Indexando ${file.name}…`);
      try {
        const { chunks } = await uploadFileToSession(file, activeSessionId);
        setUploadState("done");
        setUploadLabel(`${file.name} (${chunks} chunks)`);
        setTimeout(() => {
          setUploadState("idle");
          setUploadLabel(null);
        }, 4000);
      } catch (err: unknown) {
        setUploadState("error");
        setUploadLabel(err instanceof Error ? err.message : "Erro no upload");
        setTimeout(() => {
          setUploadState("idle");
          setUploadLabel(null);
        }, 4000);
      }
    },
    [activeSessionId]
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

            <Select
              onValueChange={(v) => setMode(v as CopilotMode)}
              value={mode}
            >
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
          <div className="flex flex-1 flex-col gap-1.5">
            {uploadLabel ? (
              <UploadStatusLine label={uploadLabel} state={uploadState} />
            ) : null}
            <Textarea
              className="max-h-40 min-h-[52px] resize-none border-black/[0.08] bg-gray-50/80 text-sm placeholder:text-gray-400 focus-visible:ring-violet-500/30 dark:border-white/[0.08] dark:bg-zinc-900/50 dark:placeholder:text-zinc-500"
              disabled={isLoading}
              onChange={handleInputChange}
              onKeyDown={onKeyDown}
              placeholder="Pergunte qualquer coisa sobre seus dados... (Enter para enviar, Shift+Enter para nova linha)"
              ref={textareaRef}
              rows={2}
              value={input}
            />
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <input
              accept=".txt,.md,.csv,.pdf"
              className="hidden"
              onChange={handleFileUpload}
              ref={fileInputRef}
              type="file"
            />
            <Button
              className="h-9 w-9 text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200"
              disabled={uploadState === "uploading"}
              onClick={() => fileInputRef.current?.click()}
              size="icon"
              title="Anexar documento (.txt, .md, .csv, .pdf)"
              type="button"
              variant="ghost"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            {isLoading ? (
              <Button
                className="h-9 w-9 bg-red-500 hover:bg-red-400"
                onClick={stop}
                size="icon"
                type="button"
              >
                <Square className="h-4 w-4" fill="currentColor" />
              </Button>
            ) : (
              <Button
                className="h-9 w-9 bg-violet-600 hover:bg-violet-500"
                disabled={!input.trim()}
                size="icon"
                type="submit"
              >
                <SendHorizonal className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
