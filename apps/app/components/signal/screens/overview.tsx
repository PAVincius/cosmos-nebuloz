"use client";

// Visão geral — US3. Port de `signal-screens-3.jsx`.
//
// A tela de entrada do CFO. A ordem responde à pergunta dele, não à estrutura
// do banco:
//
//   1. quanto voltou sobre quanto entrou — e quanto está em risco
//   2. onde cada iniciativa cai na matriz adoção × valor
//   3. o que precisa de decisão HOJE, em ordem de urgência
//   4. onde o dinheiro está, por área
//
// O valor em risco vem no MESMO card do múltiplo agregado, de propósito.
// Separá-los deixaria a primeira leitura ser "3,2×, ótimo" — e o número bom
// esconderia que um terço do orçamento está preso em iniciativas sem prova.

import { Icon } from "@repo/design-system/cosmos/icons";
import { PageHeader, SectionCard } from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { getPortfolioSummary } from "@/app/(signal)/actions/initiatives";
import { fmtAdoption } from "@/lib/signal/adoption";
import { CATEGORY_LABEL } from "@/lib/signal/lifecycle";
import {
  type PortfolioSummary,
  rankForDecision,
  toMatrix,
} from "@/lib/signal/portfolio";
import { fmtBRL, fmtMultiple } from "@/lib/signal/roi";
import { VERDICT_META } from "@/lib/signal/verdict";
import { Eyebrow, ScreenError, SkeletonCard, useSignalData } from "../base";
import { AdoptionValueMatrix } from "../matrix";

type Bars = { adoptionBar: number; valueBar: number };

function PortfolioCard({
  summary,
  bars,
}: {
  summary: PortfolioSummary;
  bars: Bars;
}) {
  const healthy =
    summary.multiple !== null && summary.multiple >= bars.valueBar;
  const atRiskShare =
    summary.invested > 0 ? summary.atRisk / summary.invested : 0;

  return (
    <SectionCard title="Portfólio">
      <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
        <span>
          <Eyebrow>Retorno agregado</Eyebrow>
          <div
            className="display"
            style={{
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: "-.03em",
              color: healthy ? "var(--green-text)" : "var(--amber-text)",
            }}
          >
            {fmtMultiple(summary.multiple)}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
            {fmtBRL(summary.returned)} sobre {fmtBRL(summary.invested)}
          </div>
        </span>

        {/* Mesmo card, de propósito: o múltiplo bom não pode aparecer sozinho. */}
        <span>
          <Eyebrow tone="red">Em risco</Eyebrow>
          <div
            className="display"
            style={{
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: "-.03em",
              color:
                summary.atRisk > 0 ? "var(--red-text)" : "var(--ink-faint)",
            }}
          >
            {fmtBRL(summary.atRisk)}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
            {summary.atRisk > 0
              ? `${Math.round(atRiskShare * 100)}% do investido, em iniciativas sem prova de valor`
              : "Nenhuma iniciativa sem prova de valor"}
          </div>
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginTop: 16,
          paddingTop: 14,
          borderTop: "1px dashed var(--hairline)",
        }}
      >
        {(
          Object.entries(summary.byVerdict) as [
            keyof typeof VERDICT_META,
            number,
          ][]
        ).map(([verdict, count]) => {
          const meta = VERDICT_META[verdict];
          return (
            <span
              className="mono"
              key={verdict}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 700,
                background: `var(--${meta.tone}-soft)`,
                color: `var(--${meta.tone}-text)`,
                opacity: count === 0 ? 0.45 : 1,
              }}
              title={meta.why}
            >
              {count} {meta.label}
            </span>
          );
        })}
      </div>
    </SectionCard>
  );
}

function DecisionQueue({
  summary,
  onOpen,
}: {
  summary: PortfolioSummary;
  onOpen: (code: string) => void;
}) {
  // Só o que precisa de decisão. Listar as provadas junto transformaria a fila
  // em mais uma lista de tudo — e o CFO já tem a tela de iniciativas para isso.
  const queue = useMemo(
    () =>
      rankForDecision(summary.items)
        .filter((i) => i.verdict !== "PROVEN")
        .slice(0, 6),
    [summary.items]
  );

  if (queue.length === 0) {
    return (
      <SectionCard title="Precisa de decisão">
        <p
          style={{
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 12.5,
            color: "var(--green-text)",
          }}
        >
          <Icon name="check" size={14} />
          Toda iniciativa ativa está provada — usa e rende acima da régua.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      subtitle="Ordenado por urgência de decisão, não por tamanho: o que consome orçamento sem entregar vem primeiro."
      title="Precisa de decisão"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {queue.map((i) => {
          const meta = VERDICT_META[i.verdict];
          return (
            <button
              className="btn lift"
              key={i.code}
              onClick={() => onOpen(i.code)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--hairline)",
                background: "var(--surface-2)",
                flexWrap: "wrap",
              }}
              type="button"
            >
              <span
                className="mono"
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 99,
                  background: `var(--${meta.tone}-soft)`,
                  color: `var(--${meta.tone}-text)`,
                }}
              >
                {meta.label}
              </span>
              <span
                style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}
              >
                {i.code} · {i.name}
              </span>
              <span
                className="mono"
                style={{
                  marginLeft: "auto",
                  fontSize: 11,
                  color: "var(--ink-muted)",
                }}
              >
                {fmtAdoption(i.adoptionPct)} · {fmtMultiple(i.multiple)} ·{" "}
                {fmtBRL(i.invested)}
              </span>
              {/* A ação sugerida é o que transforma a fila em encaminhamento. */}
              <span
                style={{
                  flexBasis: "100%",
                  fontSize: 11.5,
                  color: "var(--ink-subtle)",
                }}
              >
                {meta.action} — {meta.why}
              </span>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}

function GroupTable({
  title,
  subtitle,
  groups,
  translate,
}: {
  title: string;
  subtitle: string;
  groups: PortfolioSummary["byBusinessUnit"];
  translate?: (key: string) => string;
}) {
  return (
    <SectionCard subtitle={subtitle} title={title}>
      {groups.map((g) => (
        // Duas metades que quebram juntas: nome + contagem à esquerda, os
        // números à direita. Em tela estreita a segunda metade desce inteira
        // em vez de cada número cair numa linha.
        <div
          key={g.key}
          style={{
            display: "flex",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: "4px 12px",
            padding: "8px 0",
            borderBottom: "1px dashed var(--hairline)",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: 8,
              minWidth: 0,
            }}
          >
            <span
              style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}
            >
              {translate ? translate(g.key) : g.key}
            </span>
            <span
              className="mono"
              style={{
                fontSize: 10.5,
                color: "var(--ink-faint)",
                whiteSpace: "nowrap",
              }}
            >
              {g.count} {g.count === 1 ? "iniciativa" : "iniciativas"}
            </span>
          </span>
          <span
            className="mono"
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "baseline",
              gap: 12,
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}
            >
              {fmtMultiple(g.multiple)}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--ink-faint)",
                minWidth: 90,
                textAlign: "right",
              }}
            >
              {fmtBRL(g.invested)}
            </span>
            {g.atRisk > 0 ? (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--red-text)",
                  minWidth: 90,
                  textAlign: "right",
                }}
                title="Investido em iniciativas sem prova de valor"
              >
                {fmtBRL(g.atRisk)} em risco
              </span>
            ) : (
              <span style={{ minWidth: 90 }} />
            )}
          </span>
        </div>
      ))}
    </SectionCard>
  );
}

export default function OverviewScreen() {
  const router = useRouter();
  const fetcher = useCallback(() => getPortfolioSummary(), []);
  const { data, loading, error, reload } =
    useSignalData<PortfolioSummary>(fetcher);

  const open = useCallback(
    (code: string) => router.push(`/signal/initiative/${code}`),
    [router]
  );

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }
  if (loading || !data) {
    return <SkeletonCard />;
  }

  // As réguas vêm do agregado calculado no servidor, nunca de constante local:
  // são do tenant, e uma cópia aqui divergiria da que produziu os vereditos.
  const bars = data.bars;
  const points = toMatrix(data.items, bars);

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow="Valor · visão geral"
        subtitle="Onde o dinheiro rende e onde não rende. Só iniciativas ativas entram no agregado — encerrada é história, não portfólio."
        title="Visão geral"
        tone="accent"
      />

      <PortfolioCard bars={bars} summary={data} />

      <SectionCard
        subtitle="Nem adoção nem retorno decidem sozinhos. O cruzamento nomeia o que fazer — e cada quadrante tem um dono diferente."
        title="Adoção × valor"
      >
        <AdoptionValueMatrix
          adoptionBar={bars.adoptionBar}
          onSelect={open}
          points={points}
          valueBar={bars.valueBar}
        />
      </SectionCard>

      <DecisionQueue onOpen={open} summary={data} />

      <div
        style={{
          display: "grid",
          gap: "var(--gap)",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
        }}
      >
        <GroupTable
          groups={data.byBusinessUnit}
          subtitle="Maior investimento primeiro."
          title="Por área"
        />
        <GroupTable
          groups={data.byCategory}
          subtitle="Onde o retorno se concentra por tipo de ganho."
          title="Por categoria"
          translate={(k) =>
            CATEGORY_LABEL[k as keyof typeof CATEGORY_LABEL] ?? k
          }
        />
      </div>
    </div>
  );
}
