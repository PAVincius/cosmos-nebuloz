"use client";

import { cn } from "@repo/design-system/lib/utils";
import { MessageSquare, Pin, PinOff } from "lucide-react";
import { useState } from "react";
import type { SessionPreview } from "@/app/actions/safe-copilot/sessions";
import {
  pinCopilotSession,
  unpinCopilotSession,
} from "@/app/actions/safe-copilot/sessions";

type Props = {
  session: SessionPreview;
  isActive: boolean;
  onSelect: (id: string) => void;
  onPinToggle: (id: string, pinned: boolean) => void;
};

export function SessionItem({
  session,
  isActive,
  onSelect,
  onPinToggle,
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

  return (
    <button
      className={cn(
        "group flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors",
        isActive
          ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
          : "text-gray-600 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
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
        <button
          className={cn(
            "shrink-0 rounded p-0.5 transition-opacity",
            isPinned
              ? "text-violet-500 opacity-100"
              : "text-gray-400 opacity-0 group-hover:opacity-100 dark:text-zinc-500"
          )}
          onClick={handlePinClick}
          title={isPinned ? "Desafixar" : "Fixar"}
          type="button"
        >
          {isPinned ? (
            <PinOff className="h-3 w-3" />
          ) : (
            <Pin className="h-3 w-3" />
          )}
        </button>
      ) : null}
    </button>
  );
}
