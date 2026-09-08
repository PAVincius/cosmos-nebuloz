"use client";

// Mapeamento de métricas — US4. Port de `signal-screens-3.jsx`.
//
// Cada linha responde "de onde este número vem?" com a conta escrita por
// extenso. A transformação aparece em monoespaçada e por inteiro, nunca
// truncada: ela É o conteúdo. Um mapeamento cuja fórmula você não consegue ler
// não serve para contestar o número, e contestar é o ponto.
//
// Só a versão corrente de cada código aparece. As anteriores continuam no banco
// (as observações apontam para elas) e serão exibidas quando houver tela de
// histórico — listar todas aqui misturaria "o que vale hoje" com "o que valia".

import { PageHeader, SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback, useMemo, useState } from "react";
import { listMappings, type MappingRow } from "@/app/(signal)/actions/mapping";
import {
  type ChipOption,
  FilterChips,
  ScreenError,
  SkeletonRows,
  SmartEmptyState,
  useSignalData,
} from "../base";

const STATE_FILTERS: ChipOption[] = [
  { id: "BROKEN", label: "Fonte caída", tone: "red" },
  { id: "STALE", label: "Fonte atrasada", tone: "amber" },
  { id: "REVIEW", label: "Em revisão", tone: "amber" },
  { id: "ACTIVE", label: "Ativo", tone: "green" },
];

/** Estado problemático primeiro: é o que muda o número na tela do CFO. */
const STATE_RANK: Record<string, number> = {
  BROKEN: 0,
  REVIEW: 1,
  STALE: 2,
  ACTIVE: 3,
};

export default function MappingScreen() {
  const [state, setState] = useState("all");
  const fetcher = useCallback(() => listMappings(), []);
  const { data, loading, error, reload } = useSignalData<MappingRow[]>(fetcher);

  const rows = useMemo(() => {
    const all = data ?? [];
    // Só a versão corrente de cada código.
    const latest = new Map<string, MappingRow>();
    for (const m of all) {
      const seen = latest.get(m.code);
      if (!seen || m.version > seen.version) {
        latest.set(m.code, m);
      }
    }
    return [...latest.values()]
      .filter((m) => state === "all" || m.state === state)
      .sort((a, b) => {
        const byState = (STATE_RANK[a.state] ?? 9) - (STATE_RANK[b.state] ?? 9);
        return byState === 0 ? a.code.localeCompare(b.code) : byState;
      });
  }, [data, state]);

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow="Dado · rastreabilidade"
        subtitle="Cada linha diz de onde um número vem e como ele é calculado. É contra esta lista que se contesta um resultado — por isso a conta aparece por inteiro."
        title="Mapeamento de métricas"
        tone="accent"
      />

      <FilterChips
        ariaLabel="Filtrar mapeamentos por estado"
        onChange={setState}
        options={STATE_FILTERS}
        value={state}
      />

      {loading ? <SkeletonRows cols="1fr" rows={5} /> : null}

      {!loading && rows.length === 0 ? (
        <SmartEmptyState
          icon="ruler"
          subtitle="Um mapeamento liga um evento da fonte a uma métrica de negócio, com a transformação declarada. Sem ele, toda observação precisa da conta escrita à mão a cada lançamento."
          title="Nenhum mapeamento neste filtro"
          tone="accent"
        />
      ) : null}

      {!loading && rows.length > 0 ? (
        <SectionCard
          title={`${rows.length} mapeamento${rows.length > 1 ? "s" : ""}`}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map((m) => (
              <div
                key={`${m.code}-${m.version}`}
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--hairline)",
                  background: "var(--surface-2)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--ink-faint)",
                    }}
                  >
                    {m.code} · v{m.version}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--ink)",
                    }}
                  >
                    {m.metricLabel}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                    {m.connectionName} →{" "}
                    {m.initiativeCode ?? "todas as iniciativas"}
                  </span>
                  <span
                    className="mono"
                    style={{
                      marginLeft: "auto",
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "2px 9px",
                      borderRadius: 99,
                      background: `var(--${m.stateTone}-soft)`,
                      color: `var(--${m.stateTone}-text)`,
                    }}
                  >
                    {m.stateLabel}
                  </span>
                </div>

                {/* Evento de origem e a conta. Nesta ordem: entra assim, sai
                    assado. */}
                <div
                  className="mono"
                  style={{
                    marginTop: 9,
                    padding: "8px 10px",
                    borderRadius: "var(--r-sm)",
                    background: "var(--surface-3)",
                    fontSize: 11,
                    lineHeight: 1.6,
                    color: "var(--ink-muted)",
                    overflowX: "auto",
                  }}
                >
                  <div>{m.eventKey}</div>
                  <div style={{ color: "var(--ink)" }}>
                    ↳ {m.transform}{" "}
                    <span style={{ color: "var(--ink-faint)" }}>
                      [{m.unit}]
                    </span>
                  </div>
                </div>

                <div
                  className="mono"
                  style={{
                    display: "flex",
                    gap: 14,
                    flexWrap: "wrap",
                    marginTop: 7,
                    fontSize: 10.5,
                    color: "var(--ink-faint)",
                  }}
                >
                  <span>
                    {m.observationCount}{" "}
                    {m.observationCount === 1 ? "observação" : "observações"}
                  </span>
                  {m.changedBy ? <span>alterado por {m.changedBy}</span> : null}
                  <span>
                    {new Date(m.changedAt).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
