"use client";

// capacity.tsx — Capacity Planning, wired to listTeamCapacity(). Real Team
// rows joined to their most recent TeamCapacitySnapshot (SP expected vs.
// delivered, utilization %); "—" where no snapshot exists yet.
import { useEffect, useState } from "react";
import {
  type CapacityView,
  listTeamCapacity,
} from "@/app/(cosmos)/actions/capacity";
import { Badge, ErrorState, PageHeader, Progress, SectionCard } from "../kit";

function utilTone(pct: number | null): "green" | "amber" | "red" | "neutral" {
  if (pct === null) {
    return "neutral";
  }
  if (pct >= 100) {
    return "red";
  }
  if (pct >= 85) {
    return "amber";
  }
  return "green";
}

export default function CapacityScreen() {
  const [rows, setRows] = useState<CapacityView[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTeamCapacity().then((r) => {
      if (r.ok) {
        setRows(r.data);
      } else {
        setError(true);
      }
      setLoading(false);
    });
  }, []);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="ART Board"
        meta={<Badge tone="accent">{rows.length} times</Badge>}
        subtitle="Capacidade por time — SP esperados vs. entregues no último snapshot."
        title="Capacity Planning"
      />
      {error && <ErrorState />}
      {!error && (
        <SectionCard subtitle="Ordenado por nome do time" title="Times">
          {loading ? (
            <div
              style={{ padding: 16, color: "var(--ink-muted)", fontSize: 13 }}
            >
              Carregando...
            </div>
          ) : rows.length === 0 ? (
            <div
              style={{ padding: 16, color: "var(--ink-muted)", fontSize: 13 }}
            >
              Nenhum time encontrado.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      textAlign: "left",
                      fontSize: 12,
                      color: "var(--ink-muted)",
                    }}
                  >
                    <th style={{ padding: "8px 12px" }}>Time</th>
                    <th style={{ padding: "8px 12px" }}>Velocity</th>
                    <th style={{ padding: "8px 12px" }}>SP esperado</th>
                    <th style={{ padding: "8px 12px" }}>SP entregue</th>
                    <th style={{ padding: "8px 12px" }}>Utilização</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.teamId}
                      style={{ borderTop: "1px solid var(--hairline)" }}
                    >
                      <td style={{ padding: "10px 12px", fontSize: 13 }}>
                        {row.teamName}
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 13 }}>
                        {row.velocity ?? "—"}
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 13 }}>
                        {row.expectedSp ?? "—"}
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 13 }}>
                        {row.actualSp ?? "—"}
                      </td>
                      <td style={{ padding: "10px 12px", minWidth: 160 }}>
                        {row.utilizationPct === null ? (
                          <span
                            style={{ fontSize: 13, color: "var(--ink-muted)" }}
                          >
                            —
                          </span>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <Progress
                                tone={utilTone(row.utilizationPct)}
                                value={row.utilizationPct}
                              />
                            </div>
                            <Badge soft tone={utilTone(row.utilizationPct)}>
                              {row.utilizationPct}%
                            </Badge>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
