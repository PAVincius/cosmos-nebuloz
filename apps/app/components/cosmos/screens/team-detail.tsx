import { getTeam } from "@/app/(cosmos)/actions/teams";
import { KpiCard, PageHeader, SectionCard } from "../kit";
import { ComingSoon } from "../shell";

export default async function TeamDetailScreen({ param }: { param?: string }) {
  if (!param) {
    return <ComingSoon id="team" />;
  }
  const res = await getTeam(param);
  if (!(res.ok && res.data)) {
    return <ComingSoon id="team" />;
  }
  const t = res.data;
  return (
    <div className="fade-in">
      <PageHeader eyebrow="Portfolio · Time" title={t.name} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <KpiCard icon="layers" label="WIP" tone="accent" value={t.wip} />
        <KpiCard
          icon="trendingUp"
          label="Velocity"
          tone="green"
          unit="SP"
          value={t.velocity ?? "—"}
        />
        <KpiCard
          icon="target"
          label="Membros"
          tone="purple"
          value={t.members.length}
        />
      </div>
      <div style={{ marginBottom: 18 }}>
        <SectionCard
          bodyStyle={{ padding: "12px 16px" }}
          icon="target"
          subtitle={`${t.members.length} itens`}
          title="Membros"
          tone="accent"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {t.members.map((m) => (
              <div
                key={`${m.name}-${m.role}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}
                >
                  {m.name}
                </span>
                <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
      <SectionCard
        bodyStyle={{ padding: "12px 16px" }}
        icon="trendingUp"
        subtitle={`${t.recentCapacity.length} itens`}
        title="Capacidade recente"
        tone="green"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {t.recentCapacity.map((c) => (
            <div
              key={c.period}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 100px 100px",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                className="mono"
                style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}
              >
                {c.period}
              </span>
              <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                Esperado {c.expectedSp}
              </span>
              <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                Real {c.actualSp}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
