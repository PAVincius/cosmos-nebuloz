"use client";

// webhooks.tsx — Webhooks, wired to listWebhooks(). Lists configured
// endpoints; creating/editing a webhook (RF-82) is NOT wired.
import { listWebhooks } from "@/app/(cosmos)/actions/webhooks";
import { Badge, ErrorState, PageHeader, SectionCard, useAction } from "../kit";

export default function WebhooksScreen() {
  const { data: hooks, loading, error } = useAction(listWebhooks);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Plataforma"
        meta={<Badge tone="accent">{hooks?.length ?? 0} webhooks</Badge>}
        subtitle="Endpoints configurados para eventos críticos do portfólio."
        title="Webhooks"
      />
      {error && <ErrorState />}
      <SectionCard
        bodyStyle={{ padding: "12px 16px" }}
        icon="webhook"
        title="Endpoints"
        tone="accent"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!(loading || error) && hooks?.length === 0 && (
            <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
              Nenhum webhook configurado.
            </span>
          )}
          {hooks?.map((h) => (
            <div
              key={h.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid var(--hairline)",
                background: "var(--surface)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  className="mono"
                  style={{
                    fontSize: 12.5,
                    color: "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {h.url}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  {h.eventTypes.map((e) => (
                    <Badge key={e} tone="neutral">
                      {e}
                    </Badge>
                  ))}
                </div>
              </div>
              <Badge dot tone={h.active ? "green" : "neutral"}>
                {h.active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
