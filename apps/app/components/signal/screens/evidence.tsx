"use client";

// Evidências — US4. Port de `signal-screens-3.jsx`.
//
// Cada linha é uma observação com a cadeia inteira visível: valor → janela →
// fonte → mapeamento → transformação → quem lançou. É a tela que alguém abre
// quando quer contestar um número, e por isso nada aqui é resumido.
//
// A ressalva (`flag`) aparece em destaque, não como nota de rodapé: uma
// observação congelada porque a fonte caiu continua contando para o ROI, e quem
// lê precisa saber disso ANTES de usar o número.

import { PageHeader, SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback, useMemo, useState } from "react";
import {
  type EvidenceRow,
  listEvidence,
} from "@/app/(signal)/actions/evidence";
import { fmtDay } from "@/lib/signal/dates";
import {
  type ChipOption,
  FilterChips,
  ScreenError,
  SkeletonRows,
  SmartEmptyState,
  useSignalData,
} from "../base";
import { CodeBlock, ListCard, ListCardHead, Note } from "../list-card";

const SOURCE_LABEL: Record<string, string> = {
  SYNC: "sync automático",
  MANUAL: "entrada manual",
  IMPORT: "importação",
};

const FILTERS: ChipOption[] = [
  { id: "flagged", label: "Com ressalva", tone: "red" },
  { id: "MANUAL", label: "Entrada manual", tone: "amber" },
  { id: "SYNC", label: "Sync automático", tone: "green" },
];

/** Uma observação com a cadeia inteira: valor, janela, fonte, conta, autor. */
function EvidenceCard({ r }: { r: EvidenceRow }) {
  const cardTone = r.flag ? "amber" : undefined;
  return (
    <ListCard tone={cardTone}>
      <ListCardHead
        code={r.code}
        context={r.initiativeCode}
        title={r.metricLabel}
      >
        <span
          className="display"
          style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}
        >
          {r.value}
          {r.unit ? (
            <span
              style={{ marginLeft: 4, fontSize: 11, color: "var(--ink-faint)" }}
            >
              {r.unit}
            </span>
          ) : null}
        </span>
      </ListCardHead>

      {/* A cadeia. Cada elo é o que torna o número defensável. */}
      <CodeBlock>
        <div>
          janela {fmtDay(r.windowStart)} – {fmtDay(r.windowEnd)}
          {r.rowCount === null
            ? ""
            : ` · ${r.rowCount.toLocaleString("pt-BR")} linhas`}
        </div>
        <div>
          {r.connectionLabel ?? "sem fonte conectada"}
          {r.mappingCode ? ` · ${r.mappingCode}` : ""} ·{" "}
          {SOURCE_LABEL[r.source] ?? r.source}
          {r.recordedBy ? ` · ${r.recordedBy}` : ""}
        </div>
        <div style={{ color: "var(--ink)" }}>↳ {r.transform}</div>
      </CodeBlock>

      {/* Ressalva em destaque: a observação congelada continua contando para
          o ROI, e quem lê precisa saber ANTES. */}
      {r.flag ? (
        <Note emphasis label="Ressalva" tone="amber">
          {r.flag}
        </Note>
      ) : null}
    </ListCard>
  );
}

export default function EvidenceScreen() {
  const [filter, setFilter] = useState("all");
  const fetcher = useCallback(() => listEvidence(), []);
  const { data, loading, error, reload } =
    useSignalData<EvidenceRow[]>(fetcher);

  const rows = useMemo(() => {
    const all = data ?? [];
    if (filter === "all") {
      return all;
    }
    if (filter === "flagged") {
      return all.filter((r) => r.flag);
    }
    return all.filter((r) => r.source === filter);
  }, [data, filter]);

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }

  const flaggedCount = (data ?? []).filter((r) => r.flag).length;

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow="Prova · observações"
        subtitle="Cada número que sustenta um ROI está aqui, com a janela medida, a fonte, a transformação e quem lançou. Nada é resumido: esta é a tela onde um resultado se contesta."
        title="Evidências"
        tone={flaggedCount > 0 ? "amber" : "accent"}
      />

      <FilterChips
        ariaLabel="Filtrar evidências"
        onChange={setFilter}
        options={FILTERS}
        value={filter}
      />

      {loading ? <SkeletonRows cols="1fr" rows={5} /> : null}

      {!loading && rows.length === 0 ? (
        <SmartEmptyState
          icon="fileText"
          subtitle="Uma observação é um número medido numa janela, com a origem declarada. Sem nenhuma, o ROI da iniciativa não tem lastro — e a tela de detalhe o mostra tachado, como “sem lastro”."
          title="Nenhuma observação neste filtro"
          tone="accent"
        />
      ) : null}

      {!loading && rows.length > 0 ? (
        <SectionCard
          title={`${rows.length} observaç${rows.length > 1 ? "ões" : "ão"}`}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map((r) => (
              <EvidenceCard key={r.code} r={r} />
            ))}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
