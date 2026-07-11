"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { StarIcon } from "lucide-react";
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

/**
 * Presentational list of assessments. Creation moved to the page header CTA
 * (MeasureGrowHeaderActions -> NewAssessmentModal), which calls the same
 * createAssessmentAction and refreshes this server-fetched list via
 * router.refresh() — see measure-grow-header-actions.tsx.
 */
export function AssessmentsTab({
  initialAssessments,
  scopes,
}: {
  initialAssessments: AssessmentItem[];
  scopes: ScopeOption[];
}) {
  function scopeLabel(id: string): string {
    return scopes.find((s) => s.id === id)?.label ?? id;
  }

  const scoreIndex = (score: number) =>
    Math.min(5, Math.max(1, Math.round(score)));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Avalie as 7 competências SAFe para cada ART, time ou portfólio.
      </p>

      {initialAssessments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center text-muted-foreground text-sm">
          <StarIcon className="mb-2 h-6 w-6" />
          Nenhum assessment registrado. Crie o primeiro acima.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {initialAssessments.map((a) => {
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
