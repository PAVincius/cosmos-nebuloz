"use client";

/**
 * Peças de campo do diálogo de processo (Task 6, spec §4). Extraído de
 * `processo-dialog.tsx` só por tamanho de arquivo — os três grupos de chips
 * (domínio, nível, tipo) reusam o mesmo botão de pílula do
 * `novo-lead-dialog.tsx` (funil v2), copiado aqui porque aquele módulo é do
 * funil e não deveria depender do mapa de processos, nem o contrário.
 */
import type { CSSProperties, ReactNode } from "react";
import type { DiagramaRow } from "@/app/actions/processos";
import { INPUT } from "@/components/campo";
import {
  DOMINIOS,
  type Dominio,
  NIVEIS,
  type Nivel,
} from "@/lib/ferramentas/processos";

function estiloChip(ativo: boolean): CSSProperties {
  return {
    background: ativo ? "var(--accent-soft)" : "var(--surface-2)",
    border: `1px solid ${ativo ? "rgba(var(--accent-rgb),.45)" : "var(--hairline)"}`,
    borderRadius: 99,
    color: ativo ? "var(--accent-text)" : "var(--ink-muted)",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "var(--fs-nota)",
    fontWeight: 700,
    padding: "5px 11px",
  };
}

function GrupoChips({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <fieldset
      style={{
        border: "none",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        margin: 0,
        padding: 0,
      }}
    >
      <legend
        className="mono"
        style={{
          color: "var(--ink-faint)",
          fontSize: "var(--fs-micro)",
          fontWeight: 700,
          letterSpacing: ".12em",
          padding: 0,
          textTransform: "uppercase",
        }}
      >
        {titulo}
      </legend>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {children}
      </div>
    </fieldset>
  );
}

const DOMINIO_KEYS = Object.keys(DOMINIOS) as Dominio[];

export function ChipsDominio({
  valor,
  onEscolher,
}: {
  valor: Dominio;
  onEscolher: (v: Dominio) => void;
}) {
  return (
    <GrupoChips titulo="Domínio">
      {DOMINIO_KEYS.map((d) => (
        <button
          aria-pressed={valor === d}
          key={d}
          onClick={() => onEscolher(d)}
          style={estiloChip(valor === d)}
          type="button"
        >
          {DOMINIOS[d].rotulo}
        </button>
      ))}
    </GrupoChips>
  );
}

const NIVEL_KEYS = [1, 2, 3] as const;

export function ChipsNivel({
  valor,
  onEscolher,
}: {
  valor: Nivel;
  onEscolher: (v: Nivel) => void;
}) {
  return (
    <GrupoChips titulo="Nível">
      {NIVEL_KEYS.map((n) => (
        <button
          aria-pressed={valor === n}
          key={n}
          onClick={() => onEscolher(n)}
          style={{
            ...estiloChip(valor === n),
            display: "flex",
            flexDirection: "column",
            gap: 2,
            padding: "6px 12px",
            textAlign: "left",
          }}
          type="button"
        >
          <span>{NIVEIS[n].rotulo}</span>
          <span
            style={{
              color: valor === n ? "var(--accent-text)" : "var(--ink-faint)",
              fontSize: "var(--fs-micro)",
              fontWeight: 500,
            }}
          >
            {NIVEIS[n].descricao}
          </span>
        </button>
      ))}
    </GrupoChips>
  );
}

const TIPO_KEYS = ["CORE", "APOIO"] as const;

/** "núcleo"/"apoio" — mesmo rótulo de `eyebrowDoProcesso` em `painel.tsx`,
 *  aqui em maiúscula inicial porque é texto de botão, não eyebrow mono. */
function rotuloDoTipo(t: "CORE" | "APOIO"): string {
  return t === "CORE" ? "Núcleo" : "Apoio";
}

export function ChipsTipo({
  valor,
  onEscolher,
}: {
  valor: "CORE" | "APOIO";
  onEscolher: (v: "CORE" | "APOIO") => void;
}) {
  return (
    <GrupoChips titulo="Tipo">
      {TIPO_KEYS.map((t) => (
        <button
          aria-pressed={valor === t}
          key={t}
          onClick={() => onEscolher(t)}
          style={estiloChip(valor === t)}
          type="button"
        >
          {rotuloDoTipo(t)}
        </button>
      ))}
    </GrupoChips>
  );
}

export function CampoDiagrama({
  id,
  valor,
  diagramas,
  onEscolher,
}: {
  id: string;
  valor: string;
  diagramas: DiagramaRow[];
  onEscolher: (v: string) => void;
}) {
  return (
    <select
      id={id}
      onChange={(e) => onEscolher(e.target.value)}
      style={INPUT}
      value={valor}
    >
      <option value="">nenhum</option>
      {diagramas.map((d) => (
        <option key={d.id} value={d.id}>
          {d.nome}
        </option>
      ))}
    </select>
  );
}
