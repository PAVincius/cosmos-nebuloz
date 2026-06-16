"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@repo/design-system/components/ui/card";
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
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  HandIcon,
  PlusIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { createRisk, deleteRisk, updateRiskStatus } from "@/app/actions/risks";
import type { RiskWithPI } from "@/app/actions/risks/schema";

type PIOption = { id: string; name: string; artId: string };

type RoamStatus =
  | "IDENTIFIED"
  | "RESOLVED"
  | "OWNED"
  | "ACCEPTED"
  | "MITIGATED";

const COLUMNS: {
  status: RoamStatus;
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}[] = [
  {
    status: "IDENTIFIED",
    label: "Identificado",
    color: "text-gray-600 dark:text-gray-400",
    bgColor:
      "bg-gray-50 border-gray-200 dark:bg-gray-900/40 dark:border-gray-700",
    icon: (
      <AlertTriangleIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
    ),
  },
  {
    status: "RESOLVED",
    label: "Resolvido",
    color: "text-green-700 dark:text-green-400",
    bgColor:
      "bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800",
    icon: (
      <CheckCircle2Icon className="h-4 w-4 text-green-600 dark:text-green-400" />
    ),
  },
  {
    status: "OWNED",
    label: "Atribuído",
    color: "text-blue-700 dark:text-blue-400",
    bgColor:
      "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800",
    icon: <HandIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
  },
  {
    status: "ACCEPTED",
    label: "Aceito",
    color: "text-yellow-700 dark:text-yellow-400",
    bgColor:
      "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/40 dark:border-yellow-800",
    icon: (
      <CircleDotIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
    ),
  },
  {
    status: "MITIGATED",
    label: "Mitigado",
    color: "text-purple-700 dark:text-purple-400",
    bgColor:
      "bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800",
    icon: (
      <ShieldCheckIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
    ),
  },
];

const IMPACT_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  medium:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const IMPACT_LABELS: Record<string, string> = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
  critical: "Crítico",
};

const PROBABILITY_LABELS: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

const CATEGORY_LABELS: Record<string, string> = {
  technical: "Técnico",
  business: "Negócio",
  organizational: "Organizacional",
  external: "Externo",
};

type Props = {
  initialRisks: RiskWithPI[];
  piPlans: PIOption[];
};

type FormState = {
  title: string;
  description: string;
  status: RoamStatus;
  category: string;
  impact: string;
  probability: string;
  piPlanId: string;
};

const DEFAULT_FORM: FormState = {
  title: "",
  description: "",
  status: "IDENTIFIED",
  category: "technical",
  impact: "medium",
  probability: "medium",
  piPlanId: "",
};

export function ROAMBoard({ initialRisks, piPlans }: Props) {
  const [risks, setRisks] = useState(initialRisks);
  const [filterPiId, setFilterPiId] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [isPending, startTransition] = useTransition();

  const filteredRisks =
    filterPiId === "all"
      ? risks
      : risks.filter((r) => r.piPlanId === filterPiId);

  const byStatus = (status: RoamStatus) =>
    filteredRisks.filter((r) => r.status === status);

  const stats = {
    total: filteredRisks.length,
    critical: filteredRisks.filter((r) => r.impact === "critical").length,
    identified: filteredRisks.filter((r) => r.status === "IDENTIFIED").length,
    resolved: filteredRisks.filter((r) => r.status === "RESOLVED").length,
  };

  function handleStatusChange(id: string, status: string) {
    setRisks((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    startTransition(() => updateRiskStatus(id, status));
  }

  function handleDelete(id: string) {
    setRisks((prev) => prev.filter((r) => r.id !== id));
    startTransition(() => deleteRisk(id));
  }

  async function handleCreate() {
    if (!form.title.trim()) {
      return;
    }
    startTransition(async () => {
      await createRisk({
        title: form.title,
        description: form.description || undefined,
        status: form.status,
        category: form.category || undefined,
        impact: form.impact,
        probability: form.probability,
        piPlanId: form.piPlanId || undefined,
      });
    });
    const optimistic: RiskWithPI = {
      id: `tmp-${Date.now()}`,
      tenantId: "",
      title: form.title,
      description: form.description || null,
      status: form.status,
      category: form.category || null,
      impact: form.impact,
      probability: form.probability,
      piPlanId: form.piPlanId || null,
      ownerUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      piPlan: form.piPlanId
        ? (piPlans.find((p) => p.id === form.piPlanId) ?? null)
        : null,
    };
    setRisks((prev) => [optimistic, ...prev]);
    setForm(DEFAULT_FORM);
    setDialogOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total" value={stats.total} />
        <StatCard
          className="text-red-600"
          label="Críticos"
          value={stats.critical}
        />
        <StatCard
          className="text-gray-600"
          label="Identificados"
          value={stats.identified}
        />
        <StatCard
          className="text-green-600"
          label="Resolvidos"
          value={stats.resolved}
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Select onValueChange={setFilterPiId} value={filterPiId}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Filtrar por PI" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os PIs</SelectItem>
            {piPlans.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button className="ml-auto" onClick={() => setDialogOpen(true)}>
          <PlusIcon className="mr-1 h-4 w-4" /> Novo Risco
        </Button>
      </div>

      {/* ROAM Kanban */}
      <div className="grid min-h-[400px] grid-cols-5 gap-3">
        {COLUMNS.map((col) => {
          const colRisks = byStatus(col.status);
          return (
            <div
              className={`flex flex-col gap-2 rounded-lg border p-3 ${col.bgColor}`}
              key={col.status}
            >
              <div className="mb-1 flex items-center gap-2">
                {col.icon}
                <span className={`font-semibold text-sm ${col.color}`}>
                  {col.label}
                </span>
                <Badge className="ml-auto text-xs" variant="secondary">
                  {colRisks.length}
                </Badge>
              </div>
              {colRisks.map((risk) => (
                <RiskCard
                  key={risk.id}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                  risk={risk}
                />
              ))}
              {colRisks.length === 0 && (
                <p className="py-4 text-center text-muted-foreground text-xs">
                  Nenhum risco
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Dialog */}
      <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Risco</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1">
              <Label>Título</Label>
              <Input
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Descreva o risco..."
                value={form.title}
              />
            </div>
            <div className="grid gap-1">
              <Label>Descrição</Label>
              <Textarea
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Contexto e detalhes do risco"
                rows={3}
                value={form.description}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Status ROAM</Label>
                <Select
                  onValueChange={(v) =>
                    setForm({ ...form, status: v as RoamStatus })
                  }
                  value={form.status}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLUMNS.map((c) => (
                      <SelectItem key={c.status} value={c.status}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label>Categoria</Label>
                <Select
                  onValueChange={(v) => setForm({ ...form, category: v })}
                  value={form.category}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Impacto</Label>
                <Select
                  onValueChange={(v) => setForm({ ...form, impact: v })}
                  value={form.impact}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(IMPACT_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label>Probabilidade</Label>
                <Select
                  onValueChange={(v) => setForm({ ...form, probability: v })}
                  value={form.probability}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROBABILITY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {piPlans.length > 0 && (
              <div className="grid gap-1">
                <Label>PI Plan (opcional)</Label>
                <Select
                  onValueChange={(v) =>
                    setForm({ ...form, piPlanId: v === "none" ? "" : v })
                  }
                  value={form.piPlanId || "none"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {piPlans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
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
              disabled={isPending || !form.title.trim()}
              onClick={handleCreate}
            >
              Criar Risco
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className={`font-bold text-2xl ${className ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function RiskCard({
  risk,
  onStatusChange,
  onDelete,
}: {
  risk: RiskWithPI;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card
        className="cursor-pointer transition-shadow hover:shadow-sm"
        onClick={() => setOpen(true)}
      >
        <CardHeader className="p-3 pb-2">
          <p className="font-semibold text-xs leading-tight">{risk.title}</p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1 p-3 pt-0">
          <Badge
            className={`text-xs ${IMPACT_COLORS[risk.impact]}`}
            variant="outline"
          >
            {IMPACT_LABELS[risk.impact]}
          </Badge>
          {risk.category && (
            <Badge className="text-xs" variant="outline">
              {CATEGORY_LABELS[risk.category] ?? risk.category}
            </Badge>
          )}
          {risk.piPlan && (
            <Badge className="text-muted-foreground text-xs" variant="outline">
              {risk.piPlan.name}
            </Badge>
          )}
        </CardContent>
      </Card>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{risk.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {risk.description && (
              <p className="text-muted-foreground text-sm">
                {risk.description}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Badge className={IMPACT_COLORS[risk.impact]}>
                {IMPACT_LABELS[risk.impact]}
              </Badge>
              <Badge variant="outline">
                Prob: {PROBABILITY_LABELS[risk.probability] ?? risk.probability}
              </Badge>
              {risk.category && (
                <Badge variant="outline">
                  {CATEGORY_LABELS[risk.category] ?? risk.category}
                </Badge>
              )}
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Mover para</Label>
              <div className="flex flex-wrap gap-2">
                {COLUMNS.map((col) => (
                  <Button
                    key={col.status}
                    onClick={() => {
                      onStatusChange(risk.id, col.status);
                      setOpen(false);
                    }}
                    size="sm"
                    variant={risk.status === col.status ? "default" : "outline"}
                  >
                    {col.icon}
                    <span className="ml-1">{col.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              className="text-destructive hover:text-destructive"
              onClick={() => {
                onDelete(risk.id);
                setOpen(false);
              }}
              size="sm"
              variant="outline"
            >
              <Trash2Icon className="mr-1 h-4 w-4" /> Excluir
            </Button>
            <Button onClick={() => setOpen(false)} variant="outline">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
