"use client";

// solution-train.tsx — Solution Train, wired to listSolutionTrains(). Rollup
// counts only — aggregated Program Board/ROAM/flow-metrics at Solution
// level (RF-80) are NOT wired; that's a follow-up plan, not this tier.
import { listSolutionTrains } from "@/app/(cosmos)/actions/solution-train";
import {
  Badge,
  ErrorState,
  KpiCard,
  PageHeader,
  SectionCard,
  useAction,
} from "../kit";

export default function SolutionTrainScreen() {
  const { data: trains, loading, error } = useAction(listSolutionTrains);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Plataforma"
        meta={
          <Badge tone="accent">{trains?.length ?? 0} solution trains</Badge>
        }
        subtitle="Rollup multi-ART por Solution Train."
        title="Large Solution"
      />
      {error && <ErrorState />}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {!(loading || error) && trains?.length === 0 && (
          <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
            Nenhum solution train cadastrado.
          </span>
        )}
        {trains?.map((t) => (
          <SectionCard
            key={t.id}
            subtitle={t.description ?? undefined}
            title={t.name}
            tone="accent"
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 10,
              }}
            >
              <KpiCard
                icon="grid"
                label="ARTs"
                tone="blue"
                value={t.artCount}
              />
              <KpiCard
                icon="layers"
                label="Épicos"
                tone="purple"
                value={t.epicCount}
              />
              <KpiCard
                icon="target"
                label="Capabilities"
                tone="green"
                value={t.capabilityCount}
              />
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
