"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@repo/design-system/components/ui/sheet";
import { cn } from "@repo/design-system/lib/utils";
import { differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Menu, PanelLeftClose, Plus } from "lucide-react";
import { useState } from "react";
import type { SessionPreview } from "@/app/actions/safe-copilot/sessions";
import { SessionGroup } from "./session-group";

type Props = {
  sessions: SessionPreview[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  isCreating: boolean;
  onSessionsChange?: (sessions: SessionPreview[]) => void;
  onSessionDeleted?: (id: string) => void;
};

function groupSessions(
  sessions: SessionPreview[]
): { label: string; items: SessionPreview[] }[] {
  const pinned = sessions.filter((s) => !!s.pinnedAt);
  const unpinned = sessions.filter((s) => !s.pinnedAt);
  const now = new Date();

  const buckets: Record<string, SessionPreview[]> = {};
  for (const s of unpinned) {
    const diff = differenceInCalendarDays(now, s.createdAt);
    let label: string;
    if (diff === 0) {
      label = "Hoje";
    } else if (diff === 1) {
      label = "Ontem";
    } else if (diff <= 7) {
      label = "Últimos 7 dias";
    } else if (diff <= 30) {
      label = "Últimos 30 dias";
    } else {
      label = format(s.createdAt, "MMMM yyyy", { locale: ptBR });
    }
    if (!buckets[label]) {
      buckets[label] = [];
    }
    buckets[label].push(s);
  }

  const result: { label: string; items: SessionPreview[] }[] = [];
  if (pinned.length > 0) {
    result.push({ label: "Fixadas", items: pinned });
  }
  for (const [label, items] of Object.entries(buckets)) {
    result.push({ label, items });
  }
  return result;
}

type SidebarContentProps = {
  sessions: SessionPreview[];
  activeSessionId: string | null;
  isCreating: boolean;
  onNew: () => void;
  onSelect: (id: string) => void;
  onPinToggle: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
};

function SidebarContent({
  sessions,
  activeSessionId,
  isCreating,
  onNew,
  onSelect,
  onPinToggle,
  onDelete,
}: SidebarContentProps) {
  const groups = groupSessions(sessions);

  return (
    <>
      <div className="flex items-center justify-between px-3 py-3">
        <span className="font-semibold text-gray-700 text-sm dark:text-zinc-300">
          Conversas
        </span>
        <Button
          className="h-7 w-7"
          disabled={isCreating}
          onClick={onNew}
          size="icon"
          title="Nova conversa"
          variant="ghost"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 [scrollbar-width:thin]">
        {groups.length === 0 ? (
          <p className="px-2 py-4 text-center text-gray-400 text-xs dark:text-zinc-600">
            Nenhuma conversa ainda
          </p>
        ) : (
          groups.map((g) => (
            <SessionGroup
              activeSessionId={activeSessionId}
              key={g.label}
              label={g.label}
              onDelete={onDelete}
              onPinToggle={onPinToggle}
              onSelect={onSelect}
              sessions={g.items}
            />
          ))
        )}
      </div>
    </>
  );
}

export function SessionSidebar({
  sessions: initialSessions,
  activeSessionId,
  onSelect,
  onNew,
  isCreating,
  onSessionsChange,
  onSessionDeleted,
}: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const [sessions, setSessions] = useState(initialSessions);

  const handlePinToggle = (id: string, pinned: boolean) => {
    const now = new Date();
    const updated = sessions.map((s) => {
      if (s.id !== id) {
        return s;
      }
      return { ...s, pinnedAt: pinned ? now : null };
    });
    setSessions(updated);
    onSessionsChange?.(updated);
  };

  const handleDelete = (id: string) => {
    const updated = sessions.filter((s) => s.id !== id);
    setSessions(updated);
    onSessionsChange?.(updated);
    onSessionDeleted?.(id);
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden h-full flex-col border-black/[0.06] border-r bg-gray-50/80 transition-all duration-200 lg:flex dark:border-white/[0.06] dark:bg-zinc-900/60",
          isOpen ? "w-64" : "w-12"
        )}
      >
        {isOpen ? (
          <>
            <div className="flex items-center justify-between px-3 py-3">
              <span className="font-semibold text-gray-700 text-sm dark:text-zinc-300">
                Conversas
              </span>
              <div className="flex items-center gap-1">
                <Button
                  className="h-7 w-7"
                  disabled={isCreating}
                  onClick={onNew}
                  size="icon"
                  title="Nova conversa"
                  variant="ghost"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  className="h-7 w-7"
                  onClick={() => setIsOpen(false)}
                  size="icon"
                  title="Recolher sidebar"
                  variant="ghost"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-4 [scrollbar-width:thin]">
              {groupSessions(sessions).length === 0 ? (
                <p className="px-2 py-4 text-center text-gray-400 text-xs dark:text-zinc-600">
                  Nenhuma conversa ainda
                </p>
              ) : (
                groupSessions(sessions).map((g) => (
                  <SessionGroup
                    activeSessionId={activeSessionId}
                    key={g.label}
                    label={g.label}
                    onDelete={handleDelete}
                    onPinToggle={handlePinToggle}
                    onSelect={onSelect}
                    sessions={g.items}
                  />
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-3">
            <Button
              className="h-8 w-8"
              onClick={() => setIsOpen(true)}
              size="icon"
              title="Expandir sidebar"
              variant="ghost"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <Button
              className="h-8 w-8"
              disabled={isCreating}
              onClick={onNew}
              size="icon"
              title="Nova conversa"
              variant="ghost"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </aside>

      {/* Mobile Sheet trigger */}
      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              className="absolute top-3 left-3 z-10 h-8 w-8"
              size="icon"
              variant="ghost"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent className="flex w-72 flex-col p-0" side="left">
            <SidebarContent
              activeSessionId={activeSessionId}
              isCreating={isCreating}
              onDelete={handleDelete}
              onNew={onNew}
              onPinToggle={handlePinToggle}
              onSelect={onSelect}
              sessions={sessions}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
