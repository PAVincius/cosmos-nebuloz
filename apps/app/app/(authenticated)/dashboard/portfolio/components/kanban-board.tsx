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
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { analyzeAllEpics } from "@/app/actions/epics/analyze-all-epics";
import type { PortfolioEpic } from "@/app/actions/epics/get-portfolio";
import { moveEpicAction } from "@/app/actions/portfolio-kanban";
import type { KanbanColumnConfig } from "@/app/actions/portfolio-kanban/schema";
import { EpicCreateModal } from "./epic-create-modal";
import { EpicDrawer } from "./epic-drawer";
import { KanbanCard } from "./kanban-card";
import { KanbanColumn } from "./kanban-column";
import { MultiplayerCursors } from "./multiplayer-cursors";

type KanbanBoardProps = {
  initialEpics: PortfolioEpic[];
  columns: KanbanColumnConfig[];
  canConfigure: boolean;
  canOverrideWip: boolean;
  themes?: { id: string; title: string; color: string }[];
  locale?: string;
};

type PendingMove = {
  epicId: string;
  fromColumn: string;
  toColumn: string;
  wipLimit: number;
  wipCount: number;
};

type MoveMoveOpts = {
  reason?: string;
  wipOverrideReason?: string;
};

const TERMINAL_STATES = new Set(["DONE", "REJECTED"]);

export const KanbanBoard = ({
  initialEpics,
  columns,
  canConfigure,
  canOverrideWip,
  themes = [],
  locale = "pt-BR",
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: React component — hooks rules prevent further extraction
}: KanbanBoardProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL-persisted theme filter (AC-004)
  const themeFilter = searchParams.get("theme") ?? "ALL";

  const setThemeFilter = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id === "ALL") {
        params.delete("theme");
      } else {
        params.set("theme", id);
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const [activeEpic, setActiveEpic] = useState<PortfolioEpic | null>(null);
  const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);
  const [openEpicId, setOpenEpicId] = useState<string | null>(null);
  const [quickAddColumnId, setQuickAddColumnId] = useState<string | null>(null);

  // WIP violation modal state (AC-002)
  const [wipPending, setWipPending] = useState<PendingMove | null>(null);
  const [wipOverrideReason, setWipOverrideReason] = useState("");

  // REJECTED reason modal state (AC-005)
  const [rejectPending, setRejectPending] = useState<{
    epicId: string;
    fromColumn: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

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
                lifecycleStatus: e.lifecycleStatus,
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
            lifecycleStatus: e.lifecycleStatus,
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

  const moveEpicInStorage = useMutation(
    ({ storage }, epicId: string, toColumn: string) => {
      const epics = storage.get("kanbanEpics");
      if (!epics) {
        return;
      }
      const epic = epics.find((e) => e.get("id") === epicId);
      if (!epic) {
        return;
      }
      const order = epics.filter(
        (e) => e.get("lifecycleStatus") === toColumn
      ).length;
      epic.set("lifecycleStatus", toColumn);
      epic.set("order", order);
    },
    []
  );

  const addEpicToStorage = useMutation(
    (
      { storage },
      epic: { id: string; title: string; statusId: string; order: number }
    ) => {
      const liveList = storage.get("kanbanEpics");
      if (!liveList) {
        return;
      }
      const alreadyExists = liveList.some((e) => e.get("id") === epic.id);
      if (!alreadyExists) {
        liveList.push(
          new LiveObject({
            id: epic.id,
            title: epic.title,
            lifecycleStatus: "FUNNEL",
            order: epic.order,
            wsjfScore: 0,
            bv: 0,
            tc: 0,
            rr: 0,
            js: 1,
          })
        );
      }
    },
    []
  );

  useEffect(() => {
    syncStorage(initialEpics);
  }, [syncStorage, initialEpics]);

  const epics: PortfolioEpic[] =
    liveEpics?.map(
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: pre-existing live-to-portfolio-epic mapping with many optional fields
      (e) => {
        const initial = initialEpics.find((ie) => ie.id === e.id);
        return {
          id: e.id,
          title: e.title,
          statusId: initial?.statusId ?? e.lifecycleStatus,
          lifecycleStatus: e.lifecycleStatus,
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
          epicType: initial?.epicType ?? "EPIC",
          dueDate: initial?.dueDate ?? null,
          completedFeatureCount: initial?.completedFeatureCount ?? 0,
          topFeatures: initial?.topFeatures ?? [],
        };
      }
    ) ?? initialEpics;

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
          .filter((e) => e.lifecycleStatus === col.id)
          .sort((a, b) => a.order - b.order)
      );
    }
    return map;
  }, [filteredEpics, columns]);

  const executeMove = useCallback(
    async (
      epicId: string,
      fromColumn: string,
      toColumn: string,
      opts: MoveMoveOpts = {}
    ) => {
      // Optimistic Liveblocks update (AC-003)
      moveEpicInStorage(epicId, toColumn);

      const result = await moveEpicAction({
        epicId,
        toColumn,
        reason: opts.reason,
        wipOverrideReason: opts.wipOverrideReason,
      });

      if (!result.ok) {
        // Revert on failure
        moveEpicInStorage(epicId, fromColumn);
        let msg = result.error;
        if (result.error === "GUARD_FAILED") {
          if (locale === "es") {
            msg = "Condiciones insuficientes para esta transición";
          } else {
            msg = "Condições insuficientes para esta transição";
          }
        }
        toast.error(msg);
      }
    },
    [moveEpicInStorage, locale]
  );

  const onDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      const epic = epics.find((e) => e.id === active.id);
      if (epic) {
        setActiveEpic(epic);
        updatePresence({ dragging: epic.id });
      }
    },
    [epics, updatePresence]
  );

  const onDragEnd = useCallback(
    async ({ over }: DragEndEvent) => {
      setActiveEpic(null);
      updatePresence({ dragging: null });
      if (!(over && activeEpic)) {
        return;
      }

      const toColumn = String(over.id);
      const fromColumn = activeEpic.lifecycleStatus;
      if (toColumn === fromColumn) {
        return;
      }

      // Terminal states cannot be moved (AC-004 constraint)
      if (TERMINAL_STATES.has(fromColumn)) {
        return;
      }

      // REJECTED requires reason modal (AC-005)
      if (toColumn === "REJECTED") {
        setRejectPending({ epicId: activeEpic.id, fromColumn });
        setRejectReason("");
        return;
      }

      // WIP check (AC-002)
      const targetCol = columns.find((c) => c.id === toColumn);
      if (targetCol?.wipLimit) {
        const currentCount = epicsByColumn.get(toColumn)?.length ?? 0;
        if (currentCount >= targetCol.wipLimit) {
          setWipPending({
            epicId: activeEpic.id,
            fromColumn,
            toColumn,
            wipLimit: targetCol.wipLimit,
            wipCount: currentCount,
          });
          setWipOverrideReason("");
          return;
        }
      }

      await executeMove(activeEpic.id, fromColumn, toColumn);
    },
    [activeEpic, columns, epicsByColumn, executeMove, updatePresence]
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

  // Localized strings
  const t = useMemo(() => {
    if (locale === "es") {
      return {
        filterByTheme: "Filtrar por tema:",
        all: "Todos",
        analyzing: "Analizando…",
        analyzeAll: "Analyze All",
        wipTitle: "Límite WIP excedido",
        wipDesc: (n: number) =>
          `Mover este épico excedería el límite WIP de ${n} para esta columna.`,
        wipNoPermission: "No tienes permiso para exceder los límites WIP.",
        wipOverrideLabel: "Motivo del override (obligatorio):",
        proceed: "Proceder de todos modos",
        cancel: "Cancelar",
        rejectTitle: "Motivo de rechazo",
        rejectDesc:
          "Proporciona un motivo para rechazar este épico (mín. 20 caracteres).",
        rejectLabel: "Motivo:",
        rejectBtn: "Rechazar épico",
      };
    }
    // pt-BR (default)
    return {
      filterByTheme: "Filtrar por tema:",
      all: "Todos",
      analyzing: "Analisando…",
      analyzeAll: "Analyze All",
      wipTitle: "Limite WIP excedido",
      wipDesc: (n: number) =>
        `Mover este épico excederia o limite WIP de ${n} para esta coluna.`,
      wipNoPermission: "Você não tem permissão para exceder os limites WIP.",
      wipOverrideLabel: "Motivo do override (obrigatório):",
      proceed: "Prosseguir mesmo assim",
      cancel: "Cancelar",
      rejectTitle: "Motivo da rejeição",
      rejectDesc:
        "Forneça um motivo para rejeitar este épico (mín. 20 caracteres).",
      rejectLabel: "Motivo:",
      rejectBtn: "Rejeitar épico",
    };
  }, [locale]);

  return (
    /* biome-ignore lint/a11y/noStaticElementInteractions: tracks cursor for Liveblocks multiplayer presence */
    /* biome-ignore lint/a11y/noNoninteractiveElementInteractions: tracks cursor for Liveblocks multiplayer presence */
    <div
      className="relative flex h-full flex-col"
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      <MultiplayerCursors />

      {/* Theme filter toolbar */}
      {themes.length > 0 ? (
        <div className="mb-3 flex flex-shrink-0 flex-wrap items-center gap-2">
          {others.length > 0 && (
            <div className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              {others.length} online
            </div>
          )}
          <button
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] transition-colors hover:bg-muted disabled:opacity-50"
            disabled={isAnalyzingAll}
            onClick={handleAnalyzeAll}
            type="button"
          >
            <span className="text-indigo-500">✦</span>
            {isAnalyzingAll ? t.analyzing : t.analyzeAll}
          </button>
          <span className="text-muted-foreground text-xs">
            {t.filterByTheme}
          </span>
          <button
            className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${themeFilter === "ALL" ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted"}`}
            onClick={() => setThemeFilter("ALL")}
            type="button"
          >
            {t.all}
          </button>
          {themes.map((theme) => (
            <button
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${themeFilter === theme.id ? "border-foreground" : "border-border hover:bg-muted"}`}
              key={theme.id}
              onClick={() => setThemeFilter(theme.id)}
              style={
                themeFilter === theme.id
                  ? {
                      backgroundColor: `${theme.color}22`,
                      borderColor: theme.color,
                    }
                  : {}
              }
              type="button"
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: theme.color }}
              />
              {theme.title}
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
        <div className="flex min-h-0 flex-1 items-stretch gap-3 pb-4">
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

        {/* Drag overlay */}
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

      {/* WIP violation modal (AC-002) */}
      <Dialog
        onOpenChange={(open) => !open && setWipPending(null)}
        open={wipPending !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.wipTitle}</DialogTitle>
            <DialogDescription>
              {wipPending ? t.wipDesc(wipPending.wipLimit) : ""}
            </DialogDescription>
          </DialogHeader>

          {canOverrideWip ? (
            <div className="space-y-2">
              {/* biome-ignore lint/a11y/noLabelWithoutControl: textarea is semantically associated by proximity */}
              <label className="font-medium text-sm">
                {t.wipOverrideLabel}
              </label>
              <Textarea
                id="wip-override-reason"
                onChange={(e) => setWipOverrideReason(e.target.value)}
                placeholder="Justifique a exceção ao limite WIP…"
                rows={3}
                value={wipOverrideReason}
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{t.wipNoPermission}</p>
          )}

          <DialogFooter>
            <Button onClick={() => setWipPending(null)} variant="outline">
              {t.cancel}
            </Button>
            {!!canOverrideWip && (
              <Button
                disabled={wipOverrideReason.trim().length < 5}
                onClick={async () => {
                  if (!wipPending) {
                    return;
                  }
                  const { epicId, fromColumn, toColumn } = wipPending;
                  setWipPending(null);
                  await executeMove(epicId, fromColumn, toColumn, {
                    wipOverrideReason: wipOverrideReason.trim(),
                  });
                }}
              >
                {t.proceed}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REJECTED reason modal (AC-005) */}
      <Dialog
        onOpenChange={(open) => !open && setRejectPending(null)}
        open={rejectPending !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.rejectTitle}</DialogTitle>
            <DialogDescription>{t.rejectDesc}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {/* biome-ignore lint/a11y/noLabelWithoutControl: textarea is semantically associated by proximity */}
            <label className="font-medium text-sm">{t.rejectLabel}</label>
            <Textarea
              id="reject-reason"
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Descreva o motivo da rejeição…"
              rows={3}
              value={rejectReason}
            />
            {rejectReason.length > 0 && rejectReason.length < 20 && (
              <p className="text-[11px] text-red-500">
                {20 - rejectReason.length} caracteres restantes
              </p>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setRejectPending(null)} variant="outline">
              {t.cancel}
            </Button>
            <Button
              disabled={rejectReason.trim().length < 20}
              onClick={async () => {
                if (!rejectPending) {
                  return;
                }
                const { epicId, fromColumn } = rejectPending;
                setRejectPending(null);
                await executeMove(epicId, fromColumn, "REJECTED", {
                  reason: rejectReason.trim(),
                });
              }}
              variant="destructive"
            >
              {t.rejectBtn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!!openEpicId && (
        <EpicDrawer
          epic={epics.find((e) => e.id === openEpicId) ?? null}
          epicId={openEpicId}
          onClose={() => setOpenEpicId(null)}
        />
      )}

      {quickAddColumnId !== null && (
        <EpicCreateModal
          epics={epics
            .filter((e) => e.epicType === "EPIC")
            .map((e) => ({ id: e.id, title: e.title }))}
          onClose={() => setQuickAddColumnId(null)}
          onCreated={(epic) => {
            addEpicToStorage(epic);
            setQuickAddColumnId(null);
          }}
          statusId={quickAddColumnId}
          themes={themes}
        />
      )}
    </div>
  );
};
