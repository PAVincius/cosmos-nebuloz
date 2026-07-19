"use client";

// dependencies.tsx — Dependências, wired to listDependencies(). Lists real
// DependencyLink rows (blocking → blocked feature) with status + critical-path flag.
import { useEffect, useState } from "react";
import {
  type DependencyView,
  listDependencies,
} from "@/app/(cosmos)/actions/dependencies";
import { Badge, ErrorState, PageHeader, SectionCard } from "../kit";

const STATUS_TONE: Record<string, "green" | "amber" | "red" | "neutral"> = {
  "not-started": "neutral",
  "on-track": "green",
  "at-risk": "amber",
  blocked: "red",
  completed: "green",
};

export default function DependenciesScreen() {
  const [deps, setDeps] = useState<DependencyView[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listDependencies().then((r) => {
      if (r.ok) {
        setDeps(r.data);
      } else {
        setError(true);
      }
      setLoading(false);
    });
  }, []);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="ART Board"
        meta={<Badge tone="accent">{deps.length} dependências</Badge>}
        subtitle="Vínculos entre features de times diferentes, com status e caminho crítico."
        title="Dependências"
      />
      {error && <ErrorState />}
      <SectionCard
        bodyStyle={{ padding: "12px 16px" }}
        icon="gitBranch"
        title="Registro de dependências"
        tone="accent"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!(loading || error) && deps.length === 0 && (
            <span style={{ color: "var(--ink-muted)", fontSize: 13 }}>
              Nenhuma dependência registrada.
            </span>
          )}
          {deps.map((d) => {
            const tone = STATUS_TONE[d.status] ?? "neutral";
            return (
              <div
                key={d.id}
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
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      color: "var(--ink)",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {d.title}
                  </div>
                  <div style={{ color: "var(--ink-faint)", fontSize: 11.5 }}>
                    {d.blockingTitle} → {d.blockedTitle}
                  </div>
                </div>
                {d.criticalPath && <Badge tone="red">Caminho crítico</Badge>}
                <Badge tone={tone}>{d.status}</Badge>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
