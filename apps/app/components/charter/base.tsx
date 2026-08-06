"use client";

// base.tsx — primitivas próprias do Charter.
//
// O que já existe em `components/cosmos/kit.tsx` (Button, Badge, Card,
// SectionCard, KpiCard, Progress, PageHeader, Skel, IconButton, Avatar,
// ErrorState) é reusado tal e qual: os nomes de classe são os mesmos e
// `charter.css` define os mesmos seletores sob outro escopo. Duplicar o kit
// criaria dois lugares para corrigir o mesmo bug.
//
// Aqui ficam só as primitivas que o Cosmos não tem — as do handoff
// (`charter-base.jsx`) e as de formulário, que o Cosmos resolve com <input> cru
// espalhado pelas telas e o Charter não pode, porque o intake é a tela mais
// importante do produto.

import { Icon, type IconName } from "@repo/design-system/cosmos/icons";
import { Button, Progress, type Tone } from "@repo/design-system/cosmos/kit";
import type { CSSProperties, ReactNode, Ref } from "react";
import { useEffect, useId, useState } from "react";

/** Rótulo lido por leitor de tela e invisível na tela. Usado em <legend> de
 *  fieldset, onde o texto visível já vem do <Field> acima. */
const VISUALLY_HIDDEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

// ── Eyebrow ───────────────────────────────────────────────────────────────────

/** Label mono em caixa alta. Único dispositivo de "small caps" permitido —
 *  qualquer outro uso de uppercase na UI é erro de porte. */
export function Eyebrow({
  children,
  tone,
  style,
}: {
  children: ReactNode;
  tone?: Tone;
  style?: CSSProperties;
}) {
  return (
    <div
      className="mono"
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        color: tone ? `var(--${tone}-text)` : "var(--ink-faint)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── BackLink ──────────────────────────────────────────────────────────────────

/** Volta para a lista de origem no topo de toda tela de detalhe. `<button>` de
 *  verdade — a tela de detalhe é alcançável por URL direta e o retorno precisa
 *  ser focável pelo teclado. */
export function BackLink({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        marginBottom: 14,
        padding: "6px 12px",
        borderRadius: "var(--r-sm)",
        border: "1px solid var(--hairline)",
        background: "var(--surface-2)",
        color: "var(--ink-muted)",
        fontSize: 12.5,
        fontWeight: 600,
        cursor: "pointer",
      }}
      type="button"
    >
      <Icon name="arrowLeft" size={14} />
      {label}
    </button>
  );
}

// ── MetaCell ──────────────────────────────────────────────────────────────────

/** Label acima do valor. Usar em painel de detalhe **em vez de sopa de badges**:
 *  seis badges lado a lado não dizem qual campo é qual. */
export function MetaCell({
  label,
  value,
  mono,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
  tone?: Tone;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        minWidth: 0,
      }}
    >
      <Eyebrow>{label}</Eyebrow>
      <span
        className={mono ? "mono" : undefined}
        style={{
          fontSize: mono ? 12.5 : 13,
          fontWeight: 700,
          color: tone ? `var(--${tone}-text)` : "var(--ink)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

export type TabDef = { id: string; label: string; count?: number };

/** Linha sublinhada. Compartilhada por Política, Caso e Fornecedor. */
export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: TabDef[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        borderBottom: "1px solid var(--hairline)",
        marginBottom: "var(--gap)",
      }}
    >
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <button
            aria-current={on ? "true" : undefined}
            className="btn"
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              background: "none",
              border: "none",
              borderBottom: `2px solid ${on ? "var(--accent)" : "transparent"}`,
              marginBottom: -1,
              padding: "9px 14px",
              fontSize: 13,
              fontWeight: on ? 700 : 600,
              color: on ? "var(--ink)" : "var(--ink-muted)",
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
            type="button"
          >
            {t.label}
            {typeof t.count === "number" && (
              <span
                className="mono"
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 99,
                  background: on ? "var(--accent-soft)" : "var(--chip-bg)",
                  color: on ? "var(--accent-text)" : "var(--ink-faint)",
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── FilterChips ───────────────────────────────────────────────────────────────

export type ChipOption = {
  id: string;
  label: string;
  tone?: Tone;
  count?: number;
};

export function FilterChips({
  options,
  value,
  onChange,
  allLabel = "Todos",
  ariaLabel,
}: {
  options: ChipOption[];
  value: string;
  onChange: (id: string) => void;
  allLabel?: string;
  /** Rótulo do grupo para leitor de tela. Sem ele, a fila de pills é anunciada
   *  como uma sequência solta de botões sem dizer o que filtram. */
  ariaLabel: string;
}) {
  return (
    <fieldset
      style={{
        display: "flex",
        gap: 7,
        flexWrap: "wrap",
        border: "none",
        padding: 0,
        margin: 0,
      }}
    >
      <legend style={VISUALLY_HIDDEN}>{ariaLabel}</legend>
      {[{ id: "all", label: allLabel } as ChipOption, ...options].map((o) => {
        const on = value === o.id;
        const tone = o.tone ?? "accent";
        return (
          <button
            aria-pressed={on}
            className="btn"
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              padding: "5px 11px",
              borderRadius: 99,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              border: `1px solid ${on ? `rgba(var(--${tone}-rgb),.35)` : "var(--hairline)"}`,
              background: on ? `var(--${tone}-soft)` : "transparent",
              color: on ? `var(--${tone}-text)` : "var(--ink-muted)",
            }}
            type="button"
          >
            {o.label}
            {typeof o.count === "number" && (
              <span className="mono" style={{ marginLeft: 6, opacity: 0.75 }}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </fieldset>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

export type LegendItem = {
  label: string;
  tone?: Tone;
  color?: string;
  square?: boolean;
  dashed?: boolean;
};

/** Todo gráfico tem legenda, centralizada sob a área de plot. Sem exceção —
 *  gráfico sem legenda transfere para o leitor o trabalho de adivinhar. */
export function Legend({
  items,
  style,
}: {
  items: LegendItem[];
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        flexWrap: "wrap",
        justifyContent: "center",
        marginTop: 14,
        ...style,
      }}
    >
      {items.map((i) => (
        <span
          key={i.label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11.5,
            color: "var(--ink-muted)",
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: i.square ? 2 : 99,
              background: i.dashed
                ? "transparent"
                : i.color || `var(--${i.tone})`,
              flexShrink: 0,
              border: i.dashed ? `1.5px dashed var(--${i.tone})` : "none",
            }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}

// ── BarRow ────────────────────────────────────────────────────────────────────

export function BarRow({
  label,
  value,
  max = 100,
  tone = "accent",
  suffix,
  hint,
  onClick,
}: {
  label: ReactNode;
  value: number;
  max?: number;
  tone?: Tone;
  suffix?: string;
  hint?: string;
  onClick?: () => void;
}) {
  const pct = max === 0 ? 0 : Math.min(100, (value / max) * 100);

  // Quando é clicável, o elemento é um <button> de verdade — não um <div> com
  // role e handler de tecla remendados. Foco, Enter, Espaço e anúncio de leitor
  // de tela vêm do navegador, e não de uma reimplementação parcial.
  const layout: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 52px",
    gap: 10,
    alignItems: "center",
    padding: "7px 8px",
    borderRadius: 8,
    width: "100%",
  };

  const body = (
    <>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 5,
          }}
        >
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
          {hint && (
            <span
              style={{
                fontSize: 11,
                color: "var(--ink-faint)",
                flexShrink: 0,
              }}
            >
              {hint}
            </span>
          )}
        </div>
        <Progress height={6} tone={tone} value={pct} />
      </div>
      <span
        className="mono"
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          color: `var(--${tone}-text)`,
          textAlign: "right",
        }}
      >
        {value}
        {suffix}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        className="btn chart-hit"
        onClick={onClick}
        style={{
          ...layout,
          border: "none",
          background: "transparent",
          font: "inherit",
          textAlign: "left",
          cursor: "pointer",
        }}
        type="button"
      >
        {body}
      </button>
    );
  }

  return <div style={layout}>{body}</div>;
}

// ── StatusDot ─────────────────────────────────────────────────────────────────

/** Estado como cor **+ palavra**, nunca cor sozinha. Requisito de
 *  acessibilidade (NFR-2.2), não escolha estética. */
export function StatusDot({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        color: "var(--ink)",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 99,
          background: `var(--${tone})`,
          flexShrink: 0,
          boxShadow: `0 0 8px rgba(var(--${tone}-rgb),.6)`,
        }}
      />
      {label}
    </span>
  );
}

// ── Tabela ────────────────────────────────────────────────────────────────────

export type ColumnLabel =
  | string
  | { t: string; align?: "left" | "right" | "center" };

/** Header e linha compartilham **um único `cols`** — sem isso a coluna do
 *  header desliza em relação à da linha no primeiro ajuste. */
export function TableHead({
  cols,
  labels,
}: {
  cols: string;
  labels: ColumnLabel[];
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: cols,
        gap: 12,
        padding: "9px 16px",
        borderBottom: "1px solid var(--hairline)",
        background: "var(--surface-2)",
      }}
    >
      {labels.map((l) => {
        const text = typeof l === "string" ? l : l.t;
        const align = typeof l === "string" ? "left" : (l.align ?? "left");
        return (
          <span
            className="mono"
            key={text}
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
              textAlign: align,
            }}
          >
            {text}
          </span>
        );
      })}
    </div>
  );
}

export function TableRow({
  cols,
  children,
  onClick,
  last,
  label,
}: {
  cols: string;
  children: ReactNode;
  onClick?: () => void;
  last?: boolean;
  /** Obrigatório quando `onClick` existe: leitor de tela precisa saber para
   *  onde a linha leva, já que o conteúdo dela são células soltas. */
  label?: string;
}) {
  const layout: CSSProperties = {
    display: "grid",
    gridTemplateColumns: cols,
    gap: 12,
    padding: "11px 16px",
    alignItems: "center",
    borderBottom: last ? "none" : "1px solid var(--hairline)",
    width: "100%",
  };

  // Linha clicável é um <button>, não um <div> com role="button": foco,
  // Enter/Espaço e anúncio vêm do navegador.
  if (onClick) {
    return (
      <button
        aria-label={label}
        className="navitem btn"
        onClick={onClick}
        style={{
          ...layout,
          border: "none",
          borderBottom: layout.borderBottom,
          background: "transparent",
          font: "inherit",
          textAlign: "left",
          cursor: "pointer",
        }}
        type="button"
      >
        {children}
      </button>
    );
  }

  return <div style={layout}>{children}</div>;
}

// ── Formulário ────────────────────────────────────────────────────────────────

const CONTROL_STYLE: CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--hairline)",
  background: "var(--surface-2)",
  color: "var(--ink)",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "inherit",
  outline: "none",
};

export function Field({
  label,
  hint,
  error,
  required,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={htmlFor}
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: "var(--ink-muted)",
          display: "flex",
          gap: 5,
          alignItems: "center",
        }}
      >
        {label}
        {required && (
          <span aria-hidden="true" style={{ color: "var(--red-text)" }}>
            *
          </span>
        )}
      </label>
      {children}
      {/* Erro antes de hint: quando os dois existem, o erro é o que importa. */}
      {error ? (
        <span
          style={{ fontSize: 11.5, color: "var(--red-text)", fontWeight: 600 }}
        >
          {error}
        </span>
      ) : (
        hint && (
          <span style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
            {hint}
          </span>
        )
      )}
    </div>
  );
}

export function Input({
  invalid,
  ref,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
}) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      ref={ref}
      style={{
        ...CONTROL_STYLE,
        borderColor: invalid ? "var(--red)" : "var(--hairline)",
        ...props.style,
      }}
    />
  );
}

export function Textarea({
  invalid,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      style={{
        ...CONTROL_STYLE,
        minHeight: 84,
        resize: "vertical",
        lineHeight: 1.55,
        fontWeight: 500,
        borderColor: invalid ? "var(--red)" : "var(--hairline)",
        ...props.style,
      }}
    />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  invalid,
  id,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  /** `disabled` por opção — ex.: recusar ATENDE/PARCIAL até uma capacidade
   *  estar escolhida, explicando antes em vez de deixar o servidor recusar
   *  depois. */
  options: { value: T; label: string; disabled?: boolean }[];
  invalid?: boolean;
  id?: string;
  ariaLabel?: string;
}) {
  return (
    <select
      aria-invalid={invalid || undefined}
      aria-label={ariaLabel}
      id={id}
      onChange={(e) => onChange(e.target.value as T)}
      style={{
        ...CONTROL_STYLE,
        borderColor: invalid ? "var(--red)" : "var(--hairline)",
        cursor: "pointer",
      }}
      value={value}
    >
      {options.map((o) => (
        <option disabled={o.disabled} key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Escolha de 2–4 opções sempre visíveis. Preferir a Select quando o conjunto é
 *  pequeno e a comparação entre opções importa — como classe de dado no intake,
 *  onde esconder as alternativas esconde a consequência. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; tone?: Tone }[];
  /** Rótulo do grupo. Obrigatório: um trio de botões sem rótulo é anunciado
   *  como "Baixa, Média, Alta" sem dizer alta o quê. */
  ariaLabel: string;
}) {
  return (
    // <fieldset> em vez de div[role=group]: é o elemento semântico para um
    // conjunto de controles relacionados, e o <legend> carrega o rótulo.
    <fieldset
      style={{
        display: "flex",
        gap: 4,
        padding: 3,
        margin: 0,
        borderRadius: "var(--r-sm)",
        background: "var(--surface-3)",
        border: "1px solid var(--hairline)",
      }}
    >
      <legend style={VISUALLY_HIDDEN}>{ariaLabel}</legend>
      {options.map((o) => {
        const on = o.value === value;
        const tone = o.tone ?? "accent";
        return (
          <button
            aria-pressed={on}
            className="btn"
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              flex: 1,
              padding: "6px 10px",
              borderRadius: "var(--r-xs)",
              border: "none",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              background: on ? `var(--${tone}-soft)` : "transparent",
              color: on ? `var(--${tone}-text)` : "var(--ink-muted)",
              boxShadow: on
                ? `inset 0 0 0 1px rgba(var(--${tone}-rgb),.35)`
                : "none",
            }}
            type="button"
          >
            {o.label}
          </button>
        );
      })}
    </fieldset>
  );
}

// ── Estados de tela ───────────────────────────────────────────────────────────

/**
 * Marca a janela em que o skeleton aparece. Só liga acima de 300ms de espera —
 * abaixo disso o skeleton pisca e a tela parece instável (NFR-3.3).
 */
export function useScreenLoad(ready: boolean, minMs = 300): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!ready) {
      setSettled(false);
      return;
    }
    const t = setTimeout(() => setSettled(true), minMs);
    return () => clearTimeout(t);
  }, [ready, minMs]);
  return !settled;
}

/** Skeleton com a **forma do conteúdo real**. Um retângulo genérico causa
 *  layout shift ao resolver; este não. */
export function SkeletonRows({
  cols,
  rows = 6,
}: {
  cols: string;
  rows?: number;
}) {
  return (
    <div>
      {Array.from({ length: rows }, (_, i) => i).map((i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: cols,
            gap: 12,
            padding: "11px 16px",
            borderBottom: "1px solid var(--hairline)",
          }}
        >
          {cols.split(" ").map((col) => (
            <div
              className="skeleton"
              key={`skel-${i}-${col}`}
              style={{ height: 13, borderRadius: 5 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Skeleton no formato de um card/linha de lista. Usado no lugar de um bloco
 *  genérico para que a resolução não cause layout shift (NFR-3.3). */
export function SkeletonCard() {
  return (
    <div
      style={{
        display: "flex",
        gap: 11,
        alignItems: "center",
        padding: "11px 13px",
        borderRadius: "var(--r-md)",
        background: "var(--surface-2)",
        border: "1px solid var(--hairline)",
      }}
    >
      <div
        className="skeleton"
        style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0 }}
      />
      <div
        style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}
      >
        <div className="skeleton" style={{ height: 11, width: "42%" }} />
        <div className="skeleton" style={{ height: 11, width: "76%" }} />
      </div>
      <div
        className="skeleton"
        style={{ width: 54, height: 18, borderRadius: 99, flexShrink: 0 }}
      />
    </div>
  );
}

/** Vazio com CTA que **resolve** o vazio. Estado vazio sem ação é um beco:
 *  o usuário vê que não há nada e não descobre como mudar isso. */
export function SmartEmptyState({
  icon = "inbox",
  title,
  subtitle,
  tone = "accent",
  primaryLabel,
  primaryIcon,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  icon?: IconName;
  title: string;
  subtitle: string;
  tone?: Tone;
  primaryLabel?: string;
  primaryIcon?: IconName;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "52px 24px",
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
          background: `var(--${tone}-soft)`,
          color: `var(--${tone}-text)`,
          border: `1px solid rgba(var(--${tone}-rgb),.22)`,
        }}
      >
        <Icon name={icon} size={20} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
        {title}
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--ink-muted)",
          maxWidth: 400,
          lineHeight: 1.6,
        }}
      >
        {subtitle}
      </div>
      {(primaryLabel || secondaryLabel) && (
        <div style={{ display: "flex", gap: 9, marginTop: 6 }}>
          {secondaryLabel && onSecondary && (
            <Button onClick={onSecondary} size="sm" variant="secondary">
              {secondaryLabel}
            </Button>
          )}
          {primaryLabel && onPrimary && (
            <Button icon={primaryIcon} onClick={onPrimary} size="sm">
              {primaryLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Erro de rede com retry. O protótipo não simula este estado — é
 *  responsabilidade da implementação (NFR-4). */
export function ScreenError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: "48px 24px",
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
          background: "var(--red-soft)",
          color: "var(--red-text)",
        }}
      >
        <Icon name="alert" size={20} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
        Não foi possível carregar
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--ink-muted)",
          maxWidth: 420,
          lineHeight: 1.6,
        }}
      >
        {message}
      </div>
      <button
        className="btn"
        onClick={onRetry}
        style={{
          marginTop: 6,
          padding: "8px 16px",
          borderRadius: "var(--r-sm)",
          border: "1px solid var(--hairline-strong)",
          background: "var(--surface-2)",
          color: "var(--ink)",
          fontSize: 12.5,
          fontWeight: 700,
          cursor: "pointer",
        }}
        type="button"
      >
        Tentar de novo
      </button>
    </div>
  );
}

// ── Ação com permissão ────────────────────────────────────────────────────────

/**
 * Botão que respeita a matriz de permissões: sem grant, fica desabilitado
 * **com o motivo visível** — esconder o controle não atende NFR-1.3, porque o
 * usuário não descobre que a ação existe nem por que não pode.
 */
export function GatedButton({
  allowed,
  reason,
  children,
  onClick,
  variant = "primary",
  icon,
  type = "button",
}: {
  allowed: boolean;
  reason: string;
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  icon?: IconName;
  type?: "button" | "submit";
}) {
  const palette =
    variant === "primary"
      ? {
          background: "var(--accent)",
          color: "var(--accent-fg)",
          border: "none",
        }
      : variant === "danger"
        ? {
            background: "var(--red-soft)",
            color: "var(--red-text)",
            border: "1px solid rgba(var(--red-rgb),.35)",
          }
        : {
            background: "var(--surface-2)",
            color: "var(--ink)",
            border: "1px solid var(--hairline-strong)",
          };
  return (
    <button
      aria-disabled={!allowed}
      className="btn"
      disabled={!allowed}
      onClick={allowed ? onClick : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "8px 14px",
        borderRadius: "var(--r-sm)",
        fontSize: 12.5,
        fontWeight: 700,
        cursor: allowed ? "pointer" : "not-allowed",
        opacity: allowed ? 1 : 0.5,
        ...palette,
      }}
      title={allowed ? undefined : reason}
      type={type}
    >
      {icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  );
}

/** id estável para ligar <label htmlFor> ao controle sem colisão entre modais. */
export function useFieldId(prefix: string): string {
  const id = useId();
  return `${prefix}-${id}`;
}
