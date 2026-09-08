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

import { Icon } from "@repo/design-system/cosmos/icons";
import { PageHeader, SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback, useMemo, useState } from "react";
import {
  type EvidenceRow,
  listEvidence,
} from "@/app/(signal)/actions/evidence";
import {
  type ChipOption,
  FilterChips,
  ScreenError,
  SkeletonRows,
  SmartEmptyState,
  useSignalData,
} from "../base";

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

const fmtDate = (d: Date) =>
  new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

/** Uma observação com a cadeia inteira: valor, janela, fonte, conta, autor. */
function EvidenceCard({ r }: { r: EvidenceRow }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: "var(--r-md)",
        border: `1px solid ${r.flag ? "rgba(var(--amber-rgb),.35)" : "var(--hairline)"}`,
        background: r.flag ? "var(--amber-soft)" : "var(--surface-2)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
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
          {r.code}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--ink)",
          }}
        >
          {r.metricLabel}
        </span>
        <span
          className="display"
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: "var(--ink)",
          }}
        >
          {r.value}
          {r.unit ? (
            <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
              {" "}
              {r.unit}
            </span>
          ) : null}
        </span>
        <span
          className="mono"
          style={{
            marginLeft: "auto",
            fontSize: 10.5,
            color: "var(--ink-faint)",
          }}
        >
          {r.initiativeCode}
        </span>
      </div>

      {/* A cadeia. Cada elo é o que torna o número defensável. */}
      <div
        className="mono"
        style={{
          marginTop: 8,
          padding: "8px 10px",
          borderRadius: "var(--r-sm)",
          background: "var(--surface-3)",
          fontSize: 11,
          lineHeight: 1.6,
          color: "var(--ink-muted)",
          overflowX: "auto",
        }}
      >
        <div>
          janela {fmtDate(r.windowStart)} – {fmtDate(r.windowEnd)}
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
      </div>

      {/* Ressalva em destaque: a observação congelada continua
            contando para o ROI, e quem lê precisa saber ANTES. */}
      {r.flag ? (
        <p
          style={{
            margin: "9px 0 0",
            display: "flex",
            alignItems: "flex-start",
            gap: 7,
            fontSize: 12,
            lineHeight: 1.5,
            color: "var(--amber-text)",
          }}
        >
          <Icon name="alert" size={13} style={{ marginTop: 2 }} />
          {r.flag}
        </p>
      ) : null}
    </div>
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
