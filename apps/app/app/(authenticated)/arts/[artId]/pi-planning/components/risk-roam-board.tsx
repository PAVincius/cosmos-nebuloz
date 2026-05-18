"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
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
import { AlertTriangleIcon, PlusIcon, GripVerticalIcon } from "lucide-react";
import { updateRiskStatus, createRisk } from "@/app/actions/arts/risks";

type Risk = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  category?: string | null;
  impact: string;
  probability: string;
};

type RoamStatus = "resolved" | "owned" | "accepted" | "mitigated";

const ROAM_QUADRANTS: { id: RoamStatus; label: string; color: string; description: string }[] = [
  {
    id: "resolved",
    label: "Resolved",
    color: "border-green-500/40 bg-green-500/5",
    description: "Risco eliminado — não é mais ameaça",
  },
  {
    id: "owned",
    label: "Owned",
    color: "border-blue-500/40 bg-blue-500/5",
    description: "Alguém assumiu responsabilidade e criou plano de mitigação",
  },
  {
    id: "accepted",
    label: "Accepted",
    color: "border-yellow-500/40 bg-yellow-500/5",
    description: "Risco aceito — impacto tolerável ou sem ação viável",
  },
  {
    id: "mitigated",
    label: "Mitigated",
    color: "border-purple-500/40 bg-purple-500/5",
    description: "Ações tomadas que reduzem probabilidade ou impacto",
  },
];

const IMPACT_COLORS: Record<string, string> = {
  critical: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

interface RoamRiskCardProps {
  risk: Risk;
}

function RoamRiskCard({ risk }: RoamRiskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: risk.id,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-start gap-1.5 rounded-md border bg-card p-2 text-xs shadow-sm cursor-grab active:cursor-grabbing"
    >
      <GripVerticalIcon
        className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground"
        {...listeners}
        {...attributes}
      />
      <div className="flex flex-col gap-1 min-w-0">
        <p className="font-medium leading-snug truncate">{risk.title}</p>
        <div className="flex gap-1 flex-wrap">
          <Badge
            variant={(IMPACT_COLORS[risk.impact] as "destructive" | "secondary" | "outline") ?? "outline"}
            className="h-4 px-1 text-[10px]"
          >
            {risk.impact}
          </Badge>
          {risk.category && (
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
              {risk.category}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

interface RoamQuadrantProps {
  status: RoamStatus;
  label: string;
  color: string;
  description: string;
  risks: Risk[];
}

function RoamQuadrant({ status, label, color, description, risks }: RoamQuadrantProps) {
  const { isOver, setNodeRef } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      aria-label={`${label} — ${risks.length} riscos`}
      className={`flex flex-col gap-2 rounded-xl border-2 p-3 transition-colors min-h-[180px] ${color} ${
        isOver ? "ring-2 ring-primary ring-offset-1" : ""
      }`}
    >
      <div>
        <h3 className="text-sm font-semibold">{label}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        {risks.map((r) => (
          <RoamRiskCard key={r.id} risk={r} />
        ))}
        {risks.length === 0 && (
          <p className="text-xs text-muted-foreground/50 text-center py-4">
            Arraste riscos aqui
          </p>
        )}
      </div>
    </div>
  );
}

interface RiskRoamBoardProps {
  risks: Risk[];
  piPlanId: string;
}

export function RiskRoamBoard({ risks: initialRisks, piPlanId }: RiskRoamBoardProps) {
  const [risks, setRisks] = useState(initialRisks);
  const [isPending, startTransition] = useTransition();
  const [showAddRisk, setShowAddRisk] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    impact: "medium",
    probability: "medium",
    category: "",
    status: "owned" as RoamStatus,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const riskId = active.id as string;
    const newStatus = over.id as RoamStatus;
    const risk = risks.find((r) => r.id === riskId);
    if (!risk || risk.status === newStatus) return;

    setRisks((prev) =>
      prev.map((r) => (r.id === riskId ? { ...r, status: newStatus } : r))
    );

    startTransition(async () => {
      await updateRiskStatus(riskId, newStatus);
    });
  }

  async function handleAddRisk() {
    if (!form.title.trim()) return;
    startTransition(async () => {
      const created = await createRisk({
        piPlanId,
        title: form.title,
        description: form.description || undefined,
        impact: form.impact,
        probability: form.probability,
        category: form.category || undefined,
        status: form.status,
      });
      setRisks((prev) => [...prev, created as Risk]);
      setForm({ title: "", description: "", impact: "medium", probability: "medium", category: "", status: "owned" });
      setShowAddRisk(false);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangleIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {risks.length} risco{risks.length !== 1 ? "s" : ""} program-level
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowAddRisk(true)}>
          <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
          Novo Risco
        </Button>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ROAM_QUADRANTS.map((q) => (
            <RoamQuadrant
              key={q.id}
              status={q.id}
              label={q.label}
              color={q.color}
              description={q.description}
              risks={risks.filter((r) => r.status === q.id)}
            />
          ))}
        </div>
      </DndContext>

      {/* Unclassified risks */}
      {risks.filter((r) => !["resolved", "owned", "accepted", "mitigated"].includes(r.status)).length > 0 && (
        <div className="rounded-lg border border-dashed p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Sem classificação ROAM</p>
          <div className="flex flex-col gap-1.5">
            {risks
              .filter((r) => !["resolved", "owned", "accepted", "mitigated"].includes(r.status))
              .map((r) => (
                <RoamRiskCard key={r.id} risk={r} />
              ))}
          </div>
        </div>
      )}

      <Dialog open={showAddRisk} onOpenChange={setShowAddRisk}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Risco Program-Level</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="risk-title">Título</Label>
              <Input
                id="risk-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Descreva o risco..."
              />
            </div>
            <div>
              <Label htmlFor="risk-desc">Descrição</Label>
              <Textarea
                id="risk-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Detalhes opcionais..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Impacto</Label>
                <Select value={form.impact} onValueChange={(v) => setForm((f) => ({ ...f, impact: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Probabilidade</Label>
                <Select value={form.probability} onValueChange={(v) => setForm((f) => ({ ...f, probability: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quadrante ROAM inicial</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as RoamStatus }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owned">Owned</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="mitigated">Mitigated</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="ex: técnico, negócio..."
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRisk(false)}>
              Cancelar
            </Button>
            <Button disabled={isPending || !form.title.trim()} onClick={handleAddRisk}>
              {isPending ? "Criando..." : "Criar Risco"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
