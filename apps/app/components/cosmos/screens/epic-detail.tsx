import { getEpic } from "@/app/(cosmos)/actions/epics";
import { Badge, KpiCard, PageHeader, Progress, SectionCard } from "../kit";
import { ComingSoon } from "../shell";

export default async function EpicDetailScreen({ param }: { param?: string }) {
  if (!param) {
    return <ComingSoon id="epic" />;
  }
  const res = await getEpic(param);
  if (!(res.ok && res.data)) {
    return <ComingSoon id="epic" />;
  }
  const e = res.data;
  // descriptionMd: fetched for a future markdown-rendered body section, not yet implemented
  const investEntries = e.investBreakdown
    ? Object.entries(e.investBreakdown)
    : [];
  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · Épico"
        meta={
          <>
            <Badge tone="accent">{e.lifecycleStatus}</Badge>
            {e.wsjf !== null && (
              <Badge dot tone="green">
                WSJF {e.wsjf}
              </Badge>
            )}
          </>
        }
        title={e.title}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <KpiCard
          icon="trendingUp"
          label="WSJF"
          tone="accent"
          value={e.wsjf ?? "—"}
        />
        <KpiCard
          icon="target"
          label="INVEST"
          tone="green"
          unit="/100"
          value={e.investScore ?? "—"}
        />
        <KpiCard
          icon="layers"
          label="Job Size"
          tone="purple"
          unit="SP"
          value={e.sizePoints ?? "—"}
        />
      </div>
      {e.hypothesis && (
        <div style={{ marginBottom: 18 }}>
          <SectionCard
            bodyStyle={{ padding: "12px 16px" }}
            icon="flask"
            title="Hipótese"
            tone="accent"
          >
            <p style={{ fontSize: 13, color: "var(--ink)", margin: 0 }}>
              {e.hypothesis}
            </p>
          </SectionCard>
        </div>
      )}
      {investEntries.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <SectionCard
            bodyStyle={{ padding: "12px 16px" }}
            icon="target"
            subtitle="INVEST"
            title="INVEST breakdown"
            tone="green"
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
                gap: 10,
              }}
            >
              {investEntries.map(([key, { score, rationale }]) => (
                <div
                  key={key}
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <Badge tone="green">
                    {key}: {score}
                  </Badge>
                  <span style={{ fontSize: 11.5, color: "var(--ink-muted)" }}>
                    {rationale}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}
      <SectionCard
        bodyStyle={{ padding: "12px 16px" }}
        icon="grid"
        subtitle={`${e.features.length} itens`}
        title="Features"
        tone="accent"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {e.features.map((f) => (
            <div
              key={f.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 80px 120px",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}
              >
                {f.title}
              </span>
              <span
                className="mono"
                style={{ fontSize: 12, color: "var(--ink-muted)" }}
              >
                WSJF {f.wsjfScore}
              </span>
              <Progress tone="accent" value={f.progressPct} />
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
