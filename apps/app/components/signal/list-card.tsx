"use client";

// Primitivas de lista do Signal.
//
// Cinco telas (conexões, mapeamento, evidências, alertas, relatórios) mostram
// "uma coisa por cartão" com a mesma anatomia: cabeçalho com código, nome e um
// estado à direita; uma linha de metadados em monoespaçada; e, quando há algo a
// dizer, um bloco rotulado com o texto por extenso. Cada uma tinha a sua cópia,
// com padding 12, 13 ou 14 e fonte 10.5 ou 11 conforme o dia em que foi
// escrita. Um leitor que passa de uma tela para a outra sente a diferença sem
// conseguir nomeá-la — e é exatamente isso que faz uma interface parecer
// montada em vez de construída.
//
// O estado à direita é o `Badge` do kit, não um span próprio: é a mesma peça
// que o Cosmos e o Charter usam, e o olho já sabe lê-la.

import type { Tone } from "@repo/design-system/cosmos/kit";
import type { CSSProperties, ReactNode } from "react";
import { Eyebrow } from "./base";

/**
 * Container de um item de lista.
 *
 * `tone` tinge o cartão inteiro — é o que diferencia "esta fonte caiu" de
 * "esta fonte está bem" antes de ler qualquer palavra. Sem tom, hairline e
 * superfície neutra.
 */
export function ListCard({
  tone,
  muted,
  children,
  style,
}: {
  tone?: Tone;
  /** Item resolvido, congelado, passado: continua legível, mas recua. */
  muted?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const tinted = tone && tone !== "neutral";
  return (
    <div
      style={{
        padding: "13px 15px",
        borderRadius: "var(--r-md)",
        border: `1px solid ${tinted ? `rgba(var(--${tone}-rgb),.35)` : "var(--hairline)"}`,
        background: tinted ? `var(--${tone}-soft)` : "var(--surface-2)",
        opacity: muted ? 0.72 : 1,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Cabeçalho do cartão: código · nome · contexto, e o que vier à direita. */
export function ListCardHead({
  code,
  title,
  onTitleClick,
  context,
  children,
}: {
  code: string;
  title: ReactNode;
  /** Quando o título leva a algum lugar, vira botão — nunca div clicável. */
  onTitleClick?: () => void;
  context?: ReactNode;
  /** Vai para a direita, empurrado por `marginLeft: auto`. */
  children?: ReactNode;
}) {
  const titleStyle: CSSProperties = {
    fontSize: 13.5,
    fontWeight: 700,
    color: "var(--ink)",
  };
  return (
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
        style={{ fontSize: 11, color: "var(--ink-faint)" }}
      >
        {code}
      </span>
      {onTitleClick ? (
        <button
          className="lift"
          onClick={onTitleClick}
          style={{
            ...titleStyle,
            border: 0,
            background: "none",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
          }}
          type="button"
        >
          {title}
        </button>
      ) : (
        <span style={titleStyle}>{title}</span>
      )}
      {context ? (
        <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
          {context}
        </span>
      ) : null}
      {children ? (
        <span
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {children}
        </span>
      ) : null}
    </div>
  );
}

/** Linha de metadados em monoespaçada. Itens nulos somem sem deixar gap. */
export function MetaRow({ items }: { items: (ReactNode | null | false)[] }) {
  const shown = items.filter(Boolean);
  if (shown.length === 0) {
    return null;
  }
  return (
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
      {shown.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: itens de meta não têm identidade própria e não reordenam
        <span key={i}>{item}</span>
      ))}
    </div>
  );
}

/**
 * Bloco rotulado: "Como consertar", "Impacto", "Próximo passo".
 *
 * O rótulo diz o que o texto É — e é por isso que ele existe. "Reautorizar no
 * Zendesk Admin" sem o rótulo "Como consertar" é uma frase; com ele, é uma
 * instrução.
 */
export function Note({
  label,
  tone = "neutral",
  emphasis,
  children,
}: {
  label: string;
  tone?: Tone;
  /** Texto em `--ink` em vez de `--ink-muted`: é o que a pessoa precisa fazer. */
  emphasis?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <Eyebrow tone={tone}>{label}</Eyebrow>
      <div
        style={{
          margin: "4px 0 0",
          fontSize: 12,
          lineHeight: 1.55,
          color: emphasis ? "var(--ink)" : "var(--ink-muted)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Bloco monoespaçado para a "conta": evento de origem, transformação, janela. */
export function CodeBlock({ children }: { children: ReactNode }) {
  return (
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
      {children}
    </div>
  );
}

/** Mensagem de erro de uma ação local, abaixo dos botões. */
export function InlineError({ error }: { error: string | null }) {
  if (!error) {
    return null;
  }
  return (
    <p
      role="alert"
      style={{
        margin: "10px 0 0",
        fontSize: 12,
        lineHeight: 1.55,
        color: "var(--red-text)",
      }}
    >
      {error}
    </p>
  );
}
