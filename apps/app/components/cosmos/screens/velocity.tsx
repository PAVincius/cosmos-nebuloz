"use client";

// velocity.tsx — Velocity, wired to listRecentSprints(). Say-do ratio
// (committed capacity vs. delivered velocity) per closed sprint, RF-77
// benchmark line at 80%.
import { listRecentSprints } from "@/app/(cosmos)/actions/velocity";
import {
  Badge,
  ErrorState,
  PageHeader,
  Progress,
  SectionCard,
  useAction,
} from "../kit";

function ratioTone(pct: number | null): "green" | "amber" | "red" | "neutral" {
  if (pct === null) {
    return "neutral";
  }
  if (pct >= 80) {
    return "green";
  }
  if (pct >= 60) {
    return "amber";
  }
  return "red";
}

export default function VelocityScreen() {
  const { data: sprints, loading, error } = useAction(listRecentSprints);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Analytics"
        meta={<Badge tone="accent">{sprints?.length ?? 0} sprints</Badge>}
        subtitle="Say-do ratio (comprometido vs. entregue) — benchmark ≥ 80%."
        title="Velocity"
      />
      {error && <ErrorState />}
      <SectionCard
        bodyStyle={{ padding: "12px 16px" }}
        icon="trendingUp"
        title="Sprints recentes"
        tone="accent"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!(loading || error) && sprints?.length === 0 && (
            <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
              Nenhum sprint encerrado ainda.
            </span>
          )}
          {sprints?.map((s) => {
            const tone = ratioTone(s.sayDoRatioPct);
            return (
              <div
                key={s.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 120px 160px 70px",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: "1px solid var(--hairline)",
                  background: "var(--surface)",
                }}
              >
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}
                >
                  {s.name}
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 12.5, color: "var(--ink-muted)" }}
                >
                  {s.velocity ?? "—"} / {s.capacity ?? "—"} SP
                </span>
                <Progress tone={tone} value={s.sayDoRatioPct ?? 0} />
                <Badge tone={tone}>
                  {s.sayDoRatioPct !== null ? `${s.sayDoRatioPct}%` : "—"}
                </Badge>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
