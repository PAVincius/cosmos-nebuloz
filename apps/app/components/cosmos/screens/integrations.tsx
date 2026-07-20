"use client";

// integrations.tsx — Integrações, wired to listIntegrations(). Connector
// status cards only — connect/configure flow and field mapping (RF-81) are
// NOT wired; this lists connection state, it doesn't manage it.
import { listIntegrations } from "@/app/(cosmos)/actions/integrations";
import { Badge, ErrorState, PageHeader, SectionCard, useAction } from "../kit";

const STATUS_TONE: Record<string, "green" | "red" | "amber"> = {
  ACTIVE: "green",
  INACTIVE: "amber",
  ERROR: "red",
};

function fmt(iso: string | null) {
  if (!iso) {
    return "Nunca sincronizado";
  }
  return `Sincronizado em ${new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;
}

export default function IntegrationsScreen() {
  const { data: items, loading, error } = useAction(listIntegrations);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Plataforma"
        meta={<Badge tone="accent">{items?.length ?? 0} conectores</Badge>}
        subtitle="Conectores externos e estado de sincronização."
        title="Integrações"
      />
      {error && <ErrorState />}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        {!(loading || error) && items?.length === 0 && (
          <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
            Nenhuma integração configurada.
          </span>
        )}
        {items?.map((i) => (
          <SectionCard
            action={
              <Badge dot tone={STATUS_TONE[i.status] ?? "neutral"}>
                {i.status}
              </Badge>
            }
            key={i.id}
            subtitle={i.source}
            title={i.name}
            tone={STATUS_TONE[i.status] ?? "neutral"}
          >
            <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
              {fmt(i.lastSyncAt)}
            </span>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
