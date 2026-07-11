"use client";

import type { KanbanColumnConfig } from "@/app/actions/portfolio-kanban/schema";
import { moveEpicAction } from "@/app/actions/portfolio-kanban";
import { analyzeAllEpics } from "@/app/actions/epics/analyze-all-epics";
import type { PortfolioEpic } from "@/app/actions/epics/get-portfolio";
import { useExportCsv } from "@repo/design-system/hooks/use-export-csv";
import type { BoardTone } from "../../components/board-primitives";
import { BoardCard, BoardColumn } from "../../components/board-primitives";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { InboxIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  EpicTransitionDialog,
  type TransitionDialogState,
} from "./epic-transition-dialog";
import { EpicQuickAddModal } from "./epic-quick-add-modal";
import { KanbanToolbar } from "./kanban-toolbar";

const VISIBLE_COLUMN_ORDER = [
  "FUNNEL",
  "ANALYZING",
  "PORTFOLIO_BACKLOG",
  "IMPLEMENTING",
  "DONE",
] as const;

const COLUMN_TONE: Record<string, BoardTone> = {
  FUNNEL: "neutral",
  ANALYZING: "purple",
  PORTFOLIO_BACKLOG: "blue",
  IMPLEMENTING: "accent",
  DONE: "green",
  REJECTED: "red",
};

function investTone(score: number | null): BoardTone {
  if (score === null) {
    return "neutral";
  }
  if (score >= 70) {
    return "green";
  }
  if (score >= 50) {
    return "amber";
  }
  return "red";
}

/** WSJF chip tone thresholds (screen-kanban.jsx EpicCard). */
function wsjfTone(score: number): BoardTone {
  if (score >= 18) {
    return "red";
  }
  if (score >= 13) {
    return "amber";
  }
  return "green";
}

function humanizeError(code: string): string {
  const map: Record<string, string> = {
    INVALID_TARGET_COLUMN: "Coluna de destino inválida.",
    WIP_LIMIT_EXCEEDED: "Limite de WIP da coluna atingido.",
    REJECTION_REASON_REQUIRED: "É necessário informar um motivo.",
    TERMINAL_STATE: "Este épico já está em um estado final.",
  };
  return map[code] ?? code;
}

interface EpicsKanbanBoardProps {
  initialEpics: PortfolioEpic[];
  columns: KanbanColumnConfig[];
  canOverrideWip: boolean;
  themes: { id: string; title: string; color: string }[];
}

/** Board de épicos do portfólio (#/epics — screens-kanban.js:80). DnD via dnd-kit + BoardColumn/BoardCard. */
export function EpicsKanbanBoard({
  initialEpics,
  columns,
  canOverrideWip,
  themes,
}: EpicsKanbanBoardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  const [addModalColumn, setAddModalColumn] = useState<string | null>(null);
  const [transition, setTransition] = useState<
    (TransitionDialogState & { epicId: string; toColumn: string }) | null
  >(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  // Header CTA "Novo Épico" (screen-kanban.jsx) navega para ?epic=new; abrimos o
  // modal e limpamos o parâmetro para não reabrir num refresh.
  useEffect(() => {
    if (searchParams.get("epic") === "new") {
      setAddModalColumn("FUNNEL");
      router.replace(pathname);
    }
  }, [searchParams, pathname, router]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const columnById = useMemo(
    () => new Map(columns.map((c) => [c.id, c])),
    [columns]
  );

  const filteredEpics = useMemo(
    () =>
      activeTheme === null
        ? initialEpics
        : initialEpics.filter((e) => e.strategicThemeId === activeTheme),
    [initialEpics, activeTheme]
  );

  const csvColumns = useMemo<
    { header: string; accessor: (e: PortfolioEpic) => string | number }[]
  >(
    () => [
      { header: "ID", accessor: (e) => e.id },
      { header: "Título", accessor: (e) => e.title },
      { header: "Lifecycle", accessor: (e) => e.statusId },
      { header: "Tema", accessor: (e) => e.themeTitle ?? "" },
      { header: "WSJF", accessor: (e) => e.wsjfScore.toFixed(1) },
      { header: "INVEST", accessor: (e) => e.investScore ?? "" },
      {
        header: "Features",
        accessor: (e) => `${e.completedFeatureCount}/${e.featureCount}`,
      },
    ],
    []
  );
  const exportCsv = useExportCsv(filteredEpics, csvColumns, "epicos-portfolio");

  async function performMove(
    epicId: string,
    toColumn: string,
    wipOverrideReason?: string
  ) {
    setMovingId(epicId);
    const result = await moveEpicAction({ epicId, toColumn, wipOverrideReason });
    setMovingId(null);
    setTransition(null);

    if (!result.ok) {
      if (result.error === "WIP_LIMIT_EXCEEDED" && canOverrideWip && !wipOverrideReason) {
        setTransition({
          kind: "wip-reason",
          epicId,
          toColumn,
          epicTitle: "",
          columnLabel: columnById.get(toColumn)?.label ?? toColumn,
        });
        return;
      }
      toast.error(humanizeError(result.error));
      return;
    }

    toast.success("Épico movido.");
    startTransition(() => router.refresh());
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) {
      return;
    }
    const epicId = String(active.id);
    const toColumn = String(over.id);
    const epic = initialEpics.find((e) => e.id === epicId);
    if (!epic || epic.statusId === toColumn) {
      return;
    }

    if (toColumn === "IMPLEMENTING") {
      const score = epic.investScore;
      if (score === null || score < 50) {
        toast.error(
          `Score INVEST insuficiente (${score ?? "N/A"}) — refine o épico antes de mover para Implementing.`
        );
        return;
      }
      if (score < 70) {
        setTransition({
          kind: "invest-confirm",
          epicId,
          toColumn,
          epicTitle: epic.title,
          investScore: score,
        });
        return;
      }
    }

    void performMove(epicId, toColumn);
  }

  async function handleAnalyzeAll() {
    setAnalyzing(true);
    const result = await analyzeAllEpics();
    setAnalyzing(false);
    if (!result.ok) {
      toast.error(`Falha ao analisar épicos: ${result.error}`);
      return;
    }
    toast.success(`INVEST calculado para ${result.data.length} épicos.`);
    startTransition(() => router.refresh());
  }

  if (initialEpics.length === 0) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-cosmos-lg border border-hairline border-dashed bg-surface-2 text-center">
        <InboxIcon aria-hidden className="text-ink-muted" size={32} />
        <p className="text-[13px] text-ink-muted">
          Nenhum épico no portfólio ainda.
        </p>
        <button
          className="inline-flex items-center gap-1.5 rounded-cosmos-md bg-accent-c px-3 py-1.5 font-medium text-[12px] text-white"
          onClick={() => setAddModalColumn("FUNNEL")}
          type="button"
        >
          <PlusIcon aria-hidden size={13} />+ Adicionar épico
        </button>
        <EpicQuickAddModal
          defaultStatusId={addModalColumn ?? "FUNNEL"}
          onClose={() => setAddModalColumn(null)}
          onCreated={() => {
            setAddModalColumn(null);
            startTransition(() => router.refresh());
          }}
          open={addModalColumn !== null}
          themes={themes}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <KanbanToolbar
        activeTheme={activeTheme}
        analyzing={analyzing}
        onAnalyzeAll={handleAnalyzeAll}
        onExportCsv={exportCsv}
        onThemeChange={setActiveTheme}
        themes={themes}
      />

      <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
        <div className="flex flex-1 items-start gap-3 overflow-x-auto pb-2">
          {VISIBLE_COLUMN_ORDER.map((columnId) => {
            const col = columnById.get(columnId);
            const label = col?.label ?? columnId;
            const wipLimit = col?.wipLimit ?? null;
            const epicsInColumn = filteredEpics.filter(
              (e) => e.statusId === columnId
            );

            return (
              <BoardColumn
                count={epicsInColumn.length}
                id={columnId}
                key={columnId}
                title={label}
                tone={COLUMN_TONE[columnId] ?? "neutral"}
              >
                {wipLimit && (
                  <div className="mb-1 flex items-center gap-2 px-0.5">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full bg-[color:var(--tone-solid,var(--accent-c))] transition-[width]"
                        style={{
                          width: `${Math.min(100, (epicsInColumn.length / wipLimit) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-ink-muted">
                      {epicsInColumn.length}/{wipLimit}
                    </span>
                  </div>
                )}

                {epicsInColumn.length === 0 && (
                  <div className="rounded-cosmos-md border border-hairline border-dashed p-3 text-center text-[11px] text-ink-muted">
                    Arraste um épico aqui
                  </div>
                )}

                {epicsInColumn.map((epic) => (
                  <BoardCard
                    badges={[
                      {
                        label: epic.themeTitle ?? "Sem tema",
                        tone: "neutral",
                      },
                      {
                        label: `WSJF ${epic.wsjfScore.toFixed(1)}`,
                        tone: wsjfTone(epic.wsjfScore),
                        mono: true,
                      },
                      ...(epic.investScore !== null
                        ? [
                            {
                              label: `INVEST ${epic.investScore}`,
                              tone: investTone(epic.investScore),
                              mono: true,
                            },
                          ]
                        : []),
                    ]}
                    className={movingId === epic.id ? "opacity-50" : undefined}
                    draggableId={epic.id}
                    key={epic.id}
                    meta={
                      <Link
                        className="hover:text-accent-text hover:underline"
                        href={`/portfolio/${epic.id}`}
                      >
                        {epic.completedFeatureCount}/{epic.featureCount}{" "}
                        features · {epic.js} pts · abrir
                      </Link>
                    }
                    title={epic.title}
                    tone={COLUMN_TONE[columnId] ?? "neutral"}
                  />
                ))}

                <button
                  className="mt-1 flex items-center justify-center gap-1 rounded-cosmos-md border border-hairline border-dashed py-1.5 text-[11px] text-ink-muted transition-colors hover:border-accent-c hover:text-accent-text"
                  onClick={() => setAddModalColumn(columnId)}
                  type="button"
                >
                  <PlusIcon aria-hidden size={12} />
                  Adicionar épico
                </button>
              </BoardColumn>
            );
          })}
        </div>
      </DndContext>

      <EpicQuickAddModal
        defaultStatusId={addModalColumn ?? "FUNNEL"}
        onClose={() => setAddModalColumn(null)}
        onCreated={() => {
          setAddModalColumn(null);
          startTransition(() => router.refresh());
        }}
        open={addModalColumn !== null}
        themes={themes}
      />

      <EpicTransitionDialog
        onCancel={() => setTransition(null)}
        onConfirm={(reason) => {
          if (!transition) {
            return;
          }
          void performMove(transition.epicId, transition.toColumn, reason);
        }}
        state={transition}
        submitting={movingId !== null || isPending}
      />
    </div>
  );
}
