"use client";

import { useState, useTransition } from "react";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { PlusIcon, TargetIcon, StarIcon } from "lucide-react";
import { createPIObjective, updatePIObjective } from "@/app/actions/arts/pi-plans";

type Objective = {
  id: string;
  title: string;
  description?: string | null;
  isStretch: boolean;
  status: string;
  businessValue: number;
  teamId?: string | null;
};

type Team = { id: string; name: string; velocity?: number | null };

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  NOT_STARTED: { label: "Não Iniciado", variant: "outline" },
  IN_PROGRESS: { label: "Em Progresso", variant: "secondary" },
  COMPLETED: { label: "Concluído", variant: "default" },
  CANCELLED: { label: "Cancelado", variant: "destructive" },
};

interface ObjectiveCardProps {
  objective: Objective;
  onStatusChange: (id: string, status: string) => void;
  isPending: boolean;
}

function ObjectiveCard({ objective, onStatusChange, isPending }: ObjectiveCardProps) {
  const statusCfg = STATUS_CONFIG[objective.status] ?? STATUS_CONFIG.NOT_STARTED;

  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <div className="mt-0.5 shrink-0">
        {objective.isStretch ? (
          <StarIcon className="h-4 w-4 text-amber-500" aria-label="Stretch" />
        ) : (
          <TargetIcon className="h-4 w-4 text-primary" aria-label="Committed" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug">{objective.title}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            {objective.isStretch && (
              <Badge variant="outline" className="h-4 px-1 text-[10px] border-amber-500/50 text-amber-600">
                Stretch
              </Badge>
            )}
            <Badge variant={statusCfg.variant} className="h-4 px-1 text-[10px]">
              {statusCfg.label}
            </Badge>
          </div>
        </div>
        {objective.description && (
          <p className="text-xs text-muted-foreground">{objective.description}</p>
        )}
        <div className="flex items-center gap-3 mt-0.5">
          {objective.businessValue > 0 && (
            <span className="text-xs text-muted-foreground">
              BV: <span className="font-medium text-foreground">{objective.businessValue}</span>
            </span>
          )}
          <Select
            value={objective.status}
            onValueChange={(v) => onStatusChange(objective.id, v)}
            disabled={isPending}
          >
            <SelectTrigger className="h-6 w-auto text-[10px] px-2 gap-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <SelectItem key={key} value={key} className="text-xs">
                  {cfg.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

interface PiObjectivesViewProps {
  objectives: Objective[];
  teams: Team[];
  piPlanId: string;
}

export function PiObjectivesView({ objectives: initialObjectives, teams, piPlanId }: PiObjectivesViewProps) {
  const [objectives, setObjectives] = useState(initialObjectives);
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    teamId: "",
    isStretch: false,
    businessValue: 0,
  });

  function handleStatusChange(id: string, status: string) {
    setObjectives((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status } : o))
    );
    startTransition(async () => {
      await updatePIObjective(id, { status });
    });
  }

  async function handleAddObjective() {
    if (!form.title.trim()) return;
    startTransition(async () => {
      const created = await createPIObjective({
        piPlanId,
        title: form.title,
        description: form.description || undefined,
        teamId: form.teamId || undefined,
        isStretch: form.isStretch,
        businessValue: form.businessValue,
      });
      setObjectives((prev) => [...prev, created as Objective]);
      setForm({ title: "", description: "", teamId: "", isStretch: false, businessValue: 0 });
      setShowAdd(false);
    });
  }

  // Group objectives by team
  const byTeam = teams.reduce<Record<string, Objective[]>>(
    (acc, team) => {
      acc[team.id] = objectives.filter((o) => o.teamId === team.id);
      return acc;
    },
    {}
  );
  const unassigned = objectives.filter((o) => !o.teamId || !teams.find((t) => t.id === o.teamId));
  const committed = objectives.filter((o) => !o.isStretch);
  const stretch = objectives.filter((o) => o.isStretch);

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <TargetIcon className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{committed.length}</span> committed
          </span>
          <span className="flex items-center gap-1.5">
            <StarIcon className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-medium text-foreground">{stretch.length}</span> stretch
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
          <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
          Novo Objetivo
        </Button>
      </div>

      {/* By Team */}
      {teams.length > 0 ? (
        <div className="flex flex-col gap-4">
          {teams.map((team) => {
            const teamObjectives = byTeam[team.id] ?? [];
            return (
              <Card key={team.id}>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">{team.name}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 flex flex-col gap-2">
                  {teamObjectives.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum objetivo definido para este time.</p>
                  ) : (
                    teamObjectives.map((o) => (
                      <ObjectiveCard
                        key={o.id}
                        objective={o}
                        onStatusChange={handleStatusChange}
                        isPending={isPending}
                      />
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}

          {unassigned.length > 0 && (
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm text-muted-foreground">Sem time atribuído</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 flex flex-col gap-2">
                {unassigned.map((o) => (
                  <ObjectiveCard
                    key={o.id}
                    objective={o}
                    onStatusChange={handleStatusChange}
                    isPending={isPending}
                  />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {objectives.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum objetivo definido. Clique em "Novo Objetivo" para começar.
            </p>
          ) : (
            objectives.map((o) => (
              <ObjectiveCard
                key={o.id}
                objective={o}
                onStatusChange={handleStatusChange}
                isPending={isPending}
              />
            ))
          )}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Objetivo de PI</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="obj-title">Título</Label>
              <Input
                id="obj-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Descreva o objetivo..."
              />
            </div>
            <div>
              <Label htmlFor="obj-desc">Descrição</Label>
              <Textarea
                id="obj-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Métricas de sucesso, indicadores..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Time</Label>
                <Select value={form.teamId} onValueChange={(v) => setForm((f) => ({ ...f, teamId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem time" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select
                  value={form.isStretch ? "stretch" : "committed"}
                  onValueChange={(v) => setForm((f) => ({ ...f, isStretch: v === "stretch" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="committed">Committed</SelectItem>
                    <SelectItem value="stretch">Stretch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="bv">Business Value</Label>
              <Input
                id="bv"
                type="number"
                min={0}
                max={10}
                value={form.businessValue}
                onChange={(e) => setForm((f) => ({ ...f, businessValue: Number(e.target.value) }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Cancelar
            </Button>
            <Button disabled={isPending || !form.title.trim()} onClick={handleAddObjective}>
              {isPending ? "Criando..." : "Criar Objetivo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
