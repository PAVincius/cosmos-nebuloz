"use client";

/**
 * Peças do painel do nó (Task 5, spec §4). Extraído de `painel.tsx` só por
 * tamanho de arquivo — nenhuma peça aqui guarda estado próprio.
 */
import { Icon } from "@repo/design-system/cosmos/icons";
import type { ReactNode } from "react";

/** Mesmas etapas de `lib/empresa/formato.ts:formatarData`, mas local: aquele
 *  módulo é do domínio "empresa", e o mapa de processos não depende dele. */
export function formatarDataCurta(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

export function CartaoMetrica({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-md)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "8px 10px",
      }}
    >
      <span
        className="mono"
        style={{
          color: "var(--ink-faint)",
          fontSize: "var(--fs-micro)",
          fontWeight: 700,
          letterSpacing: ".08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: "var(--ink)",
          fontSize: "var(--fs-base)",
          fontWeight: 600,
        }}
      >
        {children}
      </span>
    </div>
  );
}

export function Pilula({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--hairline)",
        borderRadius: 99,
        color: "var(--ink-muted)",
        fontSize: "var(--fs-micro)",
        fontWeight: 700,
        padding: "3px 9px",
      }}
    >
      {children}
    </span>
  );
}

export function LinhaLigacao({
  dir,
  nome,
  rotulo,
  onSelecionar,
  onRemover,
}: {
  dir: "in" | "out";
  nome: string;
  rotulo: string;
  onSelecionar: () => void;
  onRemover?: () => void;
}) {
  return (
    <div style={{ alignItems: "center", display: "flex", gap: 6 }}>
      <button
        className="btn"
        onClick={onSelecionar}
        style={{
          alignItems: "center",
          background: "var(--surface-2)",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-sm)",
          cursor: "pointer",
          display: "flex",
          flex: 1,
          gap: 8,
          minWidth: 0,
          padding: "6px 8px",
          textAlign: "left",
        }}
        type="button"
      >
        <Icon
          name={dir === "out" ? "arrowRight" : "arrowLeft"}
          size={13}
          style={{ color: "var(--ink-faint)", flexShrink: 0 }}
        />
        <span
          style={{
            flex: 1,
            fontSize: "var(--fs-nota)",
            fontWeight: 700,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {nome}
        </span>
        <span
          style={{
            color: "var(--ink-faint)",
            flexShrink: 0,
            fontSize: "var(--fs-micro)",
          }}
        >
          {rotulo}
        </span>
      </button>
      {onRemover ? (
        <button
          aria-label={`Remover ligação com ${nome}`}
          className="btn"
          onClick={onRemover}
          style={{
            background: "none",
            border: "1px solid var(--hairline)",
            borderRadius: "var(--r-sm)",
            color: "var(--ink-faint)",
            cursor: "pointer",
            padding: 6,
          }}
          type="button"
        >
          <Icon name="x" size={12} />
        </button>
      ) : null}
    </div>
  );
}
