"use client";

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { LiveList, LiveObject } from "@liveblocks/client";
import {
  useMutation,
  useMyPresence,
  useOthers,
  useStorage,
} from "@repo/collaboration/hooks";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { analyzeAllEpics } from "@/app/actions/epics/analyze-all-epics";
import type { PortfolioEpic } from "@/app/actions/epics/get-portfolio";
import { updateEpicStatus } from "@/app/actions/epics/update-status";
import type { KanbanColumnConfig } from "@/app/actions/portfolio-kanban/schema";
import { EpicCreateModal } from "./epic-create-modal";
import { EpicDrawer } from "./epic-drawer";
import { KanbanCard } from "./kanban-card";
import { KanbanColumn } from "./kanban-column";

type KanbanBoardProps = {
  initialEpics: PortfolioEpic[];
  columns: KanbanColumnConfig[];
  canConfigure: boolean;
  themes?: { id: string; title: string; color: string }[];
};

export const KanbanBoard = ({
  initialEpics,
  columns,
  canConfigure,
  themes = [],
}: KanbanBoardProps) => {
  const [themeFilter, setThemeFilter] = useState<string>("ALL");
  const [activeEpic, setActiveEpic] = useState<PortfolioEpic | null>(null);
  const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);
  const [openEpicId, setOpenEpicId] = useState<string | null>(null);
  const [quickAddColumnId, setQuickAddColumnId] = useState<string | null>(null);
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
      if (!dbIds.has(e.get("id"))) {
        staleIndices.push(i);
      }
    });
    for (let i = staleIndices.length - 1; i >= 0; i--) {
      liveList.delete(staleIndices[i] as number);
    }

    // Adiciona épicos novos que ainda não estão no Liveblocks
    const liveIds = new Set<string>();
    for (const e of liveList) {
      liveIds.add(e.get("id"));
    }
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
      if (!epics) {
        return;
      }
      const epic = epics.find((e) => e.get("id") === epicId);
      if (!epic) {
        return;
      }
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
        featureCount: initial?.featureCount ?? 0,
        strategicThemeId: initial?.strategicThemeId ?? null,
        themeTitle: initial?.themeTitle ?? null,
        themeColor: initial?.themeColor ?? null,
        linkedOKRCount: initial?.linkedOKRCount ?? 0,
        governanceStatus: initial?.governanceStatus ?? null,
        investScore: initial?.investScore ?? null,
        investBreakdown: initial?.investBreakdown ?? null,
        descriptionMd: initial?.descriptionMd ?? null,
      };
    }) ?? initialEpics;

  const filteredEpics = useMemo(
    () =>
      themeFilter === "ALL"
        ? epics
        : epics.filter((e) => e.strategicThemeId === themeFilter),
    [epics, themeFilter]
  );

  const epicsByColumn = useMemo(() => {
    const map = new Map<string, PortfolioEpic[]>();
    for (const col of columns) {
      map.set(
        col.id,
        filteredEpics
          .filter((e) => e.statusId === col.id)
          .sort((a, b) => a.order - b.order)
      );
    }
    return map;
  }, [filteredEpics, columns]);

  const onDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      const epic = epics.find((e) => e.id === active.id);
      if (epic) {
        setActiveEpic(epic);
      }
    },
    [epics]
  );

  const onDragEnd = useCallback(
    async ({ over }: DragEndEvent) => {
      setActiveEpic(null);
      if (!(over && activeEpic)) {
        return;
      }
      const newStatusId = String(over.id);
      if (newStatusId === activeEpic.statusId) {
        return;
      }
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

  const handleAnalyzeAll = useCallback(async () => {
    setIsAnalyzingAll(true);
    const result = await analyzeAllEpics();
    setIsAnalyzingAll(false);
    if (result.ok) {
      toast.success(`INVEST calculado para ${result.data.length} épicos`);
    } else {
      toast.error("Erro ao analisar épicos");
    }
  }, []);

  return (
    /* biome-ignore lint/a11y/noStaticElementInteractions: tracks cursor for Liveblocks multiplayer presence */
    /* biome-ignore lint/a11y/noNoninteractiveElementInteractions: tracks cursor for Liveblocks multiplayer presence */
    <div
      className="relative h-full"
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      {/* Multiplayer cursors */}
      {others.map(({ connectionId, presence, info }) =>
        presence.cursor ? (
          <div
            className="pointer-events-none fixed z-50 flex items-center gap-1 transition-[transform] duration-75 ease-linear"
            key={connectionId}
            style={{
              transform: `translate(${presence.cursor.x}px, ${presence.cursor.y}px)`,
            }}
          >
            <svg
              aria-hidden="true"
              fill="none"
              height="14"
              viewBox="0 0 14 14"
              width="14"
            >
              <path
                d="M0 0L9 5.5L5.5 6.5L3.5 11L0 0Z"
                fill={info?.color ?? "var(--color-primary)"}
              />
            </svg>
            {!!info?.name && (
              <span
                className="rounded-sm px-1.5 py-0.5 font-medium text-[10px] text-white"
                style={{
                  backgroundColor: info?.color ?? "var(--color-primary)",
                }}
              >
                {info.name}
              </span>
            )}
          </div>
        ) : null
      )}

      {/* Theme filter toolbar */}
      {themes.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] transition-colors hover:bg-muted disabled:opacity-50"
            disabled={isAnalyzingAll}
            onClick={handleAnalyzeAll}
            type="button"
          >
            <span className="text-indigo-500">✦</span>
            {isAnalyzingAll ? "Analisando…" : "Analyze All"}
          </button>
          <span className="text-muted-foreground text-xs">
            Filtrar por tema:
          </span>
          <button
            className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${themeFilter === "ALL" ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted"}`}
            onClick={() => setThemeFilter("ALL")}
            type="button"
          >
            Todos
          </button>
          {themes.map((t) => (
            <button
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${themeFilter === t.id ? "border-foreground" : "border-border hover:bg-muted"}`}
              key={t.id}
              onClick={() => setThemeFilter(t.id)}
              style={
                themeFilter === t.id
                  ? { backgroundColor: `${t.color}22`, borderColor: t.color }
                  : {}
              }
              type="button"
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: t.color }}
              />
              {t.title}
            </button>
          ))}
        </div>
      ) : null}

      {/* Kanban board */}
      <DndContext
        collisionDetection={closestCorners}
        onDragEnd={onDragEnd}
        onDragStart={onDragStart}
        sensors={sensors}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {columns.map((col) => (
            <KanbanColumn
              canConfigure={canConfigure}
              color={col.color}
              epics={epicsByColumn.get(col.id) ?? []}
              id={col.id}
              key={col.id}
              label={col.label}
              onOpenDrawer={setOpenEpicId}
              onQuickAdd={() => setQuickAddColumnId(col.id)}
              wipLimit={col.wipLimit}
            />
          ))}
        </div>

        {/* Drag overlay — ghost card while dragging */}
        <DragOverlay
          dropAnimation={{
            duration: 250,
            easing: "cubic-bezier(0.25,0.46,0.45,0.94)",
          }}
        >
          {activeEpic ? (
            <motion.div
              animate={{ rotate: 2, scale: 1.04, opacity: 0.95 }}
              initial={{ rotate: 0, scale: 1, opacity: 1 }}
              style={{ boxShadow: "0 20px 48px rgba(0,0,0,0.18)" }}
              transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <KanbanCard epic={activeEpic} isDragging />
            </motion.div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {!!openEpicId && (
        <EpicDrawer
          epic={epics.find((e) => e.id === openEpicId) ?? null}
          epicId={openEpicId}
          onClose={() => setOpenEpicId(null)}
        />
      )}

      {quickAddColumnId !== null && (
        <EpicCreateModal
          onClose={() => setQuickAddColumnId(null)}
          onCreated={() => setQuickAddColumnId(null)}
          statusId={quickAddColumnId}
          themes={themes}
        />
      )}
    </div>
  );
};
