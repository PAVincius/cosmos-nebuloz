"use client";

import type { PortfolioEpic } from "@/app/actions/epics/get-portfolio";
import { updateEpicStatus } from "@/app/actions/epics/update-status";
import type { KanbanColumnConfig } from "@/app/actions/portfolio-kanban/schema";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { LiveList, LiveObject } from "@liveblocks/client";
import {
  useMyPresence,
  useMutation,
  useOthers,
  useStorage,
} from "@repo/collaboration/hooks";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KanbanCard } from "./kanban-card";
import { KanbanColumn } from "./kanban-column";

type KanbanBoardProps = {
  initialEpics: PortfolioEpic[];
  columns: KanbanColumnConfig[];
  canConfigure: boolean;
  themes?: { id: string; title: string; color: string }[];
};

export const KanbanBoard = ({ initialEpics, columns, canConfigure, themes = [] }: KanbanBoardProps) => {
  const [themeFilter, setThemeFilter] = useState<string>("ALL");
  const [activeEpic, setActiveEpic] = useState<PortfolioEpic | null>(null);
  const [, updatePresence] = useMyPresence();
  const others = useOthers();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const liveEpics = useStorage((root) => root.kanbanEpics);

  const syncStorage = useMutation(({ storage }, dbEpics: PortfolioEpic[]) => {
    const liveList = storage.get("kanbanEpics");

    if (!liveList || liveList.length === 0) {
      storage.set(
        "kanbanEpics",
        new LiveList(
          dbEpics.map(
            (e) =>
              new LiveObject({
                id: e.id,
                title: e.title,
                statusId: e.statusId,
                order: e.order,
                wsjfScore: e.wsjfScore,
                bv: e.bv,
                tc: e.tc,
                rr: e.rr,
                js: e.js,
              })
          )
        )
      );
      return;
    }

    const dbIds = new Set(dbEpics.map((e) => e.id));

    // Remove épicos que não existem mais no DB
    const staleIndices: number[] = [];
    liveList.forEach((e, i) => {
      if (!dbIds.has(e.get("id"))) staleIndices.push(i);
    });
    for (let i = staleIndices.length - 1; i >= 0; i--) {
      liveList.delete(staleIndices[i] as number);
    }

    // Adiciona épicos novos que ainda não estão no Liveblocks
    const liveIds = new Set<string>();
    liveList.forEach((e) => liveIds.add(e.get("id")));
    for (const e of dbEpics) {
      if (!liveIds.has(e.id)) {
        liveList.push(
          new LiveObject({
            id: e.id,
            title: e.title,
            statusId: e.statusId,
            order: e.order,
            wsjfScore: e.wsjfScore,
            bv: e.bv,
            tc: e.tc,
            rr: e.rr,
            js: e.js,
          })
        );
      }
    }
  }, []);

  const moveEpic = useMutation(
    ({ storage }, epicId: string, newStatusId: string) => {
      const epics = storage.get("kanbanEpics");
      if (!epics) return;
      const epic = epics.find((e) => e.get("id") === epicId);
      if (!epic) return;
      const order = epics.filter(
        (e) => e.get("statusId") === newStatusId
      ).length;
      epic.set("statusId", newStatusId);
      epic.set("order", order);
    },
    []
  );

  useEffect(() => {
    syncStorage(initialEpics);
  }, [syncStorage, initialEpics]);

  const epics: PortfolioEpic[] =
    liveEpics?.map((e) => {
      const initial = initialEpics.find((ie) => ie.id === e.id);
      return {
        id: e.id,
        title: e.title,
        statusId: e.statusId,
        order: e.order,
        wsjfScore: e.wsjfScore,
        bv: initial?.bv ?? 0,
        tc: initial?.tc ?? 0,
        rr: initial?.rr ?? 0,
        js: initial?.js ?? 1,
        featureCount:     initial?.featureCount ?? 0,
        strategicThemeId: initial?.strategicThemeId ?? null,
        themeTitle:       initial?.themeTitle ?? null,
        themeColor:       initial?.themeColor ?? null,
      };
    }) ?? initialEpics;

  const filteredEpics = useMemo(
    () => (themeFilter === "ALL" ? epics : epics.filter((e) => e.strategicThemeId === themeFilter)),
    [epics, themeFilter],
  );

  const epicsByColumn = useMemo(() => {
    const map = new Map<string, PortfolioEpic[]>();
    for (const col of columns) {
      map.set(
        col.id,
        filteredEpics.filter((e) => e.statusId === col.id).sort((a, b) => a.order - b.order)
      );
    }
    return map;
  }, [filteredEpics, columns]);

  const onDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      const epic = epics.find((e) => e.id === active.id);
      if (epic) setActiveEpic(epic);
    },
    [epics]
  );

  const onDragEnd = useCallback(
    async ({ over }: DragEndEvent) => {
      setActiveEpic(null);
      if (!over || !activeEpic) return;
      const newStatusId = String(over.id);
      if (newStatusId === activeEpic.statusId) return;
      moveEpic(activeEpic.id, newStatusId);
      const order = epics.filter((e) => e.statusId === newStatusId).length;
      await updateEpicStatus(activeEpic.id, newStatusId, order);
    },
    [activeEpic, moveEpic, epics]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      updatePresence({ cursor: { x: e.clientX, y: e.clientY } });
    },
    [updatePresence]
  );

  const handleMouseLeave = useCallback(() => {
    updatePresence({ cursor: null });
  }, [updatePresence]);

  return (
    <div
      className="relative h-full"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Multiplayer cursors */}
      {others.map(({ connectionId, presence, info }) =>
        presence.cursor ? (
          <div
            key={connectionId}
            className="pointer-events-none fixed z-50 flex items-center gap-1"
            style={{
              transform: `translate(${presence.cursor.x}px, ${presence.cursor.y}px)`,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M0 0L9 5.5L5.5 6.5L3.5 11L0 0Z"
                fill={info?.color ?? "var(--color-primary)"}
              />
            </svg>
            {info?.name && (
              <span
                className="rounded-sm px-1.5 py-0.5 text-[10px] font-medium text-white"
                style={{ backgroundColor: info?.color ?? "var(--color-primary)" }}
              >
                {info.name}
              </span>
            )}
          </div>
        ) : null
      )}

      {/* Theme filter toolbar */}
      {themes.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtrar por tema:</span>
          <button
            type="button"
            onClick={() => setThemeFilter("ALL")}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${themeFilter === "ALL" ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`}
          >
            Todos
          </button>
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setThemeFilter(t.id)}
              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors inline-flex items-center gap-1 ${themeFilter === t.id ? "border-foreground" : "border-border hover:bg-muted"}`}
              style={themeFilter === t.id ? { backgroundColor: `${t.color}22`, borderColor: t.color } : undefined}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.color }} aria-hidden />
              {t.title}
            </button>
          ))}
        </div>
      )}

      {/* Kanban board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {columns.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              label={col.label}
              color={col.color}
              canConfigure={canConfigure}
              epics={epicsByColumn.get(col.id) ?? []}
            />
          ))}
        </div>

        {/* Drag overlay — ghost card while dragging */}
        <DragOverlay>
          {activeEpic ? (
            <div className="rotate-2 opacity-90">
              <KanbanCard epic={activeEpic} isDragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};
