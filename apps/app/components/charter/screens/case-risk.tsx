"use client";

// case-risk.tsx — aba Risco do detalhe do caso (FR-5). Saiu de
// case-detail.tsx quando ganhou a entrada da reavaliação: junto, o arquivo
// passaria do teto de 800 linhas do size:guard.
//
// Sem pontuação, a aba não desenha perfil nem posição na matriz: o default 1
// do intake não é medição, e desenhá-lo seria afirmar "Baixo" (SRD §7).

import { Icon } from "@repo/design-system/cosmos/icons";
import { SectionCard } from "@repo/design-system/cosmos/kit";
import type { UseCaseDetail } from "@/app/(charter)/actions/cases";
import {
  RISK_CATEGORY_DESC,
  RISK_CATEGORY_LABEL,
  riskAxisTone,
  type Tone,
} from "@/lib/charter/rules";
import { BarRow, MetaCell } from "../base";
import { RiskMiniMatrix } from "../parts";
import { FS } from "../type-scale";
import { GatedFooterAction } from "./gated-footer-action";

const CELL = {
  padding: "10px 12px",
  borderRadius: 9,
  background: "var(--surface-2)",
  border: "1px solid var(--hairline)",
} as const;

export function CaseRiskPanel({
  data,
  onRescore,
}: {
  data: UseCaseDetail;
  onRescore: () => void;
}) {
  const { risks, severity, likelihood, score } = data;

  if (!risks || severity === null || likelihood === null || score === null) {
    return (
      <SectionCard
        icon="target"
        subtitle="Sete categorias, de 1 a 5"
        title="Perfil de risco por categoria"
        tone="accent"
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            padding: "40px 24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--r-lg)",
              display: "grid",
              placeItems: "center",
              background: "var(--accent-soft)",
              color: "var(--accent-text)",
              border: "1px solid rgba(var(--accent-rgb),.22)",
            }}
          >
            <Icon name="target" size={20} />
          </div>
          <div
            style={{ fontSize: FS.forte, fontWeight: 700, color: "var(--ink)" }}
          >
            Ninguém pontuou o risco deste caso
          </div>
          <p
            style={{
              margin: "0 0 6px",
              fontSize: FS.base,
              color: "var(--ink-muted)",
              maxWidth: 440,
              lineHeight: 1.6,
            }}
          >
            O intake grava 1 em cada eixo, e padrão não é medição. Até alguém
            pontuar, o caso fica sem score, fora da matriz de risco e como “sem
            pontuação” na fila.
          </p>
          <GatedFooterAction
            allowed={data.can.score}
            icon="target"
            onClick={onRescore}
            reason={data.scoreDenial}
          >
            Pontuar risco
          </GatedFooterAction>
        </div>
      </SectionCard>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.3fr 1fr",
        gap: "var(--gap)",
        alignItems: "start",
      }}
    >
      <SectionCard
        action={
          <GatedFooterAction
            allowed={data.can.score}
            icon="target"
            onClick={onRescore}
            reason={data.scoreDenial}
            variant="secondary"
          >
            Reavaliar risco
          </GatedFooterAction>
        }
        icon="target"
        subtitle="Severidade declarada de 1 a 5 · o composto usa a maior severidade"
        title="Perfil de risco por categoria"
        tone="red"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {(
            Object.entries(RISK_CATEGORY_LABEL) as [
              keyof typeof RISK_CATEGORY_LABEL,
              string,
            ][]
          ).map(([id, label]) => {
            const val = risks[id.toLowerCase() as keyof typeof risks];
            return (
              <BarRow
                hint={RISK_CATEGORY_DESC[id]}
                key={id}
                label={label}
                max={5}
                suffix="/5"
                tone={riskAxisTone(val)}
                value={val}
              />
            );
          })}
        </div>
      </SectionCard>
      <SectionCard
        icon="gauge"
        subtitle="Severidade × probabilidade"
        title="Posição na matriz"
        tone={data.riskTone as Tone}
      >
        <RiskMiniMatrix lik={likelihood} sev={severity} />
        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10,
          }}
        >
          <div style={CELL}>
            <MetaCell label="Severidade" mono value={`${severity}/5`} />
          </div>
          <div style={CELL}>
            <MetaCell label="Probabilidade" mono value={`${likelihood}/5`} />
          </div>
          <div
            style={{
              ...CELL,
              background: `rgba(var(--${data.riskTone}-rgb),.09)`,
              border: `1px solid rgba(var(--${data.riskTone}-rgb),.22)`,
            }}
          >
            <MetaCell
              label="Composto"
              mono
              tone={data.riskTone as Tone}
              value={score}
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
