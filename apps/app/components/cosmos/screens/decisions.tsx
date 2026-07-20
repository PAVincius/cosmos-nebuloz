"use client";

// decisions.tsx — Decision Log, wired to listDecisions(). Read-only
// chronological list of governance/budget/theme decisions with justification.
import { useEffect, useState } from "react";
import {
  type DecisionView,
  listDecisions,
} from "@/app/(cosmos)/actions/decisions";
import { Badge, ErrorState, PageHeader, SectionCard } from "../kit";

const DECISAO_TONE: Record<string, "green" | "red" | "amber" | "blue"> = {
  approved: "green",
  rejected: "red",
  deferred: "amber",
  changed: "blue",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function DecisionsScreen() {
  const [decisions, setDecisions] = useState<DecisionView[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listDecisions().then((r) => {
      if (r.ok) {
        setDecisions(r.data);
      } else {
        setError(true);
      }
      setLoading(false);
    });
  }, []);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · Governança"
        meta={<Badge tone="accent">{decisions.length} decisões</Badge>}
        subtitle="Registro de decisões de portfólio com justificativa."
        title="Decision Log"
      />
      {error && <ErrorState message="Não foi possível carregar as decisões." />}
      {!error && loading && (
        <div style={{ color: "var(--ink-subtle)" }}>Carregando…</div>
      )}
      {!(error || loading) && decisions.length === 0 && (
        <div style={{ color: "var(--ink-subtle)" }}>
          Nenhuma decisão registrada.
        </div>
      )}
      {!(error || loading) && decisions.length > 0 && (
        <SectionCard title="Histórico de decisões">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {decisions.map((d) => (
              <div
                key={d.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  padding: "12px 0",
                  borderBottom: "1px solid var(--hairline)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <span style={{ color: "var(--ink)", fontWeight: 600 }}>
                    {d.titulo}
                  </span>
                  <Badge tone={DECISAO_TONE[d.decisao] ?? "blue"}>
                    {d.decisao}
                  </Badge>
                </div>
                <span style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                  {d.justificativa}
                </span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--ink-faint)",
                    fontSize: 12,
                  }}
                >
                  <span>{d.tipo}</span>
                  <span>·</span>
                  <span>{fmt(d.dataDecisao)}</span>
                  {d.tags.map((tag) => (
                    <Badge key={tag} tone="neutral">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
