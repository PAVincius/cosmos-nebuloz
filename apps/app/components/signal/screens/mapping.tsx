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

import { Badge, PageHeader, SectionCard } from "@repo/design-system/cosmos/kit";
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
import { CodeBlock, ListCard, ListCardHead, MetaRow } from "../list-card";

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

function MappingCard({ m }: { m: MappingRow }) {
  const tone = m.stateTone;
  const cardTone = m.state === "ACTIVE" ? undefined : tone;
  const meta = [
    `${m.observationCount} ${m.observationCount === 1 ? "observação" : "observações"}`,
    m.changedBy ? `alterado por ${m.changedBy}` : null,
    new Date(m.changedAt).toLocaleDateString("pt-BR"),
  ];
  return (
    <ListCard tone={cardTone}>
      <ListCardHead
        code={`${m.code} · v${m.version}`}
        context={`${m.connectionName} → ${m.initiativeCode ?? "todas as iniciativas"}`}
        title={m.metricLabel}
      >
        <Badge tone={tone}>{m.stateLabel}</Badge>
      </ListCardHead>

      {/* Evento de origem e a conta. Nesta ordem: entra assim, sai assado. */}
      <CodeBlock>
        <div>{m.eventKey}</div>
        <div style={{ color: "var(--ink)" }}>
          ↳ {m.transform}{" "}
          <span style={{ color: "var(--ink-faint)" }}>[{m.unit}]</span>
        </div>
      </CodeBlock>

      <MetaRow items={meta} />
    </ListCard>
  );
}

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
              <MappingCard key={`${m.code}-${m.version}`} m={m} />
            ))}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
