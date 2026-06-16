"use client";

import type { PageMeta } from "@/app/actions/_base";
import type { DecisionLogEntryPublic } from "@/app/actions/governance/schema";

const DECISAO_LABELS: Record<string, { label: string; class: string }> = {
  approved: { label: "Aprovado", class: "bg-green-100 text-green-800" },
  rejected: { label: "Rejeitado", class: "bg-red-100 text-red-800" },
  deferred: { label: "Adiado", class: "bg-yellow-100 text-yellow-800" },
  changed: { label: "Alterado", class: "bg-blue-100 text-blue-800" },
};

const TIPO_LABELS: Record<string, string> = {
  epic_decision: "Épico",
  budget_decision: "Budget",
  theme_decision: "Tema",
};

type Props = {
  items: DecisionLogEntryPublic[];
  meta: PageMeta;
};

export function DecisionLogTable({ items, meta }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border py-16 text-center text-muted-foreground">
        Nenhuma decisão registrada ainda.
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">
            <th className="px-4 py-3">Data</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Alvo</th>
            <th className="px-4 py-3">Decisão</th>
            <th className="px-4 py-3">Justificativa</th>
          </tr>
        </thead>
        <tbody>
          {items.map((entry) => {
            const decisao =
              DECISAO_LABELS[entry.decisao] ??
              ({ label: entry.decisao, class: "bg-slate-100" } as {
                label: string;
                class: string;
              });
            return (
              <tr
                className="border-b last:border-0 hover:bg-muted/20"
                key={entry.id}
              >
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground text-xs">
                  {new Date(entry.dataDecisao).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3">
                  {TIPO_LABELS[entry.tipo] ?? entry.tipo}
                </td>
                <td className="max-w-[180px] truncate px-4 py-3 font-mono text-xs">
                  {entry.targetId}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-0.5 font-medium text-xs ${decisao.class}`}
                  >
                    {decisao.label}
                  </span>
                </td>
                <td className="max-w-[320px] truncate px-4 py-3 text-muted-foreground">
                  {entry.justificativa}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {meta.pageCount > 1 && (
        <div className="border-t px-4 py-3 text-muted-foreground text-xs">
          Página {meta.page} de {meta.pageCount} — {meta.total} entradas
        </div>
      )}
    </div>
  );
}
