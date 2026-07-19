"use client";

// strategy.tsx — Strategy Map: pillars grouping strategic themes, wired to
// listStrategyPillars(). Read-only map — pillar/theme detail drill-down and
// editing are out of scope for this Tier-1 read-data pass.
import { useEffect, useState } from "react";
import {
  listStrategyPillars,
  type PillarView,
} from "@/app/(cosmos)/actions/strategy";
import { Badge, PageHeader, SectionCard, type Tone } from "../kit";

const HEALTH_TONE: Record<string, "green" | "amber" | "red"> = {
  on: "green",
  watch: "amber",
  behind: "red",
};

// StrategyPillar.tone is a free-form Prisma String column (default "accent"),
// not a Tone enum — validate against the known set instead of trusting it.
const VALID_TONES = new Set<Tone>([
  "green",
  "red",
  "amber",
  "blue",
  "purple",
  "accent",
  "neutral",
]);
function toTone(value: string): Tone {
  return VALID_TONES.has(value as Tone) ? (value as Tone) : "accent";
}

function PillarCard({ pillar }: { pillar: PillarView }) {
  return (
    <SectionCard
      icon="anchor"
      subtitle={`${pillar.themes.length} temas`}
      title={pillar.name}
      tone={toTone(pillar.tone)}
    >
      {pillar.themes.length === 0 ? (
        <span style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
          Nenhum tema vinculado.
        </span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {pillar.themes.map((theme) => {
            const tone = HEALTH_TONE[theme.healthStatus] ?? "green";
            return (
              <div
                key={theme.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  fontSize: 12.5,
                }}
              >
                <span style={{ color: "var(--ink)" }}>{theme.title}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="mono" style={{ color: "var(--ink-muted)" }}>
                    {theme.targetAllocationPct ?? "—"}%
                  </span>
                  <Badge dot tone={tone}>
                    {theme.healthStatus}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

export default function StrategyScreen() {
  const [pillars, setPillars] = useState<PillarView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listStrategyPillars().then((r) => {
      if (r.ok) {
        setPillars(r.data);
      }
      setLoading(false);
    });
  }, []);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · Estratégia"
        meta={<Badge tone="accent">{pillars.length} pilares</Badge>}
        subtitle="Pilares estratégicos e os temas que os compõem."
        title="Strategy Map"
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {!loading && pillars.length === 0 && (
          <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
            Nenhum pilar estratégico cadastrado.
          </span>
        )}
        {pillars.map((p) => (
          <PillarCard key={p.id} pillar={p} />
        ))}
      </div>
    </div>
  );
}
