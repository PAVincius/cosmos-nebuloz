"use client";

// seams.tsx — componentes de FRONTEIRA, compartilhados entre produtos.
//
// Regra do Mapa de Fronteiras: dado de outro produto aparece com selo de
// proveniência e sem nenhuma affordance de edição. Um produto nunca edita
// entidade alheia — se o Cosmos pudesse editar o enunciado de um gap, a próxima
// reavaliação não teria contra o quê comparar.

import type { MeridianConfidence } from "@repo/database";
import { Icon } from "@repo/design-system/cosmos/icons";
import { Button } from "@repo/design-system/cosmos/kit";
import type { ReactNode } from "react";

/**
 * Escala de confiança — vocabulário ÚNICO da suíte, dono: Meridian.
 *
 * Se o Signal criasse "alta / média / baixa" para atribuição enquanto o Meridian
 * usa "medido / estimado / declarado", o mesmo dado teria dois rótulos e nenhum
 * relatório conseguiria somar os dois. A escala mora aqui e é aplicada sem
 * redefinição pelos outros produtos.
 */
export const CONFIDENCE: Record<
  MeridianConfidence,
  {
    label: string;
    short: string;
    tone: "green" | "amber" | "red";
    desc: string;
  }
> = {
  MEASURED: {
    label: "Medido",
    short: "M",
    tone: "green",
    desc: "Série histórica no sistema de origem",
  },
  ESTIMATED: {
    label: "Estimado",
    short: "E",
    tone: "amber",
    desc: "Derivado de amostra ou proxy",
  },
  DECLARED: {
    label: "Declarado",
    short: "D",
    tone: "red",
    desc: "Afirmado pelo cliente, sem série",
  },
};

export function ConfPill({
  conf,
  size = "md",
}: {
  conf: MeridianConfidence;
  size?: "sm" | "md";
}) {
  const c = CONFIDENCE[conf];
  if (!c) {
    return null;
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: size === "sm" ? "1px 7px" : "2px 9px",
        borderRadius: 99,
        fontSize: size === "sm" ? 10.5 : 11.5,
        fontWeight: 700,
        whiteSpace: "nowrap",
        background: `var(--${c.tone}-soft)`,
        color: `var(--${c.tone}-text)`,
        border: `1px solid rgba(var(--${c.tone}-rgb),.3)`,
      }}
      title={`${c.label} — ${c.desc} · escala do Meridian`}
    >
      <span className="mono" style={{ fontSize: 10, opacity: 0.85 }}>
        {c.short}
      </span>
      {c.label}
    </span>
  );
}

/**
 * Selo de proveniência. Tracejado + cadeado: a borda tracejada diz "não é seu",
 * o cadeado diz "não editável aqui". Nunca use surface normal para dado
 * herdado — a superfície igual convida à edição que não existe.
 */
export function InheritedFrom({
  product,
  entity,
  version,
  note,
  onOpen,
  openLabel = "Ver artefato",
  compact,
  tone = "blue",
}: {
  product: string;
  entity: string;
  version?: string;
  note?: string;
  onOpen?: () => void;
  openLabel?: string;
  compact?: boolean;
  tone?: "blue" | "accent" | "purple";
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: compact ? "7px 11px" : "11px 14px",
        borderRadius: "var(--r-md)",
        background: `var(--${tone}-soft)`,
        border: `1px dashed rgba(var(--${tone}-rgb),.42)`,
        minWidth: 0,
      }}
    >
      <Icon
        name="lock"
        size={compact ? 13 : 16}
        strokeWidth={2}
        style={{ color: `var(--${tone}-text)`, flexShrink: 0 }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          className="mono"
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: `var(--${tone}-text)`,
          }}
        >
          Herdado do {product}
        </div>
        <div
          style={{
            fontSize: compact ? 11.5 : 13,
            fontWeight: 700,
            color: "var(--ink)",
            marginTop: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entity}
          {version ? ` · ${version}` : ""}{" "}
          <span style={{ fontWeight: 500, color: "var(--ink-faint)" }}>
            · somente leitura
          </span>
        </div>
        {note && !compact && (
          <div
            style={{
              fontSize: 11.5,
              color: "var(--ink-muted)",
              marginTop: 4,
              lineHeight: 1.45,
            }}
          >
            {note}
          </div>
        )}
      </div>
      {onOpen && (
        <Button icon="chevronRight" onClick={onOpen} size="sm" variant="ghost">
          {openLabel}
        </Button>
      )}
    </div>
  );
}

/** Estado "aguardando promessa": o que um produto mostra quando a entidade de
 *  que depende ainda não foi emitida pelo dono. Nunca zero, nunca número
 *  frágil — zero num painel lê-se como "medimos e deu zero". */
export function AwaitingUpstream({
  product,
  entity,
  why,
  action,
}: {
  product: string;
  entity: string;
  why: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "44px 1fr",
        gap: 16,
        padding: "22px 24px",
        borderRadius: "var(--r-lg)",
        background: "var(--surface)",
        border: "1px dashed var(--hairline-strong)",
      }}
    >
      <span
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          display: "grid",
          placeItems: "center",
          background: "var(--amber-soft)",
          color: "var(--amber-text)",
          border: "1px solid rgba(var(--amber-rgb),.3)",
        }}
      >
        <Icon name="clock" size={21} strokeWidth={2} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          className="mono"
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--amber-text)",
          }}
        >
          Aguardando {entity} do {product}
        </div>
        <div
          className="display"
          style={{
            fontSize: 19,
            fontWeight: 700,
            color: "var(--ink)",
            marginTop: 5,
            letterSpacing: "-.01em",
          }}
        >
          Sem promessa, não há o que apurar
        </div>
        <p
          style={{
            fontSize: 13.5,
            color: "var(--ink-muted)",
            margin: "8px 0 0",
            lineHeight: 1.6,
            maxWidth: "72ch",
          }}
        >
          {why}
        </p>
        {action && (
          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>{action}</div>
        )}
      </div>
    </div>
  );
}
