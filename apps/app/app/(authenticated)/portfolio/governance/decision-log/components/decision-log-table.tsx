"use client";

import { Badge } from "@repo/design-system/components/cosmos/badge";
import { Calendar } from "lucide-react";
import { useState } from "react";
import type { PageMeta } from "@/app/actions/_base";
import type {
  Decisao,
  DecisionLogEntryPublic,
} from "@/app/actions/governance/schema";

const DECISAO_LABELS: Record<
  Decisao,
  { label: string; tone: "green" | "red" | "amber" | "blue" }
> = {
  approved: { label: "Aprovado", tone: "green" },
  rejected: { label: "Rejeitado", tone: "red" },
  deferred: { label: "Adiado", tone: "amber" },
  changed: { label: "Alterado", tone: "blue" },
};

const TIPO_LABELS: Record<string, string> = {
  epic_decision: "Épico",
  budget_decision: "Budget",
  theme_decision: "Tema",
};

const FILTERS: { key: "all" | Decisao; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "approved", label: "Aprovadas" },
  { key: "rejected", label: "Rejeitadas" },
  { key: "deferred", label: "Adiadas" },
];

type Props = {
  items: DecisionLogEntryPublic[];
  meta: PageMeta;
};

export function DecisionLogTable({ items, meta }: Props) {
  const [filter, setFilter] = useState<"all" | Decisao>("all");

  const filtered =
    filter === "all" ? items : items.filter((e) => e.decisao === filter);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex w-fit gap-1 rounded-cosmos-pill border border-hairline bg-surface-2 p-1">
        {FILTERS.map((f) => (
          <button
            className="rounded-cosmos-pill px-3 py-1.5 font-semibold text-[12px] transition-colors"
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={
              filter === f.key
                ? {
                    background: "var(--accent-c)",
                    color: "var(--on-accent, #fff)",
                  }
                : { color: "var(--ink-faint)" }
            }
            type="button"
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-cosmos-lg border border-hairline bg-surface-2 py-16 text-center text-[13px] text-ink-muted">
          Nenhuma decisão registrada{filter !== "all" ? " neste filtro" : ""}.
        </div>
      ) : (
        <div className="relative pl-7">
          <span className="absolute top-2 bottom-2 left-2 w-0.5 bg-hairline" />
          <div className="flex flex-col gap-3">
            {filtered.map((row) => {
              const decisao = DECISAO_LABELS[row.decisao];
              return (
                <div
                  className="lift relative rounded-cosmos-lg border border-hairline bg-surface p-4 shadow-cosmos-sm"
                  key={row.id}
                >
                  <span
                    className="absolute top-5 left-[-23px] h-3.5 w-3.5 rounded-full border-[3px]"
                    style={{
                      background: `var(--${decisao.tone}-c, var(--accent-c))`,
                      borderColor: "var(--canvas)",
                    }}
                  />
                  <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
                    <span className="rounded-cosmos-sm bg-accent-soft px-1.5 py-0.5 font-bold font-mono text-[11.5px] text-accent-text">
                      {TIPO_LABELS[row.tipo] ?? row.tipo}
                    </span>
                    <Badge dot tone={decisao.tone}>
                      {decisao.label}
                    </Badge>
                    <span className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] text-ink-subtle">
                      <Calendar
                        aria-hidden
                        className="text-ink-muted"
                        size={13}
                      />
                      {new Date(row.dataDecisao).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="truncate font-bold font-mono text-[14px] text-ink">
                    {row.targetId}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[13px] text-ink-muted leading-[1.5]">
                    {row.justificativa}
                  </p>
                  <div className="mt-2.5 flex items-center gap-2 text-[11.5px] text-ink-muted">
                    <span className="font-mono text-ink-muted">
                      {row.decisorId}
                    </span>
                    {row.valueStreamId && (
                      <span className="ml-auto rounded-cosmos-sm border border-hairline bg-chip px-2 py-0.5 font-semibold text-[11px] text-ink-subtle">
                        {row.valueStreamId}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {meta.pageCount > 1 && (
        <p className="px-1 text-[11.5px] text-ink-muted">
          Página {meta.page} de {meta.pageCount} — {meta.total} entradas
        </p>
      )}
    </div>
  );
}
