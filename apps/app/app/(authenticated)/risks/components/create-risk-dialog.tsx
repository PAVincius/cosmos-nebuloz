"use client";

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
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import { PlusIcon, ShieldIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createRisk } from "@/app/actions/risks";
import { ModalShell } from "../../components/modal-shell";

type PIOption = { id: string; name: string };

const NO_PI = "none";

// risk-modal.js:4 (ROAM_STATES) — mesma ordem/rótulos do board (roam-board.tsx COLUMNS)
const ROAM_STATES: { value: string; label: string }[] = [
  { value: "IDENTIFIED", label: "Identificado" },
  { value: "OWNED", label: "Atribuído" },
  { value: "ACCEPTED", label: "Aceito" },
  { value: "MITIGATED", label: "Mitigado" },
  { value: "RESOLVED", label: "Resolvido" },
];

// risk-modal.js:19 (severity seg, via PRIORITIES) — impact persistido pelo schema tem 4 níveis
const IMPACT_LEVELS: { value: string; label: string }[] = [
  { value: "low", label: "Baixo" },
  { value: "medium", label: "Médio" },
  { value: "high", label: "Alto" },
  { value: "critical", label: "Crítico" },
];

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "technical", label: "Técnico" },
  { value: "business", label: "Negócio" },
  { value: "organizational", label: "Organizacional" },
  { value: "external", label: "Externo" },
];

type Props = { piPlans: PIOption[] };

/** M4 — modal "+ Risco" (risk-modal.js, openRiskModal). Campos limitados ao que createRisk persiste. */
export function CreateRiskDialog({ piPlans }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [piPlanId, setPiPlanId] = useState(NO_PI);
  const [category, setCategory] = useState("technical");
  const [impact, setImpact] = useState("medium");
  const [status, setStatus] = useState("IDENTIFIED");
  const [mitigation, setMitigation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTitle("");
    setPiPlanId(NO_PI);
    setCategory("technical");
    setImpact("medium");
    setStatus("IDENTIFIED");
    setMitigation("");
  };

  const handleClose = () => {
    if (submitting) {
      return;
    }
    reset();
    setOpen(false);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Descreva o risco antes de registrar.");
      return;
    }
    setSubmitting(true);
    try {
      await createRisk({
        title: title.trim(),
        description: mitigation.trim() || undefined,
        status,
        category,
        impact,
        piPlanId: piPlanId === NO_PI ? undefined : piPlanId,
      });
      toast.success(`Risco "${title.trim()}" registrado.`);
      reset();
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Não foi possível registrar o risco.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        <PlusIcon aria-hidden className="mr-1 h-4 w-4" />
        Registrar risco
      </Button>

      <ModalShell
        eyebrow="Board ROAM"
        loading={submitting}
        onClose={handleClose}
        open={open}
        size="md"
        title="Registrar Risco"
        footer={
          <>
            <Button
              disabled={submitting}
              onClick={handleClose}
              type="button"
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button disabled={submitting} onClick={handleSubmit} type="button">
              <ShieldIcon aria-hidden className="mr-1 h-4 w-4" />
              {submitting ? "Registrando…" : "Registrar risco"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="risk-title">
              Título do risco <span className="text-destructive">*</span>
            </Label>
            <Input
              autoFocus
              id="risk-title"
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ex: Dependência do SDK biométrico pode atrasar"
              value={title}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Vinculado a</Label>
            <Select onValueChange={setPiPlanId} value={piPlanId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PI}>Portfolio (sem PI)</SelectItem>
                {piPlans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Categoria</Label>
            <Select onValueChange={setCategory} value={category}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Severidade</Label>
            <div className="flex flex-wrap gap-1.5">
              {IMPACT_LEVELS.map((lvl) => (
                <button
                  className={cn(
                    "rounded-md border px-2.5 py-1 font-medium text-xs transition-colors",
                    impact === lvl.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent"
                  )}
                  key={lvl.value}
                  onClick={() => setImpact(lvl.value)}
                  type="button"
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Status ROAM</Label>
            <div className="flex flex-wrap gap-1.5">
              {ROAM_STATES.map((s) => (
                <button
                  className={cn(
                    "flex-1 rounded-md border px-2.5 py-1 font-medium text-xs transition-colors",
                    status === s.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent"
                  )}
                  key={s.value}
                  onClick={() => setStatus(s.value)}
                  type="button"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="risk-mitigation">Plano de mitigação</Label>
            <Textarea
              id="risk-mitigation"
              onChange={(e) => setMitigation(e.target.value)}
              placeholder="O que será feito para reduzir probabilidade ou impacto…"
              value={mitigation}
            />
          </div>
        </div>
      </ModalShell>
    </>
  );
}
