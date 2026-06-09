"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { Paperclip, SendHorizonal, Square } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { CopilotMode } from "./copilot-provider";
import {
  CopilotTipTapEditor,
  type CopilotTipTapEditorHandle,
} from "./copilot-tiptap-editor";

const MODE_CHIPS: { key: CopilotMode; short: string }[] = [
  { key: "global", short: "Global" },
  { key: "rte", short: "RTE" },
  { key: "lpm", short: "LPM" },
  { key: "pm", short: "PM/PO" },
  { key: "team", short: "Time" },
  { key: "spc", short: "SPC" },
];

type UploadState = "idle" | "uploading" | "done" | "error";

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

type Props = {
  isLoading: boolean;
  onSubmitText: (text: string) => void;
  onStop: () => void;
  activeSessionId: string;
  mode: CopilotMode;
  onModeChange: (mode: CopilotMode) => void;
};

export function CopilotInputArea({
  isLoading,
  onSubmitText,
  onStop,
  activeSessionId,
  mode,
  onModeChange,
}: Props) {
  const [inputText, setInputText] = useState("");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const editorRef = useRef<CopilotTipTapEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    (text: string) => {
      if (!text.trim() || isLoading) {
        return;
      }
      onSubmitText(text.trim());
      editorRef.current?.clear();
      setInputText("");
    },
    [isLoading, onSubmitText]
  );

  const handleSendClick = useCallback(() => {
    handleSubmit(inputText);
  }, [handleSubmit, inputText]);

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
    <div className="border-black/[0.06] border-t bg-white dark:border-white/[0.06] dark:bg-zinc-950">
      {uploadLabel ? (
        <div
          className={cn(
            "px-4 pt-2 text-[11px]",
            uploadState === "error" && "text-red-500",
            uploadState === "done" && "text-green-600 dark:text-green-400",
            uploadState === "uploading" && "text-gray-500 dark:text-zinc-400"
          )}
        >
          {uploadIcon(uploadState)}
          {uploadLabel}
        </div>
      ) : null}

      <div
        className={cn(
          "mx-4 my-3 rounded-xl border bg-gray-50/80 transition-all duration-300 dark:bg-zinc-900/50",
          isLoading
            ? "animate-pulse border-violet-500/50 shadow-[0_0_0_3px_rgba(124,58,237,0.12)] dark:border-violet-400/40"
            : "border-black/[0.08] dark:border-white/[0.08]"
        )}
      >
        <CopilotTipTapEditor
          disabled={isLoading}
          onChange={setInputText}
          onSubmit={handleSubmit}
          ref={editorRef}
        />

        <div className="flex items-center justify-between px-3 pb-2">
          <div className="flex items-center gap-1">
            <input
              accept=".txt,.md,.csv,.pdf"
              className="hidden"
              onChange={handleFileUpload}
              ref={fileInputRef}
              type="file"
            />
            <Button
              className="h-7 w-7 text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200"
              disabled={uploadState === "uploading"}
              onClick={() => fileInputRef.current?.click()}
              size="icon"
              title="Anexar documento (.txt, .md, .csv, .pdf)"
              type="button"
              variant="ghost"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </Button>

            <div className="mx-1 h-3.5 w-px bg-border/50" />

            {MODE_CHIPS.map((m) => (
              <button
                className={cn(
                  "rounded-full border px-2.5 py-0.5 font-medium text-[10px] transition-colors",
                  mode === m.key
                    ? "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                key={m.key}
                onClick={() => onModeChange(m.key)}
                type="button"
              >
                {m.short}
              </button>
            ))}
          </div>

          {isLoading ? (
            <Button
              className="h-8 w-8 bg-red-500 hover:bg-red-400"
              onClick={onStop}
              size="icon"
              type="button"
            >
              <Square className="h-4 w-4" fill="currentColor" />
            </Button>
          ) : (
            <Button
              className="h-8 w-8 bg-violet-600 hover:bg-violet-500"
              disabled={!inputText.trim()}
              onClick={handleSendClick}
              size="icon"
              type="button"
            >
              <SendHorizonal className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
