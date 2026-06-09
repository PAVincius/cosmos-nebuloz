"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { PlusIcon, StarIcon, TargetIcon } from "lucide-react";
import { useState, useTransition } from "react";
import {
  createPIObjective,
  updatePIObjective,
} from "@/app/actions/arts/pi-plans";

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

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
  }
> = {
  NOT_STARTED: { label: "Não Iniciado", variant: "outline" },
  IN_PROGRESS: { label: "Em Progresso", variant: "secondary" },
  COMPLETED: { label: "Concluído", variant: "default" },
  CANCELLED: { label: "Cancelado", variant: "destructive" },
};

type ObjectiveCardProps = {
  objective: Objective;
  onStatusChange: (id: string, status: string) => void;
  isPending: boolean;
};

function ObjectiveCard({
  objective,
  onStatusChange,
  isPending,
}: ObjectiveCardProps) {
  const statusCfg =
    STATUS_CONFIG[objective.status] ?? STATUS_CONFIG.NOT_STARTED;

  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <div className="mt-0.5 shrink-0">
        {objective.isStretch ? (
          <StarIcon aria-label="Stretch" className="h-4 w-4 text-amber-500" />
        ) : (
          <TargetIcon aria-label="Committed" className="h-4 w-4 text-primary" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-sm leading-snug">{objective.title}</p>
          <div className="flex shrink-0 items-center gap-1.5">
            {objective.isStretch && (
              <Badge
                className="h-4 border-amber-500/50 px-1 text-[10px] text-amber-600"
                variant="outline"
              >
                Stretch
              </Badge>
            )}
            <Badge className="h-4 px-1 text-[10px]" variant={statusCfg.variant}>
              {statusCfg.label}
            </Badge>
          </div>
        </div>
        {objective.description && (
          <p className="text-muted-foreground text-xs">
            {objective.description}
          </p>
        )}
        <div className="mt-0.5 flex items-center gap-3">
          {objective.businessValue > 0 && (
            <span className="text-muted-foreground text-xs">
              BV:{" "}
              <span className="font-medium text-foreground">
                {objective.businessValue}
              </span>
            </span>
          )}
          <Select
            disabled={isPending}
            onValueChange={(v) => onStatusChange(objective.id, v)}
            value={objective.status}
          >
            <SelectTrigger className="h-6 w-auto gap-1 px-2 text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <SelectItem className="text-xs" key={key} value={key}>
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

type PiObjectivesViewProps = {
  objectives: Objective[];
  teams: Team[];
  piPlanId: string;
};

export function PiObjectivesView({
  objectives: initialObjectives,
  teams,
  piPlanId,
}: PiObjectivesViewProps) {
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
    if (!form.title.trim()) {
      return;
    }
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
      setForm({
        title: "",
        description: "",
        teamId: "",
        isStretch: false,
        businessValue: 0,
      });
      setShowAdd(false);
    });
  }

  // Group objectives by team
  const byTeam = teams.reduce<Record<string, Objective[]>>((acc, team) => {
    acc[team.id] = objectives.filter((o) => o.teamId === team.id);
    return acc;
  }, {});
  const unassigned = objectives.filter(
    (o) => !(o.teamId && teams.find((t) => t.id === o.teamId))
  );
  const committed = objectives.filter((o) => !o.isStretch);
  const stretch = objectives.filter((o) => o.isStretch);

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-muted-foreground text-sm">
          <span className="flex items-center gap-1.5">
            <TargetIcon className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">
              {committed.length}
            </span>{" "}
            committed
          </span>
          <span className="flex items-center gap-1.5">
            <StarIcon className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-medium text-foreground">
              {stretch.length}
            </span>{" "}
            stretch
          </span>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm" variant="outline">
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
                <CardHeader className="px-4 py-3">
                  <CardTitle className="text-sm">{team.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 px-4 pb-4">
                  {teamObjectives.length === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      Nenhum objetivo definido para este time.
                    </p>
                  ) : (
                    teamObjectives.map((o) => (
                      <ObjectiveCard
                        isPending={isPending}
                        key={o.id}
                        objective={o}
                        onStatusChange={handleStatusChange}
                      />
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}

          {unassigned.length > 0 && (
            <Card>
              <CardHeader className="px-4 py-3">
                <CardTitle className="text-muted-foreground text-sm">
                  Sem time atribuído
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 px-4 pb-4">
                {unassigned.map((o) => (
                  <ObjectiveCard
                    isPending={isPending}
                    key={o.id}
                    objective={o}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {objectives.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground text-sm">
              Nenhum objetivo definido. Clique em "Novo Objetivo" para começar.
            </p>
          ) : (
            objectives.map((o) => (
              <ObjectiveCard
                isPending={isPending}
                key={o.id}
                objective={o}
                onStatusChange={handleStatusChange}
              />
            ))
          )}
        </div>
      )}

      <Dialog onOpenChange={setShowAdd} open={showAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Objetivo de PI</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="obj-title">Título</Label>
              <Input
                id="obj-title"
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Descreva o objetivo..."
                value={form.title}
              />
            </div>
            <div>
              <Label htmlFor="obj-desc">Descrição</Label>
              <Textarea
                id="obj-desc"
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Métricas de sucesso, indicadores..."
                rows={2}
                value={form.description}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Time</Label>
                <Select
                  onValueChange={(v) => setForm((f) => ({ ...f, teamId: v }))}
                  value={form.teamId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem time" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, isStretch: v === "stretch" }))
                  }
                  value={form.isStretch ? "stretch" : "committed"}
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
                max={10}
                min={0}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    businessValue: Number(e.target.value),
                  }))
                }
                type="number"
                value={form.businessValue}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowAdd(false)} variant="outline">
              Cancelar
            </Button>
            <Button
              disabled={isPending || !form.title.trim()}
              onClick={handleAddObjective}
            >
              {isPending ? "Criando..." : "Criar Objetivo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
