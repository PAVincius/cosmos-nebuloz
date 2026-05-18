"use client";

import { useState, useTransition } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
import {
  PlusIcon,
  CheckCircle2Icon,
  CircleIcon,
  ArrowRightCircleIcon,
  XCircleIcon,
} from "lucide-react";
import {
  FLOW_METRICS,
  FLOW_METRIC_LABELS,
  type FlowMetricKey,
} from "@/app/actions/measure-grow/schema";
import {
  createImprovementActionResult,
  updateImprovementActionResult,
} from "@/app/actions/measure-grow";

type ActionItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  relatedMetric: string | null;
  dueDate: Date | null;
  scope: string;
  scopeId: string;
};

type ScopeOption = {
  id: string;
  label: string;
  type: string;
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  OPEN:        <CircleIcon className="h-4 w-4 text-muted-foreground" />,
  IN_PROGRESS: <ArrowRightCircleIcon className="h-4 w-4 text-blue-500" />,
  DONE:        <CheckCircle2Icon className="h-4 w-4 text-emerald-500" />,
  CANCELLED:   <XCircleIcon className="h-4 w-4 text-rose-400" />,
};

const STATUS_LABELS: Record<string, string> = {
  OPEN:        "Aberta",
  IN_PROGRESS: "Em Progresso",
  DONE:        "Concluída",
  CANCELLED:   "Cancelada",
};

const SCOPE_LABELS: Record<string, string> = {
  team:         "Time",
  art:          "ART",
  value_stream: "Value Stream",
  portfolio:    "Portfólio",
};

type FormState = {
  title:         string;
  description:   string;
  status:        string;
  relatedMetric: string;
  scope:         string;
  scopeId:       string;
};

const DEFAULT_FORM: FormState = {
  title:         "",
  description:   "",
  status:        "OPEN",
  relatedMetric: "",
  scope:         "art",
  scopeId:       "",
};

export function ImprovementActionsTab({
  initialActions,
  scopes,
}: {
  initialActions: ActionItem[];
  scopes: ScopeOption[];
}) {
  const [actions, setActions]        = useState(initialActions);
  const [open, setOpen]              = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm]              = useState<FormState>(DEFAULT_FORM);

  const filteredScopes = scopes.filter((s) => s.type === form.scope);

  function scopeLabel(id: string): string {
    return scopes.find((s) => s.id === id)?.label ?? id;
  }

  function handleCreate() {
    startTransition(async () => {
      const result = await createImprovementActionResult({
        title:         form.title,
        description:   form.description || undefined,
        scope:         form.scope,
        scopeId:       form.scopeId,
        status:        form.status,
        relatedMetric: form.relatedMetric || undefined,
      });
      if (result.ok) {
        setActions((prev) => [
          {
            id:            result.data.id,
            title:         form.title,
            description:   form.description || null,
            status:        form.status,
            relatedMetric: form.relatedMetric || null,
            dueDate:       null,
            scope:         form.scope,
            scopeId:       form.scopeId,
          },
          ...prev,
        ]);
        setForm(DEFAULT_FORM);
        setOpen(false);
      }
    });
  }

  function handleStatusChange(id: string, status: string) {
    startTransition(async () => {
      await updateImprovementActionResult(id, { status });
      setActions((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      );
    });
  }

  const openCount = actions.filter(
    (a) => a.status === "OPEN" || a.status === "IN_PROGRESS"
  ).length;
  const doneCount = actions.filter((a) => a.status === "DONE").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Ações de melhoria ligadas a Flow Metrics e assessments de competência.
          {actions.length > 0 && (
            <span className="ml-2">
              <span className="font-medium text-foreground">{openCount}</span> abertas ·{" "}
              <span className="font-medium text-foreground">{doneCount}</span> concluídas
            </span>
          )}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <PlusIcon className="h-4 w-4" />
              Nova Ação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nova Ação de Melhoria</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Título</label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Ex: Reduzir WIP do Time A para ≤5"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Descrição</label>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  rows={2}
                  placeholder="Contexto adicional…"
                />
              </div>

              {/* Scope type + entity */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Escopo</label>
                  <Select
                    value={form.scope}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, scope: v, scopeId: "" }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SCOPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">
                    {SCOPE_LABELS[form.scope] ?? "Entidade"}
                  </label>
                  <Select
                    value={form.scopeId}
                    onValueChange={(v) => setForm((p) => ({ ...p, scopeId: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar…" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredScopes.length === 0 ? (
                        <SelectItem value="__none" disabled>
                          Nenhum disponível
                        </SelectItem>
                      ) : (
                        filteredScopes.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Métrica ligada</label>
                  <Select
                    value={form.relatedMetric}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, relatedMetric: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhuma" />
                    </SelectTrigger>
                    <SelectContent>
                      {FLOW_METRICS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {FLOW_METRIC_LABELS[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleCreate}
                disabled={isPending || !form.title.trim() || !form.scopeId}
              >
                {isPending ? "Salvando…" : "Criar Ação"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-2">
        {actions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            Nenhuma ação de melhoria cadastrada.
          </div>
        ) : (
          actions.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-3 rounded-lg border border-border/80 bg-card px-4 py-3"
            >
              <div className="mt-0.5">
                {STATUS_ICONS[a.status] ?? STATUS_ICONS.OPEN}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{a.title}</span>
                  {a.relatedMetric && (
                    <Badge variant="secondary" className="text-xs">
                      {FLOW_METRIC_LABELS[a.relatedMetric as FlowMetricKey] ??
                        a.relatedMetric}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {SCOPE_LABELS[a.scope] ?? a.scope} — {scopeLabel(a.scopeId)}
                  </span>
                </div>
                {a.description && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {a.description}
                  </p>
                )}
              </div>
              <Select
                value={a.status}
                onValueChange={(v) => handleStatusChange(a.id, v)}
              >
                <SelectTrigger className="h-7 w-auto shrink-0 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
