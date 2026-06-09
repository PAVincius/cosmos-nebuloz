"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { CalendarIcon, FilterIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import {
  createRoadmapItem,
  deleteRoadmapItem,
  type RoadmapItemData,
  type RoadmapStatus,
} from "@/app/actions/roadmap";

// ─── Types ───────────────────────────────────────────────────────────────────

type ARTOption = { id: string; name: string };
type EpicOption = { id: string; title: string };

type Props = {
  initialItems: RoadmapItemData[];
  arts: ARTOption[];
  epics: EpicOption[];
};

type CreateForm = {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  color: string;
  status: RoadmapStatus;
  artId: string;
  epicId: string;
};

const DEFAULT_FORM: CreateForm = {
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  color: "#6366f1",
  status: "PLANNED",
  artId: "",
  epicId: "",
};

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  RoadmapStatus,
  { label: string; className: string }
> = {
  PLANNED: {
    label: "Planejado",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  IN_PROGRESS: {
    label: "Em Progresso",
    className:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  },
  DONE: {
    label: "Concluído",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
  CANCELLED: {
    label: "Cancelado",
    className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  },
};

const STATUS_OPTIONS: RoadmapStatus[] = [
  "PLANNED",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
];

// ─── Month grid helpers ───────────────────────────────────────────────────────

type MonthCol = { year: number; month: number; label: string; key: string };

function buildMonthColumns(items: RoadmapItemData[]): MonthCol[] {
  if (items.length === 0) {
    // Default: show next 12 months
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      return {
        year: d.getFullYear(),
        month: d.getMonth(),
        label: d.toLocaleString("pt-BR", { month: "short", year: "2-digit" }),
        key: `${d.getFullYear()}-${d.getMonth()}`,
      };
    });
  }

  const minDate = new Date(
    Math.min(...items.map((i) => new Date(i.startDate).getTime()))
  );
  const maxDate = new Date(
    Math.max(...items.map((i) => new Date(i.endDate).getTime()))
  );

  // Extend 1 month on each side
  const start = new Date(minDate.getFullYear(), minDate.getMonth() - 1, 1);
  const end = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 1);

  const cols: MonthCol[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    cols.push({
      year: cursor.getFullYear(),
      month: cursor.getMonth(),
      label: cursor.toLocaleString("pt-BR", {
        month: "short",
        year: "2-digit",
      }),
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return cols;
}

/**
 * Returns [startColIndex, endColIndex] (both inclusive) for an item in the month grid.
 * Returns null if the item doesn't intersect any column.
 */
function getItemSpan(
  item: RoadmapItemData,
  cols: MonthCol[]
): { startIdx: number; endIdx: number } | null {
  const start = new Date(item.startDate);
  const end = new Date(item.endDate);

  let startIdx = -1;
  let endIdx = -1;

  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    const colStart = new Date(col.year, col.month, 1);
    const colEnd = new Date(col.year, col.month + 1, 0); // last day of month

    const overlaps = start <= colEnd && end >= colStart;
    if (overlaps) {
      if (startIdx === -1) {
        startIdx = i;
      }
      endIdx = i;
    }
  }

  if (startIdx === -1) {
    return null;
  }
  return { startIdx, endIdx };
}

// ─── Roadmap Row ──────────────────────────────────────────────────────────────

function RoadmapRow({
  item,
  cols,
  artName,
  epicTitle,
  onDelete,
}: {
  item: RoadmapItemData;
  cols: MonthCol[];
  artName: string | undefined;
  epicTitle: string | undefined;
  onDelete: (id: string) => void;
}) {
  const span = getItemSpan(item, cols);
  const status = item.status as RoadmapStatus;
  const statusCfg = STATUS_CONFIG[status];

  // Build cells
  const cells: React.ReactNode[] = cols.map((col, colIdx) => {
    if (!span) {
      return (
        <td
          className="relative h-10 min-w-[80px] border-border/30 border-r"
          key={col.key}
        />
      );
    }

    if (colIdx === span.startIdx) {
      const colSpan = span.endIdx - span.startIdx + 1;
      return (
        <td className="relative h-10 px-1 py-1" colSpan={colSpan} key={col.key}>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex h-full w-full min-w-0 cursor-default select-none items-center overflow-hidden rounded px-2"
                  style={{ backgroundColor: `${item.color}cc` }}
                >
                  <span className="truncate font-medium text-white text-xs drop-shadow-sm">
                    {item.title}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs" side="top">
                <p className="font-semibold">{item.title}</p>
                {item.description && (
                  <p className="mt-0.5 text-xs opacity-80">
                    {item.description}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap gap-1">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${statusCfg.className}`}
                  >
                    {statusCfg.label}
                  </span>
                  {artName && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {artName}
                    </span>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </td>
      );
    }

    // Cells consumed by the colSpan — skip
    if (span && colIdx > span.startIdx && colIdx <= span.endIdx) {
      return null;
    }

    return (
      <td
        className="relative h-10 min-w-[80px] border-border/30 border-r"
        key={col.key}
      />
    );
  });

  return (
    <tr className="group border-border/50 border-b hover:bg-muted/20">
      {/* Item info column */}
      <td className="w-52 shrink-0 border-border border-r px-3 py-2">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <p className="truncate font-medium text-xs">{item.title}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              <span
                className={`rounded px-1 py-0.5 text-xs ${statusCfg.className}`}
              >
                {statusCfg.label}
              </span>
              {artName && (
                <span className="truncate text-muted-foreground text-xs">
                  {artName}
                </span>
              )}
            </div>
          </div>
          <button
            aria-label="Excluir item"
            className="shrink-0 text-muted-foreground opacity-0 transition-colors hover:text-destructive group-hover:opacity-100"
            onClick={() => onDelete(item.id)}
            type="button"
          >
            <Trash2Icon className="h-3 w-3" />
          </button>
        </div>
      </td>
      {cells}
    </tr>
  );
}

// ─── Main Timeline ────────────────────────────────────────────────────────────

export function RoadmapTimeline({ initialItems, arts, epics }: Props) {
  const [items, setItems] = useState(initialItems);
  const [filterArtId, setFilterArtId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(DEFAULT_FORM);
  const [isPending, startTransition] = useTransition();

  const artMap = new Map(arts.map((a) => [a.id, a.name]));
  const epicMap = new Map(epics.map((e) => [e.id, e.title]));

  const filteredItems = items
    .filter((i) => filterArtId === "all" || i.artId === filterArtId)
    .filter((i) => filterStatus === "all" || i.status === filterStatus);

  const cols = useMemo(() => buildMonthColumns(filteredItems), [filteredItems]);

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    startTransition(() => {
      void deleteRoadmapItem(id);
    });
  }

  async function handleCreate() {
    if (!(form.title.trim() && form.startDate && form.endDate)) {
      return;
    }

    const startDate = new Date(form.startDate);
    const endDate = new Date(form.endDate);
    if (endDate < startDate) {
      return;
    }

    const optimistic: RoadmapItemData = {
      id: `tmp-${Date.now()}`,
      title: form.title,
      description: form.description || null,
      startDate,
      endDate,
      color: form.color,
      status: form.status,
      artId: form.artId || null,
      epicId: form.epicId || null,
    };

    setItems((prev) =>
      [...prev, optimistic].sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      )
    );
    setForm(DEFAULT_FORM);
    setDialogOpen(false);

    startTransition(() => {
      void createRoadmapItem({
        title: form.title,
        description: form.description || undefined,
        startDate,
        endDate,
        color: form.color,
        status: form.status,
        artId: form.artId || undefined,
        epicId: form.epicId || undefined,
      });
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <FilterIcon className="h-4 w-4 text-muted-foreground" />
          {arts.length > 0 && (
            <Select onValueChange={setFilterArtId} value={filterArtId}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="Filtrar por ART" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ARTs</SelectItem>
                {arts.map((art) => (
                  <SelectItem key={art.id} value={art.id}>
                    {art.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select onValueChange={setFilterStatus} value={filterStatus}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_CONFIG[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          className="ml-auto"
          onClick={() => setDialogOpen(true)}
          size="sm"
        >
          <PlusIcon className="mr-1.5 h-4 w-4" /> Novo Item
        </Button>
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((s) => (
          <Badge
            className={`text-xs ${STATUS_CONFIG[s].className}`}
            key={s}
            variant="outline"
          >
            {STATUS_CONFIG[s].label}
          </Badge>
        ))}
      </div>

      {/* Timeline grid */}
      {filteredItems.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
          <CalendarIcon className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium text-sm">Nenhum item no roadmap</p>
            <p className="mt-1 text-muted-foreground text-xs">
              Adicione épicos, features ou iniciativas ao roadmap para
              visualizar a linha do tempo.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <PlusIcon className="mr-1.5 h-4 w-4" /> Adicionar item
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table
            className="w-full border-collapse"
            style={{ minWidth: `${52 + cols.length * 80}px` }}
          >
            <thead>
              <tr className="border-border border-b bg-muted/40">
                {/* Item label column */}
                <th className="w-52 border-border border-r px-3 py-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Item
                </th>
                {cols.map((col) => {
                  const isCurrentMonth =
                    col.year === new Date().getFullYear() &&
                    col.month === new Date().getMonth();
                  return (
                    <th
                      className={[
                        "min-w-[80px] border-border/30 border-r px-1 py-2 text-center font-medium text-xs uppercase tracking-wider",
                        isCurrentMonth
                          ? "bg-primary/5 text-primary"
                          : "text-muted-foreground",
                      ].join(" ")}
                      key={col.key}
                    >
                      {col.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <RoadmapRow
                  artName={item.artId ? artMap.get(item.artId) : undefined}
                  cols={cols}
                  epicTitle={item.epicId ? epicMap.get(item.epicId) : undefined}
                  item={item}
                  key={item.id}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Item no Roadmap</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1">
              <Label>Título</Label>
              <Input
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Migração de plataforma"
                value={form.title}
              />
            </div>
            <div className="grid gap-1">
              <Label>Descrição (opcional)</Label>
              <Textarea
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Detalhes do item..."
                rows={2}
                value={form.description}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Data de Início</Label>
                <Input
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                  type="date"
                  value={form.startDate}
                />
              </div>
              <div className="grid gap-1">
                <Label>Data de Fim</Label>
                <Input
                  min={form.startDate}
                  onChange={(e) =>
                    setForm({ ...form, endDate: e.target.value })
                  }
                  type="date"
                  value={form.endDate}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Status</Label>
                <Select
                  onValueChange={(v) =>
                    setForm({ ...form, status: v as RoadmapStatus })
                  }
                  value={form.status}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_CONFIG[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label>Cor</Label>
                <div className="flex items-center gap-2">
                  <input
                    className="h-9 w-14 cursor-pointer rounded border border-border p-0.5"
                    onChange={(e) =>
                      setForm({ ...form, color: e.target.value })
                    }
                    type="color"
                    value={form.color}
                  />
                  <span className="font-mono text-muted-foreground text-xs">
                    {form.color}
                  </span>
                </div>
              </div>
            </div>
            {arts.length > 0 && (
              <div className="grid gap-1">
                <Label>ART (opcional)</Label>
                <Select
                  onValueChange={(v) =>
                    setForm({ ...form, artId: v === "none" ? "" : v })
                  }
                  value={form.artId || "none"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {arts.map((art) => (
                      <SelectItem key={art.id} value={art.id}>
                        {art.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {epics.length > 0 && (
              <div className="grid gap-1">
                <Label>Épico (opcional)</Label>
                <Select
                  onValueChange={(v) =>
                    setForm({ ...form, epicId: v === "none" ? "" : v })
                  }
                  value={form.epicId || "none"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {epics.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setDialogOpen(false)} variant="outline">
              Cancelar
            </Button>
            <Button
              disabled={
                isPending ||
                !form.title.trim() ||
                !form.startDate ||
                !form.endDate
              }
              onClick={handleCreate}
            >
              Adicionar ao Roadmap
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
