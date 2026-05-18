"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircleIcon, AlertTriangleIcon, CheckCircleIcon, ClockIcon,
  PlusIcon, TrashIcon, ArrowRightIcon,
} from "lucide-react";
import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { cn } from "@repo/design-system/lib/utils";
import {
  createDependency, updateDependencyStatus, deleteDependency,
} from "@/app/actions/dependencies";
import type { DependencyWithFeatures } from "@/app/actions/dependencies";

type Epic = { id: string; title: string; features: { id: string; title: string; statusId: string }[] };

type DependencyStatus = "blocked" | "at-risk" | "on-track" | "completed" | "not-started";
type DependencySeverity = "critical" | "high" | "medium" | "low";

const STATUS_COLORS: Record<string, string> = {
  blocked: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-400/40",
  "at-risk": "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-400/40",
  "on-track": "bg-green-500/20 text-green-600 dark:text-green-400 border-green-400/40",
  completed: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-400/40",
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

const STATUS_OPTIONS = ["not-started", "on-track", "at-risk", "blocked", "completed"] as const;
const TYPE_OPTIONS = ["technical", "business", "organizational", "external"] as const;
const SEVERITY_OPTIONS = ["critical", "high", "medium", "low"] as const;

function getEpicDependencies(deps: DependencyWithFeatures[], fromEpicId: string, toEpicId: string) {
  return deps.filter(
    (d) => d.blockingFeature.epicId === fromEpicId && d.blockedFeature.epicId === toEpicId
  );
}

function getWorstStatus(deps: DependencyWithFeatures[]): string {
  const priority = ["blocked", "at-risk", "not-started", "on-track", "completed"];
  const statuses = deps.map((d) => d.status);
  for (const s of priority) {
    if (statuses.includes(s)) return s;
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
  const [selectedDeps, setSelectedDeps] = useState<DependencyWithFeatures[] | null>(null);
  const [form, setForm] = useState({
    blockingFeatureId: "",
    blockedFeatureId: "",
    description: "",
    status: "not-started" as const,
    type: "technical" as const,
    severity: "medium" as const,
  });

  const allFeatures = epics.flatMap((e) => e.features.map((f) => ({ ...f, epicTitle: e.title })));

  function handleCellClick(fromEpicId: string, toEpicId: string) {
    const cellDeps = getEpicDependencies(dependencies, fromEpicId, toEpicId);
    if (cellDeps.length > 0) setSelectedDeps(cellDeps);
  }

  function handleAdd() {
    startTransition(async () => {
      await createDependency(form);
      setAddOpen(false);
      setForm({ blockingFeatureId: "", blockedFeatureId: "", description: "", status: "not-started", type: "technical", severity: "medium" });
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
          { label: "Total", value: summaryStats.total, color: "" },
          { label: "Bloqueadas", value: summaryStats.blocked, color: "text-red-500" },
          { label: "Em Risco", value: summaryStats.atRisk, color: "text-amber-500" },
          { label: "Críticas", value: summaryStats.critical, color: "text-red-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border p-4">
            <p className="text-muted-foreground text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-lg border overflow-hidden">
          {(["matrix", "list"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {t === "matrix" ? "Matriz" : "Lista"}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
          Nova dependência
        </Button>
      </div>

      {/* Matrix view */}
      {tab === "matrix" && (
        <div className="rounded-lg border overflow-auto">
          <div className="min-w-max p-4">
            <div className="flex">
              <div className="w-44 h-12 flex items-end justify-end pr-3 pb-2 text-xs text-muted-foreground font-medium">
                Épico (dependente ↓)
              </div>
              {epics.map((e) => (
                <div
                  key={e.id}
                  className="w-14 h-12 flex items-end justify-center pb-2"
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                >
                  <span className="text-xs font-medium truncate max-w-[44px]">{e.title}</span>
                </div>
              ))}
            </div>
            {epics.map((rowEpic) => (
              <div key={rowEpic.id} className="flex">
                <div className="w-44 h-12 flex items-center pr-3 text-xs font-medium truncate">
                  {rowEpic.title}
                </div>
                {epics.map((colEpic) => {
                  if (rowEpic.id === colEpic.id) {
                    return (
                      <div key={colEpic.id} className="w-14 h-12 p-1 flex items-center justify-center">
                        <div className="w-10 h-10 bg-muted/30 rounded-md" />
                      </div>
                    );
                  }
                  const cellDeps = getEpicDependencies(dependencies, rowEpic.id, colEpic.id);
                  const status = cellDeps.length > 0 ? getWorstStatus(cellDeps) : null;
                  const Icon = status ? STATUS_ICON[status] : null;

                  return (
                    <div key={colEpic.id} className="w-14 h-12 p-1 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => cellDeps.length > 0 && handleCellClick(rowEpic.id, colEpic.id)}
                        className={cn(
                          "w-10 h-10 rounded-md border-2 border-dashed flex items-center justify-center transition-all text-xs",
                          status
                            ? `${STATUS_COLORS[status]} border-solid cursor-pointer hover:opacity-80`
                            : "border-border/50 hover:border-border text-muted-foreground/30"
                        )}
                        title={status ? `${cellDeps.length} dep · ${status}` : "Sem dependência"}
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
            <div className="mt-4 flex flex-wrap gap-3 pt-3 border-t">
              {Object.entries(STATUS_COLORS).map(([s, cls]) => {
                const Icon = STATUS_ICON[s];
                return (
                  <div key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
        <div className="rounded-lg border divide-y">
          {dependencies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground text-sm">Nenhuma dependência cadastrada.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setAddOpen(true)}>
                Criar primeira dependência
              </Button>
            </div>
          ) : (
            dependencies.map((dep) => {
              const Icon = STATUS_ICON[dep.status] ?? ClockIcon;
              return (
                <div key={dep.id} className="flex items-start gap-4 px-4 py-3">
                  <div className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border", STATUS_COLORS[dep.status])}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{dep.blockingFeature.title}</span>
                      <ArrowRightIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium truncate">{dep.blockedFeature.title}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{dep.blockingFeature.epic?.title ?? "—"} → {dep.blockedFeature.epic?.title ?? "—"}</span>
                      <div className={cn("h-2 w-2 rounded-full shrink-0", SEVERITY_DOT[dep.severity])} />
                      <span className="text-xs text-muted-foreground">{dep.severity}</span>
                      <Badge variant="outline" className="text-[10px]">{dep.type}</Badge>
                    </div>
                    {dep.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{dep.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={dep.status}
                      onChange={(e) => handleUpdateStatus(dep.id, e.target.value)}
                      disabled={isPending}
                      className="border-input bg-background text-foreground h-7 rounded-md border px-2 text-xs"
                    >
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace("-", " ")}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleDelete(dep.id)}
                      disabled={isPending}
                      className="text-muted-foreground hover:text-destructive transition-colors"
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
      <Dialog open={!!selectedDeps} onOpenChange={(o) => !o && setSelectedDeps(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dependências do cruzamento</DialogTitle>
            <DialogDescription>{selectedDeps?.length} dependência(s) entre esses épicos</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 max-h-80 overflow-y-auto">
            {selectedDeps?.map((dep) => (
              <div key={dep.id} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{dep.blockingFeature.title}</span>
                  <ArrowRightIcon className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm font-medium">{dep.blockedFeature.title}</span>
                </div>
                {dep.description && <p className="text-xs text-muted-foreground mt-1">{dep.description}</p>}
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className={cn("text-[10px]", STATUS_COLORS[dep.status])}>
                    {dep.status.replace("-", " ")}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">{dep.severity}</Badge>
                  <div className="ml-auto">
                    <button
                      type="button"
                      onClick={() => handleDelete(dep.id)}
                      className="text-muted-foreground hover:text-destructive"
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
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova dependência</DialogTitle>
            <DialogDescription>
              Feature bloqueante → Feature bloqueada (a bloqueada não pode avançar sem a bloqueante)
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-1">
            <div className="flex flex-col gap-2">
              <Label>Feature bloqueante (de)</Label>
              <select
                value={form.blockingFeatureId}
                onChange={(e) => setForm((f) => ({ ...f, blockingFeatureId: e.target.value }))}
                className="border-input bg-background text-foreground flex h-9 w-full rounded-md border px-3 py-1 text-sm"
              >
                <option value="">Selecione...</option>
                {allFeatures.map((f) => (
                  <option key={f.id} value={f.id}>{f.epicTitle} / {f.title}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Feature bloqueada (aguarda)</Label>
              <select
                value={form.blockedFeatureId}
                onChange={(e) => setForm((f) => ({ ...f, blockedFeatureId: e.target.value }))}
                className="border-input bg-background text-foreground flex h-9 w-full rounded-md border px-3 py-1 text-sm"
              >
                <option value="">Selecione...</option>
                {allFeatures.filter((f) => f.id !== form.blockingFeatureId).map((f) => (
                  <option key={f.id} value={f.id}>{f.epicTitle} / {f.title}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Tipo</Label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as typeof form.type }))}
                  className="border-input bg-background text-foreground flex h-9 w-full rounded-md border px-3 py-1 text-sm"
                >
                  {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Severidade</Label>
                <select
                  value={form.severity}
                  onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as typeof form.severity }))}
                  className="border-input bg-background text-foreground flex h-9 w-full rounded-md border px-3 py-1 text-sm"
                >
                  {SEVERITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Descrição (opcional)</Label>
              <Input
                placeholder="Descreva o bloqueio..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleAdd}
              disabled={isPending || !form.blockingFeatureId || !form.blockedFeatureId}
            >
              {isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
