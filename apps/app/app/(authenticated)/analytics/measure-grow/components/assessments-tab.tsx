"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { PlusIcon, StarIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { createAssessmentAction } from "@/app/actions/measure-grow";
import { SAFE_COMPETENCIES } from "@/app/actions/measure-grow/schema";
import { appDesign } from "@/lib/app-design";

type ActionItem = {
  id: string;
  title: string;
  status: string;
};

type AssessmentItem = {
  id: string;
  competency: string;
  competencyLabel: string;
  scope: string;
  scopeId: string;
  score: number;
  notes: string | null;
  assessedAt: Date;
  actions: ActionItem[];
};

type ScopeOption = {
  id: string;
  label: string;
  type: string;
};

const SCORE_LABELS = [
  "",
  "Lançando",
  "Praticando",
  "Prosperando",
  "Acelerando",
  "Liderando",
];

const SCORE_COLORS = [
  "",
  "bg-rose-500/15 text-rose-400",
  "bg-amber-500/15 text-amber-400",
  "bg-yellow-500/15 text-yellow-400",
  "bg-emerald-500/15 text-emerald-400",
  "bg-blue-500/15 text-blue-400",
];

const SCOPE_LABELS: Record<string, string> = {
  team: "Time",
  art: "ART",
  value_stream: "Value Stream",
  portfolio: "Portfólio",
};

type FormState = {
  competency: string;
  scope: string;
  scopeId: string;
  score: number;
  notes: string;
};

const DEFAULT_FORM: FormState = {
  competency: SAFE_COMPETENCIES[0].key,
  scope: "art",
  scopeId: "",
  score: 3,
  notes: "",
};

export function AssessmentsTab({
  initialAssessments,
  scopes,
}: {
  initialAssessments: AssessmentItem[];
  scopes: ScopeOption[];
}) {
  const [assessments, setAssessments] = useState(initialAssessments);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const filteredScopes = scopes.filter((s) => s.type === form.scope);

  function scopeLabel(id: string): string {
    return scopes.find((s) => s.id === id)?.label ?? id;
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await createAssessmentAction(form);
      if (result.ok) {
        setAssessments((prev) => [
          {
            id: result.data.id,
            competency: form.competency,
            competencyLabel:
              SAFE_COMPETENCIES.find((c) => c.key === form.competency)?.label ??
              form.competency,
            scope: form.scope,
            scopeId: form.scopeId,
            score: form.score,
            notes: form.notes || null,
            assessedAt: new Date(),
            actions: [],
          },
          ...prev,
        ]);
        setOpen(false);
        setForm(DEFAULT_FORM);
      }
    });
  }

  const scoreIndex = (score: number) =>
    Math.min(5, Math.max(1, Math.round(score)));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Avalie as 7 competências SAFe para cada ART, time ou portfólio.
        </p>
        <Dialog onOpenChange={setOpen} open={open}>
          <DialogTrigger asChild>
            <Button className="gap-2" size="sm">
              <PlusIcon className="h-4 w-4" />
              Novo Assessment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Novo Assessment de Competência</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              {/* Competency */}
              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-sm">Competência SAFe</label>
                <Select
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, competency: v }))
                  }
                  value={form.competency}
                >
                  <SelectTrigger>
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

              {/* Scope type + entity */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-medium text-sm">Escopo</label>
                  <Select
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, scope: v, scopeId: "" }))
                    }
                    value={form.scope}
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
                  <label className="font-medium text-sm">
                    {SCOPE_LABELS[form.scope] ?? "Entidade"}
                  </label>
                  <Select
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, scopeId: v }))
                    }
                    value={form.scopeId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar…" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredScopes.length === 0 ? (
                        <SelectItem disabled value="__none">
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

              {/* Score */}
              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-sm">
                  Score: {form.score} — {SCORE_LABELS[form.score]}
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      className={`flex-1 rounded py-2 font-medium text-xs transition-colors ${
                        n <= form.score
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                      key={n}
                      onClick={() => setForm((p) => ({ ...p, score: n }))}
                      type="button"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-sm">
                  Evidências / Notas
                </label>
                <Textarea
                  onChange={(e) =>
                    setForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  placeholder="Descreva evidências que justificam o score…"
                  rows={3}
                  value={form.notes}
                />
              </div>

              <Button
                disabled={isPending || !form.scopeId}
                onClick={handleSubmit}
              >
                {isPending ? "Salvando…" : "Salvar Assessment"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {assessments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center text-muted-foreground text-sm">
          <StarIcon className="mb-2 h-6 w-6" />
          Nenhum assessment registrado. Crie o primeiro acima.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assessments.map((a) => {
            const idx = scoreIndex(a.score);
            return (
              <div className={`${appDesign.section} p-4`} key={a.id}>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-sm leading-snug">
                    {a.competencyLabel}
                  </span>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 font-semibold text-xs tabular-nums ${SCORE_COLORS[idx]}`}
                  >
                    {a.score.toFixed(1)}/5
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground text-xs">
                  {SCOPE_LABELS[a.scope] ?? a.scope} — {scopeLabel(a.scopeId)}
                </p>
                <p className="mt-1 text-muted-foreground text-xs italic">
                  {SCORE_LABELS[idx]}
                </p>
                {a.notes && (
                  <p className="mt-2 line-clamp-2 text-muted-foreground/80 text-xs">
                    {a.notes}
                  </p>
                )}
                {a.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {a.actions.slice(0, 2).map((ia) => (
                      <Badge className="text-xs" key={ia.id} variant="outline">
                        {ia.title}
                      </Badge>
                    ))}
                    {a.actions.length > 2 && (
                      <Badge className="text-xs" variant="secondary">
                        +{a.actions.length - 2}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
