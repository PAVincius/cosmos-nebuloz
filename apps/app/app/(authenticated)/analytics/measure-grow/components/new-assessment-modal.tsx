"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { CheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ModalShell } from "@/app/(authenticated)/components/modal-shell";
import { createAssessmentAction } from "@/app/actions/measure-grow";
import { SAFE_COMPETENCIES } from "@/app/actions/measure-grow/schema";

const SCOPE_LABELS: Record<string, string> = {
  team: "Time",
  art: "ART",
  value_stream: "Value Stream",
  portfolio: "Portfólio",
};

type ScopeOption = {
  id: string;
  label: string;
  type: string;
};

type NewAssessmentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scopes: ScopeOption[];
};

export function NewAssessmentModal({
  open,
  onOpenChange,
  scopes,
}: NewAssessmentModalProps) {
  const [competency, setCompetency] = useState<string>(
    SAFE_COMPETENCIES[0].key
  );
  const [scope, setScope] = useState("art");
  const [scopeId, setScopeId] = useState("");
  const [score, setScore] = useState("3");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const filteredScopes = scopes.filter((s) => s.type === scope);

  function reset() {
    setCompetency(SAFE_COMPETENCIES[0].key);
    setScope("art");
    setScopeId("");
    setScore("3");
    setNotes("");
  }

  function close() {
    onOpenChange(false);
    reset();
  }

  function handleSubmit() {
    if (!scopeId) {
      toast.error("Selecione um escopo");
      return;
    }

    startTransition(async () => {
      const result = await createAssessmentAction({
        competency,
        scope,
        scopeId,
        score: Number(score),
        notes,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Avaliação registrada");
      close();
      router.refresh();
    });
  }

  return (
    <ModalShell
      eyebrow="Avalie uma das 7 competências SAFe para um time, ART, value stream ou portfólio"
      footer={
        <>
          <Button onClick={close} type="button" variant="secondary">
            Cancelar
          </Button>
          <Button disabled={isPending} onClick={handleSubmit} type="button">
            <CheckIcon className="h-3.5 w-3.5" />
            Registrar avaliação
          </Button>
        </>
      }
      onClose={close}
      open={open}
      size="md"
      title="Nova avaliação"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assess-competency">Competência</Label>
          <Select onValueChange={setCompetency} value={competency}>
            <SelectTrigger id="assess-competency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SAFE_COMPETENCIES.map((c) => (
                <SelectItem key={c.key} value={c.key}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assess-scope">Tipo de escopo</Label>
            <Select
              onValueChange={(value) => {
                setScope(value);
                setScopeId("");
              }}
              value={scope}
            >
              <SelectTrigger id="assess-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assess-scope-id">
              {SCOPE_LABELS[scope] ?? "Escopo"}
            </Label>
            <Select onValueChange={setScopeId} value={scopeId}>
              <SelectTrigger id="assess-scope-id">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {filteredScopes.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assess-score">Nota (1–5)</Label>
          <Select onValueChange={setScore} value={score}>
            <SelectTrigger id="assess-score">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assess-notes">Notas</Label>
          <Textarea
            id="assess-notes"
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Contexto da avaliação (opcional)"
            value={notes}
          />
        </div>
      </div>
    </ModalShell>
  );
}
