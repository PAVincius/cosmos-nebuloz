"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@repo/design-system/components/ui/card";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Progress } from "@repo/design-system/components/ui/progress";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ArrowUpRightIcon,
  Trash2Icon,
  PlusIcon,
  CheckIcon,
  ClipboardCheckIcon,
} from "lucide-react";
import {
  createKeyResult,
  deleteKeyResult,
  updateKeyResult,
  updateOKRStatus,
} from "@/app/actions/okrs";

type OKRStatus = "ON_TRACK" | "AT_RISK" | "BEHIND" | "ACHIEVED";

type KeyResultSnapshotItem = {
  id: string;
  keyResultId: string;
  value: number;
  note: string | null;
  recordedAt: Date;
};

type KeyResultWithProgress = {
  id: string;
  title: string;
  current: number;
  target: number;
  unit: string;
  metric?: string | null;
  baseline?: number | null;
  measurementType?: string | null;
  dataSource?: string | null;
  dueDate?: Date | null;
  progress: number;
  snapshots?: KeyResultSnapshotItem[];
};

type OKRWithContext = {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  status: string;
  piPlanId?: string | null;
  strategicThemeId?: string | null;
  epicId?: string | null;
  artId?: string | null;
  teamId?: string | null;
  horizon?: string | null;
  ownerId?: string | null;
  themeTitle: string | null;
  themeColor: string | null;
  keyResults: KeyResultWithProgress[];
  progress: number;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
};

const STATUS_CONFIG: Record<OKRStatus, { label: string; cls: string }> = {
  ON_TRACK: {
    label: "No Prazo",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  AT_RISK: {
    label: "Em Risco",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  BEHIND: {
    label: "Atrasado",
    cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
  ACHIEVED: {
    label: "Alcançado",
    cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  },
};

const TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  portfolio_theme: { label: "Tema", icon: "🎯" },
  portfolio_epic: { label: "Épico", icon: "🏔" },
  pi_art: { label: "PI / ART", icon: "🔄" },
  team_pi: { label: "Time / PI", icon: "👥" },
  improvement: { label: "Melhoria", icon: "⬆" },
};

function progressBarColor(pct: number): string {
  if (pct >= 80) return "[&>div]:bg-emerald-500";
  if (pct >= 50) return "[&>div]:bg-amber-400";
  return "[&>div]:bg-red-400";
}

interface KeyResultRowProps {
  okrId: string;
  kr: KeyResultWithProgress;
  onDeleteKeyResult: (okrId: string, krId: string) => void;
  onUpdateKRCurrent: (okrId: string, krId: string, current: number) => void;
}

function KeyResultRow({ okrId, kr, onDeleteKeyResult, onUpdateKRCurrent }: KeyResultRowProps) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(String(kr.current));
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const newVal = parseFloat(inputVal);
    if (isNaN(newVal) || newVal === kr.current) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      await updateKeyResult({ id: kr.id, current: newVal });
      onUpdateKRCurrent(okrId, kr.id, newVal);
      setEditing(false);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setInputVal(String(kr.current));
      setEditing(false);
    }
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteKeyResult(kr.id);
      onDeleteKeyResult(okrId, kr.id);
    });
  }

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group">
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-xs font-medium truncate">{kr.title}</p>
        <div className="flex items-center gap-2">
          <Progress
            value={kr.progress}
            className={`h-1 flex-1 ${progressBarColor(kr.progress)}`}
          />
          <span className="text-xs tabular-nums text-muted-foreground shrink-0">{kr.progress}%</span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {editing ? (
          <>
            <Input
              autoFocus
              type="number"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isPending}
              className="h-6 w-20 text-xs"
              step="any"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={handleSave}
              disabled={isPending}
            >
              <CheckIcon className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer hover:underline underline-offset-2"
            onClick={() => { setInputVal(String(kr.current)); setEditing(true); }}
          >
            {kr.current} / {kr.target} {kr.unit}
          </button>
        )}

        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
          disabled={isPending}
        >
          <Trash2Icon className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

interface AddKeyResultRowProps {
  okrId: string;
  onAddKeyResult: (okrId: string, kr: KeyResultWithProgress) => void;
}

function AddKeyResultRow({ okrId, onAddKeyResult }: AddKeyResultRowProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    if (!title.trim()) return;
    startTransition(async () => {
      const newKR = await createKeyResult({
        okrId,
        title: title.trim(),
        target: parseFloat(target) || 100,
        unit: unit.trim() || "%",
        current: 0,
      });
      if (newKR) {
        onAddKeyResult(okrId, newKR as KeyResultWithProgress);
      }
      setTitle("");
      setTarget("");
      setUnit("");
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-md hover:bg-muted/50 w-full"
        onClick={() => setOpen(true)}
      >
        <PlusIcon className="h-3 w-3" />
        Key Result
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-muted/30 rounded-md">
      <Input
        autoFocus
        placeholder="Título do KR"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setOpen(false); }}
        disabled={isPending}
        className="h-7 text-xs flex-1"
      />
      <Input
        placeholder="Meta"
        type="number"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        disabled={isPending}
        className="h-7 text-xs w-16"
      />
      <Input
        placeholder="Unidade"
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        disabled={isPending}
        className="h-7 text-xs w-16"
      />
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleAdd} disabled={isPending || !title.trim()}>
        <CheckIcon className="h-3 w-3" />
      </Button>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setOpen(false)} disabled={isPending}>
        <Trash2Icon className="h-3 w-3" />
      </Button>
    </div>
  );
}

interface OKRCardV2Props {
  okr: OKRWithContext;
  compact?: boolean;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: OKRStatus) => void;
  onAddKeyResult: (okrId: string, kr: KeyResultWithProgress) => void;
  onDeleteKeyResult: (okrId: string, krId: string) => void;
  onUpdateKRCurrent: (okrId: string, krId: string, current: number) => void;
  onOpenDetail: (okr: OKRWithContext) => void;
  onCheckIn: (okr: OKRWithContext) => void;
}

export function OKRCardV2({
  okr,
  compact = false,
  onDelete,
  onStatusChange,
  onAddKeyResult,
  onDeleteKeyResult,
  onUpdateKRCurrent,
  onOpenDetail,
  onCheckIn,
}: OKRCardV2Props) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const statusKey = okr.status as OKRStatus;
  const statusCfg = STATUS_CONFIG[statusKey];
  const typeCfg = TYPE_CONFIG[okr.type];

  function handleStatusChange(value: string) {
    const newStatus = value as OKRStatus;
    startTransition(async () => {
      await updateOKRStatus({ id: okr.id, status: newStatus });
      onStatusChange(okr.id, newStatus);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      onDelete(okr.id);
    });
  }

  return (
    <Card className="border border-border/80 bg-card hover:border-border transition-colors">
      <CardContent className="p-3 space-y-2">
        {/* Header row */}
        {!compact && (
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setExpanded((p) => !p)}
              aria-label={expanded ? "Recolher KRs" : "Expandir KRs"}
            >
              {expanded ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
              <span className="text-xs text-muted-foreground">
                {okr.keyResults.length} KR{okr.keyResults.length !== 1 ? "s" : ""}
              </span>
            </button>
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => onOpenDetail(okr)}
              aria-label="Ver detalhes"
            >
              <ArrowUpRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* SAFe chips row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {typeCfg && (
            <span className="inline-flex items-center text-xs bg-muted rounded-full px-2 py-0.5 font-medium leading-none">
              {typeCfg.label}
            </span>
          )}
          {okr.themeTitle && (
            <span
              className="inline-flex items-center gap-1.5 text-xs rounded-full px-2 py-0.5 font-medium bg-muted leading-none"
              style={okr.themeColor ? { borderLeft: `3px solid ${okr.themeColor}` } : undefined}
            >
              {okr.themeTitle}
            </span>
          )}
          {okr.horizon && (
            <span className="text-xs bg-muted rounded-full px-2 py-0.5 text-muted-foreground leading-none">
              {okr.horizon}
            </span>
          )}
          {compact && (
            <button
              type="button"
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => onOpenDetail(okr)}
              aria-label="Ver detalhes"
            >
              <ArrowUpRightIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Title row */}
        <div className="flex items-start gap-2">
          <p className={`text-sm font-medium flex-1 leading-snug ${compact ? "truncate" : ""}`}>
            {okr.title}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <Select value={okr.status} onValueChange={handleStatusChange} disabled={isPending}>
              <SelectTrigger className="h-6 text-xs border-0 bg-transparent px-1 w-auto gap-1 focus:ring-0">
                <SelectValue>
                  {statusCfg && (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.cls}`}>
                      {statusCfg.label}
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_CONFIG) as OKRStatus[]).map((key) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CONFIG[key].cls}`}>
                      {STATUS_CONFIG[key].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              disabled={isPending}
              aria-label="Excluir OKR"
            >
              <Trash2Icon className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Progress row */}
        <div className="flex items-center gap-2">
          <Progress
            value={okr.progress}
            className={`h-1.5 flex-1 ${progressBarColor(okr.progress)}`}
          />
          <span className="text-xs font-semibold tabular-nums shrink-0">{okr.progress}%</span>
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs gap-1 shrink-0"
            onClick={() => onCheckIn(okr)}
          >
            <ClipboardCheckIcon className="h-3 w-3" />
            Check-in
          </Button>
        </div>

        {/* Expanded KR section */}
        {!compact && expanded && (
          <div className="pt-1 border-t border-border/40 space-y-0.5">
            {okr.keyResults.map((kr) => (
              <KeyResultRow
                key={kr.id}
                okrId={okr.id}
                kr={kr}
                onDeleteKeyResult={onDeleteKeyResult}
                onUpdateKRCurrent={onUpdateKRCurrent}
              />
            ))}
            <AddKeyResultRow okrId={okr.id} onAddKeyResult={onAddKeyResult} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
