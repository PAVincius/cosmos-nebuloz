"use client";

// roadmap.tsx — Roadmap, wired to listRoadmapItems(). Simple chronological
// list (not a full Gantt/timeline visualization — that's a later polish pass).
import { useEffect, useState } from "react";
import {
  listRoadmapItems,
  type RoadmapItemView,
} from "@/app/(cosmos)/actions/roadmap";
import { Badge, ErrorState, PageHeader, SectionCard } from "../kit";

const STATUS_TONE: Record<string, "green" | "blue" | "neutral"> = {
  PLANNED: "neutral",
  IN_PROGRESS: "blue",
  DONE: "green",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });
}

export default function RoadmapScreen() {
  const [items, setItems] = useState<RoadmapItemView[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listRoadmapItems().then((r) => {
      if (r.ok) {
        setItems(r.data);
      } else {
        setError(true);
      }
      setLoading(false);
    });
  }, []);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · Planejamento"
        meta={<Badge tone="accent">{items.length} itens</Badge>}
        subtitle="Linha do tempo de épicos e marcos do portfólio."
        title="Roadmap"
      />
      {error && <ErrorState />}
      <SectionCard
        bodyStyle={{ padding: "12px 16px" }}
        icon="calendar"
        title="Linha do tempo"
        tone="accent"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!(loading || error) && items.length === 0 && (
            <span style={{ color: "var(--ink-muted)", fontSize: 13 }}>
              Nenhum item de roadmap registrado.
            </span>
          )}
          {items.map((item) => {
            const tone = STATUS_TONE[item.status] ?? "neutral";
            return (
              <div
                key={item.id}
                style={{
                  alignItems: "center",
                  background: "var(--surface)",
                  border: "1px solid var(--hairline)",
                  borderRadius: 12,
                  display: "flex",
                  gap: 12,
                  padding: "12px 16px",
                }}
              >
                <div
                  style={{
                    background: item.color,
                    borderRadius: "50%",
                    flexShrink: 0,
                    height: 10,
                    width: 10,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      color: "var(--ink)",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {item.title}
                  </div>
                  <div style={{ color: "var(--ink-faint)", fontSize: 11.5 }}>
                    {fmt(item.startDate)} → {fmt(item.endDate)}
                  </div>
                </div>
                {item.milestone && <Badge tone="amber">Marco</Badge>}
                <Badge tone={tone}>{item.status}</Badge>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
