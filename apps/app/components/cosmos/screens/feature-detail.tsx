import { getFeature } from "@/app/(cosmos)/actions/epics";
import {
  Badge,
  KpiCard,
  NavButton,
  PageHeader,
  Progress,
  SectionCard,
} from "../kit";
import { ComingSoon } from "../shell";

export default async function FeatureDetailScreen({
  param,
}: {
  param?: string;
}) {
  if (!param) {
    return <ComingSoon id="feature" />;
  }
  const res = await getFeature(param);
  if (!(res.ok && res.data)) {
    return <ComingSoon id="feature" />;
  }
  const f = res.data;
  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · Feature"
        meta={
          <>
            <Badge tone="accent">{f.statusId}</Badge>
            <Badge dot tone="green">
              WSJF {f.wsjfScore}
            </Badge>
          </>
        }
        title={f.title}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <KpiCard
          icon="dollar"
          label="Business Value"
          tone="green"
          value={f.bv}
        />
        <KpiCard
          icon="clock"
          label="Time Criticality"
          tone="amber"
          value={f.tc}
        />
        <KpiCard
          icon="shield"
          label="Risk Reduction"
          tone="blue"
          value={f.rr}
        />
        <KpiCard icon="layers" label="Job Size" tone="purple" value={f.js} />
      </div>
      <SectionCard
        bodyStyle={{ padding: "12px 16px" }}
        icon="activity"
        subtitle={`${f.storyPoints} SP`}
        title="Progresso"
        tone="accent"
      >
        <Progress tone="accent" value={f.progressPct} />
      </SectionCard>
      <SectionCard
        bodyStyle={{ padding: "12px 16px" }}
        icon="check"
        subtitle={`${f.acceptanceCriteria.length} itens`}
        title="Critérios de Aceite"
        tone="green"
      >
        {f.acceptanceCriteria.length === 0 ? (
          <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
            Nenhum critério cadastrado.
          </span>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {f.acceptanceCriteria.map((criterion, index) => (
              <div
                key={`${index}-${criterion}`}
                style={{ display: "flex", alignItems: "center", gap: 10 }}
              >
                <Badge dot tone="green">
                  {index + 1}
                </Badge>
                <span style={{ fontSize: 13, color: "var(--ink)" }}>
                  {criterion}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
      {f.epicId && (
        <div style={{ marginTop: 18 }}>
          <NavButton
            icon="arrowUpRight"
            param={f.epicId}
            to="epic"
            variant="secondary"
          >
            Ver Épico pai
          </NavButton>
        </div>
      )}
    </div>
  );
}
