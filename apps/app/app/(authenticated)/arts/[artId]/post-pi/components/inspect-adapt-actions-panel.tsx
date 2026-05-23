"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  CheckCircle2Icon,
  ClockIcon,
  PlusIcon,
  TrendingUpIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import {
  createImprovementActionResult,
  updateActionStatus,
} from "@/app/actions/measure-grow";
import {
  RETRO_TEMPLATES,
  type RetroTemplate,
} from "@/app/actions/retrospective/schema";

// ─── SAFe competencies (subset for form) ─────────────────────────────────────

const SAFE_COMPETENCY_OPTIONS = [
  { key: "TEAM_TECHNICAL_AGILITY", label: "Team & Technical Agility" },
  { key: "AGILE_PRODUCT_DELIVERY", label: "Agile Product Delivery" },
  {
    key: "ENTERPRISE_SOLUTION_DELIVERY",
    label: "Enterprise Solution Delivery",
  },
  { key: "LEAN_PORTFOLIO_MANAGEMENT", label: "Lean Portfolio Management" },
  { key: "ORGANIZATIONAL_AGILITY", label: "Organizational Agility" },
  { key: "CONTINUOUS_LEARNING_CULTURE", label: "Continuous Learning Culture" },
  { key: "LEAN_AGILE_LEADERSHIP", label: "Lean-Agile Leadership" },
];

const FLOW_METRIC_OPTIONS = [
  { key: "flow_velocity", label: "Flow Velocity" },
  { key: "flow_time", label: "Flow Time (Cycle Time)" },
  { key: "flow_load", label: "Flow Load (WIP)" },
  { key: "flow_efficiency", label: "Flow Efficiency" },
  { key: "flow_predictability", label: "Flow Predictability" },
  { key: "flow_distribution", label: "Flow Distribution" },
];

const ACTION_STATUS_CONFIG = {
  OPEN: { label: "Aberta", className: "bg-slate-100 text-slate-700" },
  IN_PROGRESS: {
    label: "Em Progresso",
    className: "bg-blue-100 text-blue-700",
  },
  DONE: { label: "Concluído", className: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Cancelado", className: "bg-red-100 text-red-700" },
};

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionItem = {
  id: string;
  title: string;
  relatedMetric: string | null;
  competency?: string | null;
  status: string;
  dueDate: Date | null;
};

type Props = {
  artId: string;
  piPlanId: string;
  initialActions: ActionItem[];
};

// ─── Component ────────────────────────────────────────────────────────────────

export function InspectAdaptActionsPanel({
  artId,
  piPlanId: _piPlanId,
  initialActions,
}: Props) {
  const [actions, setActions] = useState<ActionItem[]>(initialActions);
  const [isPending, startTransition] = useTransition();
  const [selectedTemplate, setSelectedTemplate] =
    useState<RetroTemplate>("blank");
  const [wentWell, setWentWell] = useState("");
  const [toImprove, setToImprove] = useState("");
  const [form, setForm] = useState({
    title: "",
    relatedMetric: "",
    competency: "",
    dueDate: "",
  });

  const template = RETRO_TEMPLATES[selectedTemplate];

  function handleMetricChange(v: string) {
    setForm((f) => ({ ...f, relatedMetric: v !== "none" ? v : "" }));
  }
  function handleCompetencyChange(v: string) {
    setForm((f) => ({ ...f, competency: v !== "none" ? v : "" }));
  }

  function handleAddAction() {
    if (!form.title.trim()) {
      return;
    }

    const optimistic: ActionItem = {
      id: `tmp-${Date.now()}`,
      title: form.title.trim(),
      relatedMetric: form.relatedMetric || null,
      competency: form.competency || null,
      status: "OPEN",
      dueDate: form.dueDate ? new Date(form.dueDate) : null,
    };

    setActions((prev) => [...prev, optimistic]);
    setForm({ title: "", relatedMetric: "", competency: "", dueDate: "" });

    startTransition(async () => {
      await createImprovementActionResult({
        title: optimistic.title,
        scope: "art",
        scopeId: artId,
        relatedMetric: form.relatedMetric || undefined,
        dueDate: form.dueDate
          ? new Date(form.dueDate).toISOString()
          : undefined,
      });
    });
  }

  function handleStatusChange(id: string, status: string) {
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    startTransition(async () => {
      await updateActionStatus(
        id,
        status as "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED"
      );
    });
  }

  const pending = actions.filter((a) => a.status === "OPEN").length;
  const done = actions.filter((a) => a.status === "DONE").length;

  return (
    <div className="flex flex-col gap-5">
      {/* Template selector */}
      <div>
        <Label className="mb-1.5 block font-semibold text-muted-foreground text-xs uppercase tracking-wide">
          Formato da Retrospectiva
        </Label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(RETRO_TEMPLATES) as RetroTemplate[]).map((t) => (
            <button
              className={[
                "rounded-full border px-3 py-1 font-medium text-xs transition-colors",
                selectedTemplate === t
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40",
              ].join(" ")}
              key={t}
              onClick={() => setSelectedTemplate(t)}
              type="button"
            >
              {RETRO_TEMPLATES[t].label}
            </button>
          ))}
        </div>
      </div>

      {/* Template text areas */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs" htmlFor="went-well">
            {template.sections[0]?.prompt ?? "O que foi bem?"}
          </Label>
          <Textarea
            className="mt-1 resize-none text-xs"
            id="went-well"
            onChange={(e) => setWentWell(e.target.value)}
            placeholder="Adicione um item por linha..."
            rows={4}
            value={wentWell}
          />
        </div>
        <div>
          <Label className="text-xs" htmlFor="to-improve">
            {template.sections[1]?.prompt ?? "O que melhorar?"}
          </Label>
          <Textarea
            className="mt-1 resize-none text-xs"
            id="to-improve"
            onChange={(e) => setToImprove(e.target.value)}
            placeholder="Adicione um item por linha..."
            rows={4}
            value={toImprove}
          />
        </div>
      </div>

      <Separator />

      {/* Actions */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Ações de Melhoria</span>
            <Badge className="text-[10px]" variant="outline">
              Measure &amp; Grow
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <span className="flex items-center gap-1">
              <ClockIcon className="h-3 w-3" />
              {pending} pendentes
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2Icon className="h-3 w-3 text-green-600" />
              {done} concluídas
            </span>
          </div>
        </div>

        {/* Action list */}
        {actions.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground text-xs">
            Nenhuma ação de melhoria ainda. Adicione abaixo.
          </p>
        ) : (
          <div className="mb-3 flex flex-col gap-2">
            {actions.map((a) => {
              const statusCfg =
                ACTION_STATUS_CONFIG[
                  a.status as keyof typeof ACTION_STATUS_CONFIG
                ] ?? ACTION_STATUS_CONFIG.OPEN;
              return (
                <div
                  className="flex items-start justify-between gap-3 rounded-lg border p-3"
                  key={a.id}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{a.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {!!a.relatedMetric && (
                        <Badge className="text-[10px]" variant="outline">
                          {FLOW_METRIC_OPTIONS.find(
                            (m) => m.key === a.relatedMetric
                          )?.label ?? a.relatedMetric}
                        </Badge>
                      )}
                      {!!a.competency && (
                        <Badge
                          className="border-violet-300 text-[10px] text-violet-700"
                          variant="outline"
                        >
                          {SAFE_COMPETENCY_OPTIONS.find(
                            (c) => c.key === a.competency
                          )?.label ?? a.competency}
                        </Badge>
                      )}
                      {a.dueDate !== null && (
                        <span className="text-[10px] text-muted-foreground">
                          Prazo:{" "}
                          {new Date(a.dueDate).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
                  </div>
                  <Select
                    disabled={isPending}
                    onValueChange={(v) => handleStatusChange(a.id, v)}
                    value={a.status}
                  >
                    <SelectTrigger className="h-7 w-auto gap-1 px-2 text-[10px]">
                      <span
                        className={`rounded px-1.5 py-0.5 ${statusCfg.className}`}
                      >
                        {statusCfg.label}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACTION_STATUS_CONFIG).map(
                        ([key, cfg]) => (
                          <SelectItem className="text-xs" key={key} value={key}>
                            {cfg.label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        )}

        {/* Add action form */}
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3">
          <p className="font-medium text-muted-foreground text-xs">
            Nova Ação de Melhoria
          </p>
          <div>
            <Label className="text-xs">Título *</Label>
            <Input
              className="mt-0.5 h-8 text-xs"
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="Descreva a ação de melhoria..."
              value={form.title}
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Flow Metric relacionada</Label>
              <Select
                onValueChange={handleMetricChange}
                value={form.relatedMetric || "none"}
              >
                <SelectTrigger className="mt-0.5 h-8 text-xs">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem className="text-xs" value="none">
                    Nenhuma
                  </SelectItem>
                  {FLOW_METRIC_OPTIONS.map((m) => (
                    <SelectItem className="text-xs" key={m.key} value={m.key}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Competência SAFe</Label>
              <Select
                onValueChange={handleCompetencyChange}
                value={form.competency || "none"}
              >
                <SelectTrigger className="mt-0.5 h-8 text-xs">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem className="text-xs" value="none">
                    Nenhuma
                  </SelectItem>
                  {SAFE_COMPETENCY_OPTIONS.map((c) => (
                    <SelectItem className="text-xs" key={c.key} value={c.key}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prazo</Label>
              <Input
                className="mt-0.5 h-8 text-xs"
                onChange={(e) =>
                  setForm((f) => ({ ...f, dueDate: e.target.value }))
                }
                type="date"
                value={form.dueDate}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              className="gap-1.5"
              disabled={isPending || !form.title.trim()}
              onClick={handleAddAction}
              size="sm"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Adicionar Ação
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
