"use client";

// Escala de confiança — US7. Port de `meridian-registry.jsx`.
//
// O Meridian é dono da escala; Signal, Scaffold e Cosmos aplicam sem redefinir.
// Esta tela existe para que a definição tenha um lugar visível: vocabulário que
// só vive em comentário de código vira dois vocabulários no trimestre seguinte.

import type { MeridianConfidence } from "@repo/database";
import { Icon } from "@repo/design-system/cosmos/icons";
import { PageHeader, SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback } from "react";
import { type GapRow, listGapRegister } from "@/app/(meridian)/actions/gaps";
import { ScreenError, SkeletonCard, useMeridianData } from "../base";
import { CONFIDENCE } from "../seams";

const LEVELS: MeridianConfidence[] = ["MEASURED", "ESTIMATED", "DECLARED"];

const CRITERION: Record<MeridianConfidence, string> = {
  MEASURED:
    "Existe série no sistema de origem e alguém consegue reproduzir o número sem pedir ajuda.",
  ESTIMATED:
    "Derivado de amostra, proxy ou extrapolação. Honesto, mas não auditável linha a linha.",
  DECLARED:
    "Alguém afirmou. Vale como sinal e como hipótese — nunca como prova em relatório executivo.",
};

const CONSUMERS = [
  {
    product: "Signal",
    what: "Atribuição de ganho realizado",
    how: "Cada fator de atribuição carrega um selo, e o selo propaga até o relatório do CFO.",
  },
  {
    product: "Scaffold",
    what: "Métricas do caso de negócio",
    how: "Cada linha de base declara como foi obtida antes do patrocinador assinar.",
  },
  {
    product: "Cosmos",
    what: "Entrada de WSJF",
    how: "Valor estimado com selo baixo não pesa igual a valor medido.",
  },
];

export default function ConfidenceScaleScreen() {
  const fetcher = useCallback(() => listGapRegister({}), []);
  const { data, loading, error, reload } = useMeridianData<GapRow[]>(fetcher);

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }

  const gaps = data ?? [];
  const total = gaps.length;
  const countOf = (level: MeridianConfidence) =>
    gaps.filter((g) => g.confidence === level).length;

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow="Diagnose · vocabulário"
        subtitle="Três níveis, uma definição, a suíte inteira. O Meridian é dono da escala; os outros produtos aplicam sem redefinir — é o que permite comparar um número do Signal com um achado daqui."
        title="Escala de confiança"
        tone="purple"
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
          gap: "var(--gap)",
        }}
      >
        {loading
          ? LEVELS.map((l) => <SkeletonCard key={l} />)
          : LEVELS.map((level) => {
              const c = CONFIDENCE[level];
              const n = countOf(level);
              return (
                <SectionCard
                  action={
                    <span
                      className="mono"
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: `var(--${c.tone}-text)`,
                      }}
                    >
                      {n}/{total}
                    </span>
                  }
                  bodyStyle={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                  icon="scale"
                  key={level}
                  title={c.label}
                  tone={c.tone}
                >
                  <div
                    style={{
                      fontSize: 13.5,
                      color: "var(--ink-muted)",
                      lineHeight: 1.55,
                    }}
                  >
                    {c.desc}.
                  </div>
                  <div
                    style={{
                      height: 5,
                      borderRadius: 99,
                      background: "var(--surface-3)",
                      overflow: "hidden",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        height: "100%",
                        width: `${total ? (n / total) * 100 : 0}%`,
                        background: `var(--${c.tone})`,
                        borderRadius: 99,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--ink-faint)",
                      lineHeight: 1.5,
                      paddingTop: 10,
                      borderTop: "1px solid var(--hairline)",
                    }}
                  >
                    {CRITERION[level]}
                  </div>
                </SectionCard>
              );
            })}
      </div>

      <SectionCard
        bodyStyle={{ padding: 0 }}
        icon="outbound"
        subtitle="Definida aqui, aplicada em três produtos"
        title="Quem consome a escala"
      >
        {CONSUMERS.map((c, i) => (
          <div
            key={c.product}
            style={{
              display: "grid",
              gridTemplateColumns: "120px minmax(0,1fr)",
              gap: 16,
              padding: "15px 18px",
              borderBottom:
                i < CONSUMERS.length - 1 ? "1px solid var(--hairline)" : "none",
              alignItems: "start",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 99,
                  background: "var(--accent)",
                  flexShrink: 0,
                }}
              />
              <span
                style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}
              >
                {c.product}
              </span>
            </span>
            <span style={{ minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--ink)",
                }}
              >
                {c.what}
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: 12.5,
                  color: "var(--ink-muted)",
                  marginTop: 3,
                  lineHeight: 1.5,
                }}
              >
                {c.how}
              </span>
            </span>
          </div>
        ))}
      </SectionCard>

      <div
        style={{
          display: "flex",
          gap: 13,
          padding: "16px 18px",
          borderRadius: "var(--r-lg)",
          background: "var(--purple-soft)",
          border: "1px solid rgba(var(--purple-rgb),.28)",
        }}
      >
        <Icon
          name="shield"
          size={17}
          style={{
            color: "var(--purple-text)",
            flexShrink: 0,
            marginTop: 2,
          }}
        />
        <div>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: "var(--purple-text)",
            }}
          >
            Ninguém inventa uma segunda escala
          </div>
          <p
            style={{
              margin: "5px 0 0",
              fontSize: 13,
              color: "var(--ink-muted)",
              lineHeight: 1.6,
              maxWidth: "84ch",
            }}
          >
            Se o Signal criasse "alta / média / baixa" para atribuição enquanto
            o Meridian usa "medido / estimado / declarado", o mesmo dado teria
            dois rótulos e nenhum relatório conseguiria somar os dois. A escala
            é uma só e mora num arquivo só —{" "}
            <span
              className="mono"
              style={{ fontSize: 12, color: "var(--ink)" }}
            >
              components/meridian/seams.tsx
            </span>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
