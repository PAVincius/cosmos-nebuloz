"use client";

// themes.tsx — Temas Estratégicos (portfolio investment themes), wired to
// listThemes(). Card grid: health, target allocation, epic count, avg progress.
import { useEffect, useState } from "react";
import { listThemes, type ThemeView } from "@/app/(cosmos)/actions/themes";
import { Badge, KpiCard, PageHeader, Progress, SectionCard } from "../kit";

const HEALTH_TONE: Record<string, "green" | "amber" | "red"> = {
  on: "green",
  watch: "amber",
  behind: "red",
};

function ThemeCard({ theme }: { theme: ThemeView }) {
  const tone = HEALTH_TONE[theme.healthStatus] ?? "green";
  return (
    <SectionCard
      action={
        <Badge dot tone={tone}>
          {theme.healthStatus}
        </Badge>
      }
      subtitle={theme.description ?? undefined}
      title={theme.title}
      tone={tone}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12.5,
          }}
        >
          <span style={{ color: "var(--ink-muted)" }}>Alocação-alvo</span>
          <span
            className="mono"
            style={{ fontWeight: 700, color: "var(--ink)" }}
          >
            {theme.targetAllocationPct ?? "—"}%
          </span>
        </div>
        <Progress tone={tone} value={theme.avgProgress} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11.5,
            color: "var(--ink-faint)",
          }}
        >
          <span>{theme.epicCount} épicos</span>
          <span>{theme.horizon ?? "—"}</span>
        </div>
      </div>
    </SectionCard>
  );
}

export default function ThemesScreen() {
  const [themes, setThemes] = useState<ThemeView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listThemes().then((r) => {
      if (r.ok) {
        setThemes(r.data);
      }
      setLoading(false);
    });
  }, []);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · Estratégia"
        meta={<Badge tone="accent">{themes.length} temas</Badge>}
        subtitle="Alocação de investimento por tema, alinhada à estratégia de portfólio."
        title="Temas Estratégicos"
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {!loading && themes.length === 0 && (
          <KpiCard
            hint="Crie um tema estratégico"
            icon="target"
            label="Nenhum tema"
            tone="accent"
            value="—"
          />
        )}
        {themes.map((t) => (
          <ThemeCard key={t.id} theme={t} />
        ))}
      </div>
    </div>
  );
}
