"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Progress } from "@repo/design-system/components/ui/progress";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import {
  ClipboardCheckIcon,
  TargetIcon,
  TrendingUpIcon,
  XIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { type OKRWithContext, updateKeyResult } from "@/app/actions/okrs";

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

type OKRStatus = "ON_TRACK" | "AT_RISK" | "BEHIND" | "ACHIEVED";

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

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(date));
}

function progressColor(pct: number): string {
  if (pct >= 80) {
    return "bg-emerald-500";
  }
  if (pct >= 50) {
    return "bg-amber-400";
  }
  return "bg-red-400";
}

type InlineEditKRProps = {
  okrId: string;
  kr: KeyResultWithProgress;
  onUpdateKRCurrent: (okrId: string, krId: string, current: number) => void;
};

function InlineEditKR({ okrId, kr, onUpdateKRCurrent }: InlineEditKRProps) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(String(kr.current));
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const newVal = Number.parseFloat(inputVal);
    if (isNaN(newVal) || newVal === kr.current) {
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

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="flex-1 font-medium text-sm leading-snug">{kr.title}</p>
        {(kr.metric || kr.dataSource) && (
          <span className="shrink-0 text-muted-foreground text-xs">
            {kr.metric ?? kr.dataSource}
          </span>
        )}
      </div>

      {kr.baseline != null && (
        <p className="text-muted-foreground text-xs">
          Baseline:{" "}
          <span className="font-medium">
            {kr.baseline} {kr.unit}
          </span>
        </p>
      )}

      <div className="flex items-center gap-2">
        {editing ? (
          <div className="flex flex-1 items-center gap-1.5">
            <Input
              autoFocus
              className="h-7 w-24 text-xs"
              disabled={isPending}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              step="any"
              type="number"
              value={inputVal}
            />
            <Button
              className="h-7 px-2 text-xs"
              disabled={isPending}
              onClick={handleSave}
              size="sm"
              variant="ghost"
            >
              {isPending ? "…" : "OK"}
            </Button>
            <Button
              className="h-7 px-2 text-xs"
              disabled={isPending}
              onClick={() => {
                setInputVal(String(kr.current));
                setEditing(false);
              }}
              size="sm"
              variant="ghost"
            >
              <XIcon className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <button
            className="cursor-pointer text-muted-foreground text-xs underline-offset-2 transition-colors hover:text-foreground hover:underline"
            onClick={() => {
              setInputVal(String(kr.current));
              setEditing(true);
            }}
            type="button"
          >
            <span className="font-semibold text-foreground">{kr.current}</span>{" "}
            <span>{kr.unit}</span>
          </button>
        )}
        <span className="text-muted-foreground text-xs">→</span>
        <span className="font-medium text-xs">
          {kr.target} {kr.unit}
        </span>
        <span className="ml-auto font-semibold text-xs tabular-nums">
          {kr.progress}%
        </span>
      </div>

      <Progress className="h-1" value={kr.progress} />
    </div>
  );
}

type SnapshotMiniChartProps = {
  kr: KeyResultWithProgress;
};

function SnapshotMiniChart({ kr }: SnapshotMiniChartProps) {
  const snapshots = (kr.snapshots ?? []).slice(-6);
  if (snapshots.length === 0) {
    return null;
  }
  const lastNote = snapshots.at(-1)?.note;

  return (
    <div className="space-y-1.5">
      <p className="truncate font-medium text-muted-foreground text-xs">
        {kr.title}
      </p>
      <div className="flex h-8 items-end gap-1">
        {snapshots.map((snap) => {
          const pct =
            kr.target > 0
              ? Math.min(100, Math.round((snap.value / kr.target) * 100))
              : 0;
          return (
            <div
              className="flex min-w-0 flex-1 flex-col items-center gap-0.5"
              key={snap.id}
            >
              <span className="text-[10px] text-muted-foreground tabular-nums leading-none">
                {pct}%
              </span>
              <div
                className="w-full overflow-hidden rounded-sm bg-muted"
                style={{ height: "18px" }}
              >
                <div
                  className={`w-full rounded-sm transition-all ${progressColor(pct)}`}
                  style={{ height: `${Math.max(10, pct)}%` }}
                />
              </div>
              <span className="w-full truncate text-center text-[9px] text-muted-foreground leading-none">
                {formatDate(snap.recordedAt)}
              </span>
            </div>
          );
        })}
      </div>
      {lastNote && (
        <p className="truncate text-muted-foreground text-xs italic">
          "{lastNote}"
        </p>
      )}
    </div>
  );
}

type OKRDetailPanelProps = {
  okr: OKRWithContext | null;
  open: boolean;
  onClose: () => void;
  onCheckIn: (okr: OKRWithContext) => void;
  onUpdateKRCurrent: (okrId: string, krId: string, current: number) => void;
};

export function OKRDetailPanel({
  okr,
  open,
  onClose,
  onCheckIn,
  onUpdateKRCurrent,
}: OKRDetailPanelProps) {
  const statusKey = okr?.status as OKRStatus | undefined;
  const statusCfg = statusKey ? STATUS_CONFIG[statusKey] : undefined;
  const typeCfg = okr ? TYPE_CONFIG[okr.type] : undefined;
  const krsWithSnapshots =
    okr?.keyResults.filter((kr) => kr.snapshots && kr.snapshots.length > 0) ??
    [];

  return (
    <Sheet
      onOpenChange={(o) => {
        if (!o) {
          onClose();
        }
      }}
      open={open}
    >
      <SheetContent
        className="flex w-[480px] flex-col gap-0 p-0 sm:w-[520px]"
        side="right"
      >
        {okr && (
          <>
            <SheetHeader className="space-y-3 border-border/60 border-b px-5 pt-5 pb-4">
              {/* Breadcrumb chips */}
              <div className="flex flex-wrap items-center gap-2">
                {typeCfg && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 font-medium text-xs">
                    <span>{typeCfg.icon}</span>
                    <span>{typeCfg.label}</span>
                  </span>
                )}
                {okr.themeTitle && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 font-medium text-xs"
                    style={
                      okr.themeColor
                        ? { borderLeft: `3px solid ${okr.themeColor}` }
                        : undefined
                    }
                  >
                    {okr.themeTitle}
                  </span>
                )}
              </div>

              <div className="flex items-start justify-between gap-3">
                <SheetTitle className="font-semibold text-base leading-snug">
                  {okr.title}
                </SheetTitle>
                <SheetClose asChild>
                  <Button
                    className="-mt-1 h-8 w-8 shrink-0"
                    size="icon"
                    variant="ghost"
                  >
                    <XIcon className="h-4 w-4" />
                    <span className="sr-only">Fechar</span>
                  </Button>
                </SheetClose>
              </div>

              <SheetDescription className="sr-only">
                Detalhes do OKR: {okr.title}
              </SheetDescription>

              {/* Status + Horizon */}
              <div className="flex flex-wrap items-center gap-2">
                {statusCfg && (
                  <Badge
                    className={`border-0 font-medium text-xs ${statusCfg.cls}`}
                  >
                    {statusCfg.label}
                  </Badge>
                )}
                {okr.horizon && (
                  <Badge className="text-xs" variant="outline">
                    {okr.horizon}
                  </Badge>
                )}
              </div>

              {/* Overall progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span className="flex items-center gap-1">
                    <TrendingUpIcon className="h-3 w-3" />
                    Progresso geral
                  </span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {okr.progress}%
                  </span>
                </div>
                <Progress className="h-2" value={okr.progress} />
              </div>
            </SheetHeader>

            {/* Scrollable body */}
            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
              {/* Key Results section */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <TargetIcon className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Key Results</h3>
                  <Badge className="ml-auto text-xs" variant="secondary">
                    {okr.keyResults.length}
                  </Badge>
                </div>
                {okr.keyResults.length === 0 ? (
                  <p className="py-4 text-center text-muted-foreground text-sm">
                    Nenhum Key Result cadastrado.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {okr.keyResults.map((kr) => (
                      <InlineEditKR
                        key={kr.id}
                        kr={kr}
                        okrId={okr.id}
                        onUpdateKRCurrent={onUpdateKRCurrent}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Histórico de Check-ins */}
              {krsWithSnapshots.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ClipboardCheckIcon className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-sm">
                      Histórico de Check-ins
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {krsWithSnapshots.map((kr) => (
                      <div
                        className="rounded-lg border border-border/60 bg-muted/20 p-3"
                        key={kr.id}
                      >
                        <SnapshotMiniChart kr={kr} />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Footer */}
            <SheetFooter className="border-border/60 border-t px-5 py-4">
              <Button className="w-full gap-2" onClick={() => onCheckIn(okr)}>
                <ClipboardCheckIcon className="h-4 w-4" />
                Registrar Check-in
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
