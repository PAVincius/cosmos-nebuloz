"use client";

import { useState, useTransition, useMemo } from "react";
import {
  CalendarIcon,
  FilterIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
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

const STATUS_CONFIG: Record<RoadmapStatus, { label: string; className: string }> = {
  PLANNED: { label: "Planejado", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  IN_PROGRESS: { label: "Em Progresso", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
  DONE: { label: "Concluído", className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  CANCELLED: { label: "Cancelado", className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
};

const STATUS_OPTIONS: RoadmapStatus[] = ["PLANNED", "IN_PROGRESS", "DONE", "CANCELLED"];

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
      label: cursor.toLocaleString("pt-BR", { month: "short", year: "2-digit" }),
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
      if (startIdx === -1) startIdx = i;
      endIdx = i;
    }
  }

  if (startIdx === -1) return null;
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
    if (!span) return <td key={col.key} className="relative border-r border-border/30 h-10 min-w-[80px]" />;

    if (colIdx === span.startIdx) {
      const colSpan = span.endIdx - span.startIdx + 1;
      return (
        <td
          key={col.key}
          colSpan={colSpan}
          className="relative h-10 px-1 py-1"
        >
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="h-full w-full rounded flex items-center px-2 cursor-default select-none min-w-0 overflow-hidden"
                  style={{ backgroundColor: item.color + "cc" }}
                >
                  <span className="text-xs font-medium text-white truncate drop-shadow-sm">
                    {item.title}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="font-semibold">{item.title}</p>
                {item.description && <p className="text-xs mt-0.5 opacity-80">{item.description}</p>}
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${statusCfg.className}`}>
                    {statusCfg.label}
                  </span>
                  {artName && <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{artName}</span>}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </td>
      );
    }

    // Cells consumed by the colSpan — skip
    if (span && colIdx > span.startIdx && colIdx <= span.endIdx) return null;

    return <td key={col.key} className="relative border-r border-border/30 h-10 min-w-[80px]" />;
  });

  return (
    <tr className="border-b border-border/50 hover:bg-muted/20 group">
      {/* Item info column */}
      <td className="py-2 px-3 border-r border-border w-52 shrink-0">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">{item.title}</p>
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              <span className={`text-xs px-1 py-0.5 rounded ${statusCfg.className}`}>
                {statusCfg.label}
              </span>
              {artName && (
                <span className="text-xs text-muted-foreground truncate">{artName}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 shrink-0"
            aria-label="Excluir item"
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
    startTransition(() => { void deleteRoadmapItem(id); });
  }

  async function handleCreate() {
    if (!form.title.trim() || !form.startDate || !form.endDate) return;

    const startDate = new Date(form.startDate);
    const endDate = new Date(form.endDate);
    if (endDate < startDate) return;

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

    setItems((prev) => [...prev, optimistic].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    ));
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
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FilterIcon className="h-4 w-4 text-muted-foreground" />
          {arts.length > 0 && (
            <Select value={filterArtId} onValueChange={setFilterArtId}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="Filtrar por ART" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ARTs</SelectItem>
                {arts.map((art) => (
                  <SelectItem key={art.id} value={art.id}>{art.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="ml-auto" onClick={() => setDialogOpen(true)}>
          <PlusIcon className="h-4 w-4 mr-1.5" /> Novo Item
        </Button>
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((s) => (
          <Badge key={s} variant="outline" className={`text-xs ${STATUS_CONFIG[s].className}`}>
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
            <p className="text-xs text-muted-foreground mt-1">
              Adicione épicos, features ou iniciativas ao roadmap para visualizar a linha do tempo.
            </p>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <PlusIcon className="h-4 w-4 mr-1.5" /> Adicionar item
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: `${52 + cols.length * 80}px` }}>
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {/* Item label column */}
                <th className="py-2 px-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground w-52 border-r border-border">
                  Item
                </th>
                {cols.map((col) => {
                  const isCurrentMonth =
                    col.year === new Date().getFullYear() &&
                    col.month === new Date().getMonth();
                  return (
                    <th
                      key={col.key}
                      className={[
                        "py-2 px-1 text-center text-xs font-medium uppercase tracking-wider border-r border-border/30 min-w-[80px]",
                        isCurrentMonth
                          ? "text-primary bg-primary/5"
                          : "text-muted-foreground",
                      ].join(" ")}
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
                  key={item.id}
                  item={item}
                  cols={cols}
                  artName={item.artId ? artMap.get(item.artId) : undefined}
                  epicTitle={item.epicId ? epicMap.get(item.epicId) : undefined}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Item no Roadmap</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1">
              <Label>Título</Label>
              <Input
                placeholder="Ex: Migração de plataforma"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label>Descrição (opcional)</Label>
              <Textarea
                placeholder="Detalhes do item..."
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Data de Início</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label>Data de Fim</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  min={form.startDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as RoadmapStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label>Cor</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="h-9 w-14 cursor-pointer rounded border border-border p-0.5"
                  />
                  <span className="text-xs font-mono text-muted-foreground">{form.color}</span>
                </div>
              </div>
            </div>
            {arts.length > 0 && (
              <div className="grid gap-1">
                <Label>ART (opcional)</Label>
                <Select
                  value={form.artId || "none"}
                  onValueChange={(v) => setForm({ ...form, artId: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {arts.map((art) => (
                      <SelectItem key={art.id} value={art.id}>{art.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {epics.length > 0 && (
              <div className="grid gap-1">
                <Label>Épico (opcional)</Label>
                <Select
                  value={form.epicId || "none"}
                  onValueChange={(v) => setForm({ ...form, epicId: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {epics.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isPending || !form.title.trim() || !form.startDate || !form.endDate}
            >
              Adicionar ao Roadmap
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
