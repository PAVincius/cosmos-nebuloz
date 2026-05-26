"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent } from "@repo/design-system/components/ui/card";
import { Input } from "@repo/design-system/components/ui/input";
import { Progress } from "@repo/design-system/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  ArrowUpRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useState, useTransition } from "react";
import {
  createKeyResult,
  deleteKeyResult,
  updateKeyResult,
  updateOKRStatus,
  type OKRWithContext,
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
  if (pct >= 80) {
    return "[&>div]:bg-emerald-500";
  }
  if (pct >= 50) {
    return "[&>div]:bg-amber-400";
  }
  return "[&>div]:bg-red-400";
}

type KeyResultRowProps = {
  okrId: string;
  kr: KeyResultWithProgress;
  onDeleteKeyResult: (okrId: string, krId: string) => void;
  onUpdateKRCurrent: (okrId: string, krId: string, current: number) => void;
};

function KeyResultRow({
  okrId,
  kr,
  onDeleteKeyResult,
  onUpdateKRCurrent,
}: KeyResultRowProps) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(String(kr.current));
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const newVal = Number.parseFloat(inputVal);
    if (Number.isNaN(newVal) || newVal === kr.current) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      await updateKeyResult(kr.id, { current: newVal });
      onUpdateKRCurrent(okrId, kr.id, newVal);
      setEditing(false);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleSave();
    }
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
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-medium text-xs">{kr.title}</p>
        <div className="flex items-center gap-2">
          <Progress
            className={`h-1 flex-1 ${progressBarColor(kr.progress)}`}
            value={kr.progress}
          />
          <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
            {kr.progress}%
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {editing ? (
          <>
            <Input
              autoFocus
              className="h-6 w-20 text-xs"
              disabled={isPending}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              step="any"
              type="number"
              value={inputVal}
            />
            <Button
              className="h-6 w-6 p-0"
              disabled={isPending}
              onClick={handleSave}
              size="sm"
              variant="ghost"
            >
              <CheckIcon className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <button
            className="cursor-pointer text-muted-foreground text-xs underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => {
              setInputVal(String(kr.current));
              setEditing(true);
            }}
            type="button"
          >
            {kr.current} / {kr.target} {kr.unit}
          </button>
        )}

        <Button
          className="h-6 w-6 p-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          disabled={isPending}
          onClick={handleDelete}
          size="sm"
          variant="ghost"
        >
          <Trash2Icon className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

type AddKeyResultRowProps = {
  okrId: string;
  onAddKeyResult: (okrId: string, kr: KeyResultWithProgress) => void;
};

function AddKeyResultRow({ okrId, onAddKeyResult }: AddKeyResultRowProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    if (!title.trim()) {
      return;
    }
    startTransition(async () => {
      const newKR = await createKeyResult({
        okrId,
        title: title.trim(),
        target: Number.parseFloat(target) || 100,
        unit: unit.trim() || "%",
        current: 0,
      });
      if (newKR && "data" in newKR && newKR.data) {
        onAddKeyResult(okrId, newKR.data);
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
        className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted/50 hover:text-foreground"
        onClick={() => setOpen(true)}
        type="button"
      >
        <PlusIcon className="h-3 w-3" />
        Key Result
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-md bg-muted/30 px-2 py-1.5">
      <Input
        autoFocus
        className="h-7 flex-1 text-xs"
        disabled={isPending}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleAdd();
          }
          if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Título do KR"
        value={title}
      />
      <Input
        className="h-7 w-16 text-xs"
        disabled={isPending}
        onChange={(e) => setTarget(e.target.value)}
        placeholder="Meta"
        type="number"
        value={target}
      />
      <Input
        className="h-7 w-16 text-xs"
        disabled={isPending}
        onChange={(e) => setUnit(e.target.value)}
        placeholder="Unidade"
        value={unit}
      />
      <Button
        className="h-7 px-2 text-xs"
        disabled={isPending || !title.trim()}
        onClick={handleAdd}
        size="sm"
        variant="ghost"
      >
        <CheckIcon className="h-3 w-3" />
      </Button>
      <Button
        className="h-7 px-2 text-xs"
        disabled={isPending}
        onClick={() => setOpen(false)}
        size="sm"
        variant="ghost"
      >
        <Trash2Icon className="h-3 w-3" />
      </Button>
    </div>
  );
}

type OKRCardV2Props = {
  okr: OKRWithContext;
  compact?: boolean;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: OKRStatus) => void;
  onAddKeyResult: (okrId: string, kr: KeyResultWithProgress) => void;
  onDeleteKeyResult: (okrId: string, krId: string) => void;
  onUpdateKRCurrent: (okrId: string, krId: string, current: number) => void;
  onOpenDetail: (okr: OKRWithContext) => void;
  onCheckIn: (okr: OKRWithContext) => void;
};

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
      await updateOKRStatus(okr.id, newStatus);
      onStatusChange(okr.id, newStatus);
    });
  }

  function handleDelete() {
    startTransition(() => {
      onDelete(okr.id);
    });
  }

  return (
    <Card className="border border-border/80 bg-card transition-colors hover:border-border">
      <CardContent className="space-y-2 p-3">
        {/* Header row */}
        {!compact && (
          <div className="flex items-center justify-between">
            <button
              aria-label={expanded ? "Recolher KRs" : "Expandir KRs"}
              className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setExpanded((p) => !p)}
              type="button"
            >
              {expanded ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
              <span className="text-muted-foreground text-xs">
                {okr.keyResults.length} KR
                {okr.keyResults.length !== 1 ? "s" : ""}
              </span>
            </button>
            <button
              aria-label="Ver detalhes"
              className="flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
              onClick={() => onOpenDetail(okr)}
              type="button"
            >
              <ArrowUpRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* SAFe chips row */}
        <div className="flex flex-wrap items-center gap-1.5">
          {typeCfg ? (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium text-xs leading-none">
              {typeCfg.label}
            </span>
          ) : null}
          {okr.themeTitle ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 font-medium text-xs leading-none"
              style={
                okr.themeColor
                  ? { borderLeft: `3px solid ${okr.themeColor}` }
                  : undefined
              }
            >
              {okr.themeTitle}
            </span>
          ) : null}
          {okr.horizon ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs leading-none">
              {okr.horizon}
            </span>
          ) : null}
          {compact ? (
            <button
              aria-label="Ver detalhes"
              className="ml-auto text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => onOpenDetail(okr)}
              type="button"
            >
              <ArrowUpRightIcon className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {/* Title row */}
        <div className="flex items-start gap-2">
          <p
            className={`flex-1 font-medium text-sm leading-snug ${compact ? "truncate" : ""}`}
          >
            {okr.title}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <Select
              disabled={isPending}
              onValueChange={handleStatusChange}
              value={okr.status}
            >
              <SelectTrigger className="h-6 w-auto gap-1 border-0 bg-transparent px-1 text-xs focus:ring-0">
                <SelectValue>
                  {statusCfg ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${statusCfg.cls}`}
                    >
                      {statusCfg.label}
                    </span>
                  ) : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_CONFIG) as OKRStatus[]).map((key) => (
                  <SelectItem className="text-xs" key={key} value={key}>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_CONFIG[key].cls}`}
                    >
                      {STATUS_CONFIG[key].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              aria-label="Excluir OKR"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              disabled={isPending}
              onClick={handleDelete}
              size="sm"
              variant="ghost"
            >
              <Trash2Icon className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Progress row */}
        <div className="flex items-center gap-2">
          <Progress
            className={`h-1.5 flex-1 ${progressBarColor(okr.progress)}`}
            value={okr.progress}
          />
          <span className="shrink-0 font-semibold text-xs tabular-nums">
            {okr.progress}%
          </span>
          <Button
            className="h-6 shrink-0 gap-1 px-2 text-xs"
            onClick={() => onCheckIn(okr)}
            size="sm"
            variant="outline"
          >
            <ClipboardCheckIcon className="h-3 w-3" />
            Check-in
          </Button>
        </div>

        {/* Expanded KR section */}
        {!compact && expanded && (
          <div className="space-y-0.5 border-border/40 border-t pt-1">
            {okr.keyResults.map((kr) => (
              <KeyResultRow
                key={kr.id}
                kr={kr}
                okrId={okr.id}
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
