"use client";

import { listCompetencyScores } from "@/app/(cosmos)/actions/measure";
// measure.tsx — Measure & Grow, wired to listCompetencyScores(). Latest score
// per SAFe core competency (7 competencies, 1–5 scale). DORA metrics (RF-78)
// have no corresponding Prisma model yet — out of scope, not fabricated here.
import {
  Badge,
  ErrorState,
  PageHeader,
  Progress,
  SectionCard,
  useAction,
} from "../kit";

function scoreTone(
  score: number | null
): "green" | "amber" | "red" | "neutral" {
  if (score === null) {
    return "neutral";
  }
  if (score < 2.5) {
    return "red";
  }
  if (score < 3.5) {
    return "amber";
  }
  return "green";
}

export default function MeasureScreen() {
  const { data, loading, error } = useAction(listCompetencyScores);
  const rows = data ?? [];

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="ART Board"
        meta={<Badge tone="accent">{rows.length} competências</Badge>}
        subtitle="Última avaliação por competência-chave SAFe (escala 1–5)."
        title="Measure & Grow"
      />
      {error && <ErrorState />}
      {!error && (
        <SectionCard subtitle="7 competências SAFe" title="Competências">
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
              Nenhuma avaliação encontrada.
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
                    <th style={{ padding: "8px 12px" }}>Competência</th>
                    <th style={{ padding: "8px 12px" }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.competency}
                      style={{ borderTop: "1px solid var(--hairline)" }}
                    >
                      <td style={{ padding: "10px 12px", fontSize: 13 }}>
                        {row.competencyLabel}
                      </td>
                      <td style={{ padding: "10px 12px", minWidth: 200 }}>
                        {row.score === null ? (
                          <span
                            style={{ fontSize: 13, color: "var(--ink-muted)" }}
                          >
                            — sem avaliação
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
                                tone={scoreTone(row.score)}
                                value={(row.score / 5) * 100}
                              />
                            </div>
                            <Badge soft tone={scoreTone(row.score)}>
                              {row.score.toFixed(1)}/5
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
