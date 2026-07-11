"use client";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@repo/design-system/components/ui/context-menu";
import { cn } from "@repo/design-system/lib/utils";
import {
  FileJson,
  FileText,
  MessageSquare,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import type {
  SessionPreview,
  StoredMessage,
} from "@/app/actions/safe-copilot/sessions";
import {
  deleteCopilotSession,
  loadCopilotSession,
  pinCopilotSession,
  unpinCopilotSession,
} from "@/app/actions/safe-copilot/sessions";

type Props = {
  session: SessionPreview;
  isActive: boolean;
  onSelect: (id: string) => void;
  onPinToggle: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
};

function exportAsMarkdown(session: SessionPreview, messages: StoredMessage[]) {
  const lines: string[] = [`# ${session.preview}`, ""];
  for (const m of messages) {
    lines.push(
      `**${m.role === "user" ? "Você" : "Copilot"}:** ${m.content}`,
      ""
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  triggerDownload(blob, `${session.preview.slice(0, 40)}.md`);
}

function exportAsJson(session: SessionPreview, messages: StoredMessage[]) {
  const payload = {
    id: session.id,
    title: session.preview,
    createdAt: session.createdAt,
    messages,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  triggerDownload(blob, `${session.preview.slice(0, 40)}.json`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SessionItem({
  session,
  isActive,
  onSelect,
  onPinToggle,
  onDelete,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const isPinned = !!session.pinnedAt;

  const handlePinClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPinned) {
      await unpinCopilotSession(session.id);
      onPinToggle(session.id, false);
    } else {
      await pinCopilotSession(session.id);
      onPinToggle(session.id, true);
    }
  };

  const handleDelete = async () => {
    await deleteCopilotSession(session.id);
    onDelete(session.id);
  };

  const handleExport = async (format: "json" | "markdown") => {
    const messages = await loadCopilotSession(session.id);
    if (format === "json") {
      exportAsJson(session, messages);
    } else {
      exportAsMarkdown(session, messages);
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          className={cn(
            "group flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors",
            isActive
              ? "bg-[var(--cosmos-ai-bg)] text-[var(--cosmos-ai-fg)]"
              : "text-ink-muted hover:bg-surface-3"
          )}
          onClick={() => onSelect(session.id)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          type="button"
        >
          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
          <p className="min-w-0 flex-1 truncate text-xs leading-snug">
            {session.preview}
          </p>
          {hovered || isPinned ? (
            <div
              className={cn(
                "shrink-0 cursor-pointer rounded p-0.5 transition-opacity",
                isPinned
                  ? "text-[var(--cosmos-ai-fg)] opacity-100"
                  : "text-ink-muted opacity-0 group-hover:opacity-100"
              )}
              onClick={handlePinClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handlePinClick(e as unknown as React.MouseEvent);
                }
              }}
              role="button"
              tabIndex={0}
              title={isPinned ? "Desafixar" : "Fixar"}
            >
              {isPinned ? (
                <PinOff className="h-3 w-3" />
              ) : (
                <Pin className="h-3 w-3" />
              )}
            </div>
          ) : null}
        </button>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => onSelect(session.id)}>
          <MessageSquare className="mr-2 h-4 w-4" />
          Abrir conversa
        </ContextMenuItem>

        <ContextMenuItem
          onClick={handlePinClick as unknown as React.MouseEventHandler}
        >
          {isPinned ? (
            <>
              <PinOff className="mr-2 h-4 w-4" />
              Desafixar
            </>
          ) : (
            <>
              <Pin className="mr-2 h-4 w-4" />
              Fixar no topo
            </>
          )}
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={() => handleExport("markdown")}>
          <FileText className="mr-2 h-4 w-4" />
          Exportar como Markdown
        </ContextMenuItem>

        <ContextMenuItem onClick={() => handleExport("json")}>
          <FileJson className="mr-2 h-4 w-4" />
          Exportar como JSON
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem
          className="text-red-600 focus:bg-red-50 focus:text-red-700 dark:text-red-400 dark:focus:bg-red-950/40"
          onClick={handleDelete}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Excluir conversa
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
