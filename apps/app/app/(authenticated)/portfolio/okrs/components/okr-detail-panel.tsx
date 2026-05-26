"use client";

import { useState, useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
  SheetFooter,
} from "@repo/design-system/components/ui/sheet";
import { Button } from "@repo/design-system/components/ui/button";
import { Progress } from "@repo/design-system/components/ui/progress";
import { Input } from "@repo/design-system/components/ui/input";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  XIcon,
  ClipboardCheckIcon,
  TrendingUpIcon,
  TargetIcon,
} from "lucide-react";
import { updateKeyResult, type OKRWithContext } from "@/app/actions/okrs";

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
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    new Date(date)
  );
}

function progressColor(pct: number): string {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-400";
  return "bg-red-400";
}

interface InlineEditKRProps {
  okrId: string;
  kr: KeyResultWithProgress;
  onUpdateKRCurrent: (okrId: string, krId: string, current: number) => void;
}

function InlineEditKR({ okrId, kr, onUpdateKRCurrent }: InlineEditKRProps) {
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
      await updateKeyResult(kr.id, { current: newVal });
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

  return (
    <div className="space-y-2 rounded-lg border border-border/60 p-3 bg-muted/20">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug flex-1">{kr.title}</p>
        {(kr.metric || kr.dataSource) && (
          <span className="text-xs text-muted-foreground shrink-0">
            {kr.metric ?? kr.dataSource}
          </span>
        )}
      </div>

      {kr.baseline != null && (
        <p className="text-xs text-muted-foreground">
          Baseline: <span className="font-medium">{kr.baseline} {kr.unit}</span>
        </p>
      )}

      <div className="flex items-center gap-2">
        {editing ? (
          <div className="flex items-center gap-1.5 flex-1">
            <Input
              autoFocus
              type="number"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isPending}
              className="h-7 text-xs w-24"
              step="any"
            />
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleSave} disabled={isPending}>
              {isPending ? "…" : "OK"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => { setInputVal(String(kr.current)); setEditing(false); }}
              disabled={isPending}
            >
              <XIcon className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer underline-offset-2 hover:underline"
            onClick={() => { setInputVal(String(kr.current)); setEditing(true); }}
          >
            <span className="font-semibold text-foreground">{kr.current}</span>
            {" "}
            <span>{kr.unit}</span>
          </button>
        )}
        <span className="text-xs text-muted-foreground">→</span>
        <span className="text-xs font-medium">
          {kr.target} {kr.unit}
        </span>
        <span className="ml-auto text-xs font-semibold tabular-nums">{kr.progress}%</span>
      </div>

      <Progress value={kr.progress} className="h-1" />
    </div>
  );
}

interface SnapshotMiniChartProps {
  kr: KeyResultWithProgress;
}

function SnapshotMiniChart({ kr }: SnapshotMiniChartProps) {
  const snapshots = (kr.snapshots ?? []).slice(-6);
  if (snapshots.length === 0) return null;
  const lastNote = snapshots[snapshots.length - 1]?.note;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground truncate">{kr.title}</p>
      <div className="flex items-end gap-1 h-8">
        {snapshots.map((snap) => {
          const pct = kr.target > 0 ? Math.min(100, Math.round((snap.value / kr.target) * 100)) : 0;
          return (
            <div key={snap.id} className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
              <span className="text-[10px] text-muted-foreground tabular-nums leading-none">
                {pct}%
              </span>
              <div className="w-full rounded-sm overflow-hidden bg-muted" style={{ height: "18px" }}>
                <div
                  className={`w-full rounded-sm transition-all ${progressColor(pct)}`}
                  style={{ height: `${Math.max(10, pct)}%` }}
                />
              </div>
              <span className="text-[9px] text-muted-foreground truncate w-full text-center leading-none">
                {formatDate(snap.recordedAt)}
              </span>
            </div>
          );
        })}
      </div>
      {lastNote && (
        <p className="text-xs text-muted-foreground italic truncate">"{lastNote}"</p>
      )}
    </div>
  );
}

interface OKRDetailPanelProps {
  okr: OKRWithContext | null;
  open: boolean;
  onClose: () => void;
  onCheckIn: (okr: OKRWithContext) => void;
  onUpdateKRCurrent: (okrId: string, krId: string, current: number) => void;
}

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
  const krsWithSnapshots = okr?.keyResults.filter(
    (kr) => kr.snapshots && kr.snapshots.length > 0
  ) ?? [];

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        className="w-[480px] sm:w-[520px] flex flex-col p-0 gap-0"
      >
        {okr && (
          <>
            <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/60 space-y-3">
              {/* Breadcrumb chips */}
              <div className="flex items-center gap-2 flex-wrap">
                {typeCfg && (
                  <span className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2.5 py-0.5 font-medium">
                    <span>{typeCfg.icon}</span>
                    <span>{typeCfg.label}</span>
                  </span>
                )}
                {okr.themeTitle && (
                  <span
                    className="inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-0.5 font-medium bg-muted"
                    style={okr.themeColor ? { borderLeft: `3px solid ${okr.themeColor}` } : undefined}
                  >
                    {okr.themeTitle}
                  </span>
                )}
              </div>

              <div className="flex items-start justify-between gap-3">
                <SheetTitle className="text-base font-semibold leading-snug">
                  {okr.title}
                </SheetTitle>
                <SheetClose asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 -mt-1">
                    <XIcon className="h-4 w-4" />
                    <span className="sr-only">Fechar</span>
                  </Button>
                </SheetClose>
              </div>

              <SheetDescription className="sr-only">
                Detalhes do OKR: {okr.title}
              </SheetDescription>

              {/* Status + Horizon */}
              <div className="flex items-center gap-2 flex-wrap">
                {statusCfg && (
                  <Badge className={`text-xs font-medium border-0 ${statusCfg.cls}`}>
                    {statusCfg.label}
                  </Badge>
                )}
                {okr.horizon && (
                  <Badge variant="outline" className="text-xs">
                    {okr.horizon}
                  </Badge>
                )}
              </div>

              {/* Overall progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <TrendingUpIcon className="h-3 w-3" />
                    Progresso geral
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">{okr.progress}%</span>
                </div>
                <Progress value={okr.progress} className="h-2" />
              </div>
            </SheetHeader>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              {/* Key Results section */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <TargetIcon className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Key Results</h3>
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {okr.keyResults.length}
                  </Badge>
                </div>
                {okr.keyResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum Key Result cadastrado.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {okr.keyResults.map((kr) => (
                      <InlineEditKR
                        key={kr.id}
                        okrId={okr.id}
                        kr={kr}
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
                    <h3 className="text-sm font-semibold">Histórico de Check-ins</h3>
                  </div>
                  <div className="space-y-4">
                    {krsWithSnapshots.map((kr) => (
                      <div key={kr.id} className="rounded-lg border border-border/60 p-3 bg-muted/20">
                        <SnapshotMiniChart kr={kr} />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Footer */}
            <SheetFooter className="px-5 py-4 border-t border-border/60">
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
