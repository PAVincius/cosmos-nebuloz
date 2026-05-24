"use client";

import type { SessionPreview } from "@/app/actions/safe-copilot/sessions";
import { SessionItem } from "./session-item";

type Props = {
  label: string;
  sessions: SessionPreview[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onPinToggle: (id: string, pinned: boolean) => void;
};

export function SessionGroup({
  label,
  sessions,
  activeSessionId,
  onSelect,
  onPinToggle,
}: Props) {
  return (
    <div className="mb-3">
      <p className="mb-1 px-2 font-medium text-[10px] text-gray-400 uppercase tracking-wider dark:text-zinc-600">
        {label}
      </p>
      <div className="space-y-0.5">
        {sessions.map((s) => (
          <SessionItem
            isActive={s.id === activeSessionId}
            key={s.id}
            onPinToggle={onPinToggle}
            onSelect={onSelect}
            session={s}
          />
        ))}
      </div>
    </div>
  );
}
