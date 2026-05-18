"use client";

import type {
  GovernedEpicWithDetails,
  ApprovalRequestWithSteps,
} from "@/app/actions/governance";
import { GovernanceEpicCard } from "./governance-epic-card";

const COLUMNS = [
  { key: "draft",    label: "Rascunho",   color: "bg-slate-100 dark:bg-slate-800"   },
  { key: "review",   label: "Em Revisão", color: "bg-yellow-50 dark:bg-yellow-950"  },
  { key: "approved", label: "Aprovado",   color: "bg-green-50 dark:bg-green-950"    },
  { key: "on_hold",  label: "Em Espera",  color: "bg-orange-50 dark:bg-orange-950"  },
  { key: "rejected", label: "Rejeitado",  color: "bg-red-50 dark:bg-red-950"        },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

type Props = {
  epics: GovernedEpicWithDetails[];
  requests: ApprovalRequestWithSteps[];
};

export function GovernanceBoard({ epics, requests }: Props) {
  const requestByEpicId = new Map(
    requests
      .filter((r) => r.governedEpicId !== null)
      .map((r) => [r.governedEpicId as string, r])
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const colEpics = epics.filter(
          (e) => e.governanceStatus === (col.key as ColumnKey)
        );
        return (
          <div key={col.key} className="flex min-w-[260px] flex-col gap-2">
            <div
              className={`flex items-center justify-between rounded-t-lg px-3 py-2 ${col.color}`}
            >
              <span className="text-sm font-semibold">{col.label}</span>
              <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-medium dark:bg-black/30">
                {colEpics.length}
              </span>
            </div>
            <div className="flex flex-col gap-2 rounded-b-lg border bg-card p-2">
              {colEpics.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Nenhum épico
                </p>
              )}
              {colEpics.map((epic) => (
                <GovernanceEpicCard
                  key={epic.id}
                  epic={epic}
                  request={requestByEpicId.get(epic.id) ?? null}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
