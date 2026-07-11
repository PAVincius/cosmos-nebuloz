"use client";

import { useRouter } from "next/navigation";
import { DataTable } from "../../../../components/data-table";

export type BacklogFeatureRow = {
  id: string;
  title: string;
  storyPoints: number;
  wsjfScore: number;
};

// ─── FeatureBacklogTable ────────────────────────────────────────────────────
// Client wrapper around the shared DataTable primitive — needed because
// DataTable's row onClick must run inside a client boundary. Rows link to the
// real feature detail route (/features/[featureId]), matching the
// prototype's `onclick="go('epic/'+id)"` row-click affordance.

export function FeatureBacklogTable({ rows }: { rows: BacklogFeatureRow[] }) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "var(--ink-faint)" }}>
        Nenhuma feature aberta no backlog
      </div>
    );
  }

  return (
    <DataTable<BacklogFeatureRow>
      columns={[
        {
          key: "id",
          label: "ID",
          mono: true,
          render: (row) => row.id.slice(0, 8),
        },
        { key: "title", label: "Feature" },
        {
          key: "storyPoints",
          label: "SP",
          align: "right",
          mono: true,
        },
        {
          key: "wsjfScore",
          label: "WSJF",
          align: "right",
          render: (row) => (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                color: "var(--purple-text)",
              }}
            >
              {row.wsjfScore.toFixed(1)}
            </span>
          ),
        },
      ]}
      getRowKey={(row) => row.id}
      onRowClick={(row) => router.push(`/features/${row.id}`)}
      rows={rows}
    />
  );
}
