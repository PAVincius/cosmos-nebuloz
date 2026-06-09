"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { cn } from "@repo/design-system/lib/utils";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { DependencyWithFeatures } from "@/app/actions/dependencies";
import {
  createDependency,
  deleteDependency,
  updateDependencyStatus,
} from "@/app/actions/dependencies";

type Epic = {
  id: string;
  title: string;
  features: { id: string; title: string; statusId: string }[];
};

type DependencyStatus =
  | "blocked"
  | "at-risk"
  | "on-track"
  | "completed"
  | "not-started";
type DependencySeverity = "critical" | "high" | "medium" | "low";

const STATUS_COLORS: Record<string, string> = {
  blocked: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-400/40",
  "at-risk":
    "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-400/40",
  "on-track":
    "bg-green-500/20 text-green-600 dark:text-green-400 border-green-400/40",
  completed:
    "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-400/40",
  "not-started": "bg-muted/50 text-muted-foreground border-border",
};

const STATUS_ICON: Record<string, React.ElementType> = {
  blocked: AlertCircleIcon,
  "at-risk": AlertTriangleIcon,
  "on-track": CheckCircleIcon,
  completed: CheckCircleIcon,
  "not-started": ClockIcon,
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

const STATUS_OPTIONS = [
  "not-started",
  "on-track",
  "at-risk",
  "blocked",
  "completed",
] as const;
const TYPE_OPTIONS = [
  "technical",
  "business",
  "organizational",
  "external",
] as const;
const SEVERITY_OPTIONS = ["critical", "high", "medium", "low"] as const;

function getEpicDependencies(
  deps: DependencyWithFeatures[],
  fromEpicId: string,
  toEpicId: string
) {
  return deps.filter(
    (d) =>
      d.blockingFeature.epicId === fromEpicId &&
      d.blockedFeature.epicId === toEpicId
  );
}

function getWorstStatus(deps: DependencyWithFeatures[]): string {
  const priority = [
    "blocked",
    "at-risk",
    "not-started",
    "on-track",
    "completed",
  ];
  const statuses = deps.map((d) => d.status);
  for (const s of priority) {
    if (statuses.includes(s)) {
      return s;
    }
  }
  return "not-started";
}

export function DependencyDashboard({
  dependencies,
  epics,
}: {
  dependencies: DependencyWithFeatures[];
  epics: Epic[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<"matrix" | "list">("matrix");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedDeps, setSelectedDeps] = useState<
    DependencyWithFeatures[] | null
  >(null);
  const [form, setForm] = useState({
    blockingFeatureId: "",
    blockedFeatureId: "",
    description: "",
    status: "not-started" as const,
    type: "technical" as const,
    severity: "medium" as const,
  });

  const allFeatures = epics.flatMap((e) =>
    e.features.map((f) => ({ ...f, epicTitle: e.title }))
  );

  function handleCellClick(fromEpicId: string, toEpicId: string) {
    const cellDeps = getEpicDependencies(dependencies, fromEpicId, toEpicId);
    if (cellDeps.length > 0) {
      setSelectedDeps(cellDeps);
    }
  }

  function handleAdd() {
    startTransition(async () => {
      await createDependency(form);
      setAddOpen(false);
      setForm({
        blockingFeatureId: "",
        blockedFeatureId: "",
        description: "",
        status: "not-started",
        type: "technical",
        severity: "medium",
      });
      router.refresh();
    });
  }

  function handleUpdateStatus(id: string, status: string) {
    startTransition(async () => {
      await updateDependencyStatus(id, status);
      router.refresh();
      setSelectedDeps(null);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteDependency(id);
      router.refresh();
      setSelectedDeps((prev) => prev?.filter((d) => d.id !== id) ?? null);
    });
  }

  const summaryStats = {
    total: dependencies.length,
    blocked: dependencies.filter((d) => d.status === "blocked").length,
    atRisk: dependencies.filter((d) => d.status === "at-risk").length,
    critical: dependencies.filter((d) => d.severity === "critical").length,
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Total",
            value: summaryStats.total,
            color: "text-foreground",
          },
          {
            label: "Bloqueadas",
            value: summaryStats.blocked,
            color: "text-red-500 dark:text-red-400",
          },
          {
            label: "Em Risco",
            value: summaryStats.atRisk,
            color: "text-amber-500 dark:text-amber-400",
          },
          {
            label: "Críticas",
            value: summaryStats.critical,
            color: "text-red-600 dark:text-red-400",
          },
        ].map((s) => (
          <div
            className="hover:-translate-y-0.5 rounded-xl border border-hairline bg-surface p-4 shadow-[var(--card-shadow)] transition-[transform,box-shadow,border-color] duration-200 hover:border-primary/40 hover:shadow-[var(--hover-shadow)]"
            key={s.label}
          >
            <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              {s.label}
            </p>
            <p
              className={`font-bold text-3xl tabular-nums tracking-tight ${s.color}`}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex overflow-hidden rounded-lg border">
          {(["matrix", "list"] as const).map((t) => (
            <button
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
              key={t}
              onClick={() => setTab(t)}
              type="button"
            >
              {t === "matrix" ? "Matriz" : "Lista"}
            </button>
          ))}
        </div>
        <Button onClick={() => setAddOpen(true)} size="sm">
          <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
          Nova dependência
        </Button>
      </div>

      {/* Matrix view */}
      {tab === "matrix" && (
        <div className="overflow-auto rounded-lg border">
          <div className="min-w-max p-4">
            <div className="flex">
              <div className="flex h-12 w-44 items-end justify-end pr-3 pb-2 font-medium text-muted-foreground text-xs">
                Épico (dependente ↓)
              </div>
              {epics.map((e) => (
                <div
                  className="flex h-12 w-14 items-end justify-center pb-2"
                  key={e.id}
                  style={{
                    writingMode: "vertical-rl",
                    transform: "rotate(180deg)",
                  }}
                >
                  <span className="max-w-[44px] truncate font-medium text-xs">
                    {e.title}
                  </span>
                </div>
              ))}
            </div>
            {epics.map((rowEpic) => (
              <div className="flex" key={rowEpic.id}>
                <div className="flex h-12 w-44 items-center truncate pr-3 font-medium text-xs">
                  {rowEpic.title}
                </div>
                {epics.map((colEpic) => {
                  if (rowEpic.id === colEpic.id) {
                    return (
                      <div
                        className="flex h-12 w-14 items-center justify-center p-1"
                        key={colEpic.id}
                      >
                        <div className="h-10 w-10 rounded-md bg-muted/30" />
                      </div>
                    );
                  }
                  const cellDeps = getEpicDependencies(
                    dependencies,
                    rowEpic.id,
                    colEpic.id
                  );
                  const status =
                    cellDeps.length > 0 ? getWorstStatus(cellDeps) : null;
                  const Icon = status ? STATUS_ICON[status] : null;

                  return (
                    <div
                      className="flex h-12 w-14 items-center justify-center p-1"
                      key={colEpic.id}
                    >
                      <button
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-md border-2 border-dashed text-xs transition-all",
                          status
                            ? `${STATUS_COLORS[status]} cursor-pointer border-solid hover:opacity-80`
                            : "border-border/50 text-muted-foreground/30 hover:border-border"
                        )}
                        onClick={() =>
                          cellDeps.length > 0 &&
                          handleCellClick(rowEpic.id, colEpic.id)
                        }
                        title={
                          status
                            ? `${cellDeps.length} dep · ${status}`
                            : "Sem dependência"
                        }
                        type="button"
                      >
                        {status && Icon ? (
                          <Icon className="h-4 w-4" />
                        ) : (
                          <span className="opacity-30">·</span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-3 border-t pt-3">
              {Object.entries(STATUS_COLORS).map(([s, cls]) => {
                const Icon = STATUS_ICON[s];
                return (
                  <div
                    className="flex items-center gap-1.5 text-muted-foreground text-xs"
                    key={s}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {s.replace("-", " ")}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* List view */}
      {tab === "list" && (
        <div className="divide-y rounded-lg border">
          {dependencies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground text-sm">
                Nenhuma dependência cadastrada.
              </p>
              <Button
                className="mt-3"
                onClick={() => setAddOpen(true)}
                size="sm"
                variant="outline"
              >
                Criar primeira dependência
              </Button>
            </div>
          ) : (
            dependencies.map((dep) => {
              const Icon = STATUS_ICON[dep.status] ?? ClockIcon;
              return (
                <div className="flex items-start gap-4 px-4 py-3" key={dep.id}>
                  <div
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                      STATUS_COLORS[dep.status]
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-sm">
                        {dep.blockingFeature.title}
                      </span>
                      <ArrowRightIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium text-sm">
                        {dep.blockedFeature.title}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">
                        {dep.blockingFeature.epic?.title ?? "—"} →{" "}
                        {dep.blockedFeature.epic?.title ?? "—"}
                      </span>
                      <div
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          SEVERITY_DOT[dep.severity]
                        )}
                      />
                      <span className="text-muted-foreground text-xs">
                        {dep.severity}
                      </span>
                      <Badge className="text-[10px]" variant="outline">
                        {dep.type}
                      </Badge>
                    </div>
                    {dep.description && (
                      <p className="mt-0.5 truncate text-muted-foreground text-xs">
                        {dep.description}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      className="h-7 rounded-md border border-input bg-background px-2 text-foreground text-xs"
                      disabled={isPending}
                      onChange={(e) =>
                        handleUpdateStatus(dep.id, e.target.value)
                      }
                      value={dep.status}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s.replace("-", " ")}
                        </option>
                      ))}
                    </select>
                    <button
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      disabled={isPending}
                      onClick={() => handleDelete(dep.id)}
                      type="button"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Cell detail dialog */}
      <Dialog
        onOpenChange={(o) => !o && setSelectedDeps(null)}
        open={!!selectedDeps}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dependências do cruzamento</DialogTitle>
            <DialogDescription>
              {selectedDeps?.length} dependência(s) entre esses épicos
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
            {selectedDeps?.map((dep) => (
              <div className="rounded-lg border p-3" key={dep.id}>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {dep.blockingFeature.title}
                  </span>
                  <ArrowRightIcon className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium text-sm">
                    {dep.blockedFeature.title}
                  </span>
                </div>
                {dep.description && (
                  <p className="mt-1 text-muted-foreground text-xs">
                    {dep.description}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <Badge
                    className={cn("text-[10px]", STATUS_COLORS[dep.status])}
                    variant="outline"
                  >
                    {dep.status.replace("-", " ")}
                  </Badge>
                  <Badge className="text-[10px]" variant="outline">
                    {dep.severity}
                  </Badge>
                  <div className="ml-auto">
                    <button
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(dep.id)}
                      type="button"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add dependency dialog */}
      <Dialog onOpenChange={setAddOpen} open={addOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova dependência</DialogTitle>
            <DialogDescription>
              Feature bloqueante → Feature bloqueada (a bloqueada não pode
              avançar sem a bloqueante)
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-1">
            <div className="flex flex-col gap-2">
              <Label>Feature bloqueante (de)</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-foreground text-sm"
                onChange={(e) =>
                  setForm((f) => ({ ...f, blockingFeatureId: e.target.value }))
                }
                value={form.blockingFeatureId}
              >
                <option value="">Selecione...</option>
                {allFeatures.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.epicTitle} / {f.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Feature bloqueada (aguarda)</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-foreground text-sm"
                onChange={(e) =>
                  setForm((f) => ({ ...f, blockedFeatureId: e.target.value }))
                }
                value={form.blockedFeatureId}
              >
                <option value="">Selecione...</option>
                {allFeatures
                  .filter((f) => f.id !== form.blockingFeatureId)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.epicTitle} / {f.title}
                    </option>
                  ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Tipo</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-foreground text-sm"
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      type: e.target.value as typeof form.type,
                    }))
                  }
                  value={form.type}
                >
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Severidade</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-foreground text-sm"
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      severity: e.target.value as typeof form.severity,
                    }))
                  }
                  value={form.severity}
                >
                  {SEVERITY_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Descrição (opcional)</Label>
              <Input
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Descreva o bloqueio..."
                value={form.description}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setAddOpen(false)} variant="outline">
              Cancelar
            </Button>
            <Button
              disabled={
                isPending || !form.blockingFeatureId || !form.blockedFeatureId
              }
              onClick={handleAdd}
            >
              {isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
