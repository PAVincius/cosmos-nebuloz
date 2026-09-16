"use client";

// verdict-badge.tsx — o veredito e os números que o sustentam, sempre juntos.
//
// Este componente existe por causa de UMA regra: ROI nunca aparece sozinho.
// Centralizar a apresentação aqui é o que torna a regra estrutural em vez de
// disciplinar — uma tela não consegue exibir o múltiplo sem trazer a versão da
// fórmula e a confiança porque não existe um componente que mostre só ele.
//
// A alternativa (cada tela montando seu próprio bloco e lembrando de incluir os
// três) já falhou no protótipo, onde a lista mostrava o múltiplo cru.

import { Icon } from "@repo/design-system/cosmos/icons";
import { fmtAdoption } from "@/lib/signal/adoption";
import { fmtMultiple } from "@/lib/signal/roi";

export type ValueReadingProps = {
  multiple: number | null;
  /** Versão da fórmula que produziu o múltiplo. Nulo = ainda não há fórmula. */
  formulaVersion: number | null;
  confidenceScore: number;
  confidenceBand: string;
  adoptionPct: number;
  verdictLabel: string;
  verdictTone: string;
  verdictAction?: string;
  compact?: boolean;
};

const BAND_LABEL: Record<string, string> = {
  HIGH: "Alta",
  MEDIUM: "Média",
  LOW: "Baixa",
  NONE: "Sem dado",
};

/**
 * Leitura de valor de uma iniciativa.
 *
 * Sem lastro (confiança 0 ou fórmula ausente), o múltiplo aparece **tachado e
 * rotulado**, nunca escondido: esconder faria a iniciativa parecer não medida,
 * quando na verdade ela foi medida mal. A diferença importa para quem decide.
 */
/** Badge neutro do "sem veredito": chip sem tom, não vermelho nem verde. */
const UNBACKED_BADGE = {
  background: "var(--chip-bg)",
  color: "var(--ink-muted)",
  border: "1px solid var(--hairline)",
} as const;

function verdictBadgeStyle(tone: string) {
  return {
    background: `var(--${tone}-soft)`,
    color: `var(--${tone}-text)`,
    border: `1px solid rgba(var(--${tone}-rgb),.28)`,
  };
}

export function ValueReading({
  multiple,
  formulaVersion,
  confidenceScore,
  confidenceBand,
  adoptionPct,
  verdictLabel,
  verdictTone,
  verdictAction,
  compact = false,
}: ValueReadingProps) {
  const unbacked = confidenceScore === 0 || formulaVersion === null;
  // Sem lastro não há veredito: "candidata a parada" para um rascunho que
  // ainda nem lançou a primeira linha da conta é acusação, não leitura. O
  // badge diz o que falta em vez de fingir que julgou.
  const badgeLabel = unbacked ? "Sem veredito" : verdictLabel;
  const badge = unbacked ? UNBACKED_BADGE : verdictBadgeStyle(verdictTone);
  const action = unbacked
    ? "Assinar o baseline e versionar a fórmula"
    : verdictAction;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: compact ? 10 : 14,
        flexWrap: "wrap",
      }}
    >
      {/* Veredito primeiro: é a decisão, os números são a justificativa. */}
      <span
        className="mono"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 9px",
          borderRadius: 99,
          fontSize: 11,
          fontWeight: 700,
          ...badge,
        }}
      >
        {badgeLabel}
      </span>

      <span
        style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}
        title={
          unbacked
            ? "Retorno sem lastro: falta fórmula versionada ou o score de confiança é zero."
            : "Múltiplo de retorno sobre investimento."
        }
      >
        <span
          className="display"
          style={{
            fontSize: compact ? 16 : 22,
            fontWeight: 800,
            letterSpacing: "-.02em",
            fontVariantNumeric: "tabular-nums",
            color: unbacked ? "var(--ink-faint)" : "var(--ink)",
            textDecoration: unbacked ? "line-through" : "none",
          }}
        >
          {fmtMultiple(multiple)}
        </span>
        {unbacked ? (
          <span
            className="mono"
            style={{
              fontSize: 10.5,
              color: "var(--red-text)",
              fontWeight: 700,
            }}
          >
            sem lastro
          </span>
        ) : (
          // A versão da fórmula é irmã siamesa do múltiplo. Nunca uma sem a
          // outra — é o que permite contestar o número em vez de acreditar nele.
          <span
            className="mono"
            style={{ fontSize: 10.5, color: "var(--ink-faint)" }}
          >
            fórmula v{formulaVersion}
          </span>
        )}
      </span>

      <span
        className="mono"
        style={{ fontSize: 11, color: "var(--ink-muted)" }}
        title="Score de confiança: quanto o número acima merece crédito."
      >
        confiança {confidenceScore}
        <span style={{ color: "var(--ink-faint)" }}>
          {" "}
          · {BAND_LABEL[confidenceBand] ?? confidenceBand}
        </span>
      </span>

      {/* Adoção anda com resultado. Uma sem a outra é meia verdade. */}
      <span
        className="mono"
        style={{ fontSize: 11, color: "var(--ink-muted)" }}
        title="Percentual da base licenciada que de fato usa."
      >
        adoção {fmtAdoption(adoptionPct)}
      </span>

      {action !== undefined && !compact ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11.5,
            fontWeight: 600,
            color: "var(--ink-subtle)",
          }}
        >
          <Icon name="arrowUpRight" size={12} />
          {action}
        </span>
      ) : null}
    </div>
  );
}
