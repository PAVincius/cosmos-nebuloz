"use client";

/**
 * Peças do painel do nó (Task 5, spec §4). Extraído de `painel.tsx` só por
 * tamanho de arquivo — nenhuma peça aqui guarda estado próprio.
 */
import { Icon } from "@repo/design-system/cosmos/icons";
import { type ReactNode, useState } from "react";
import { BotaoSecundario, Erro, INPUT } from "@/components/campo";
import type { Result } from "@/lib/safe-action";

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

/** Rótulo do × muda com o estado (review): dá pra tela quem lê que o próximo
 *  clique confirma, não só um `title` que passa despercebido. */
function rotuloDoRemover(armado: boolean, nome: string): string {
  if (armado) {
    return `Confirmar remoção da ligação com ${nome}`;
  }
  return `Remover ligação com ${nome}`;
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
  // × pede confirmação em duas etapas, igual `ConfirmarAcao` — o card cheio
  // daquele componente não cabe numa linha de lista, então o "armado" é
  // estado local por linha (achado de review). Cai sozinho quando o botão
  // perde o foco, e trocar de seleção já remonta `Painel` inteiro.
  const [armado, setArmado] = useState(false);

  const clicarRemover = () => {
    if (!onRemover) {
      return;
    }
    if (armado) {
      setArmado(false);
      onRemover();
      return;
    }
    setArmado(true);
  };

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
          aria-label={rotuloDoRemover(armado, nome)}
          className="btn"
          onBlur={() => setArmado(false)}
          onClick={clicarRemover}
          style={{
            background: armado ? "var(--red-soft)" : "none",
            border: armado
              ? "1px solid var(--red-text)"
              : "1px solid var(--hairline)",
            borderRadius: "var(--r-sm)",
            color: armado ? "var(--red-text)" : "var(--ink-faint)",
            cursor: "pointer",
            padding: 6,
          }}
          type="button"
        >
          <Icon name={armado ? "check" : "x"} size={12} />
        </button>
      ) : null}
    </div>
  );
}

export type CandidatoLigacao = { id: string; codigo: string; nome: string };

/** Mínimo de 2 caracteres — mesmo piso de `LigacaoSchema.rotulo` em
 *  `app/actions/processos.ts`; o servidor valida de novo antes de gravar. */
function podeCriarLigacao(paraId: string, rotulo: string): boolean {
  return paraId.length > 0 && rotulo.trim().length >= 2;
}

/** Mini-formulário de "Nova ligação" (Task 6, spec §4). Estado local — igual
 *  `LinhaLigacao` acima — porque é um rascunho de um clique só: some ao trocar
 *  de processo selecionado (o `Painel` inteiro remonta, via `key`). */
export function FormularioNovaLigacao({
  candidatos,
  onCriar,
}: {
  candidatos: CandidatoLigacao[];
  onCriar: (paraId: string, rotulo: string) => Promise<Result<unknown>>;
}) {
  const [paraId, setParaId] = useState(candidatos[0]?.id ?? "");
  const [rotulo, setRotulo] = useState("");
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    setErro(null);
    setPendente(true);
    const res = await onCriar(paraId, rotulo.trim());
    setPendente(false);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setRotulo("");
  }

  if (candidatos.length === 0) {
    return null;
  }

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}
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
        Nova ligação
      </span>
      {erro ? <Erro>{erro}</Erro> : null}
      <select
        aria-label="Destino da ligação"
        onChange={(e) => setParaId(e.target.value)}
        style={INPUT}
        value={paraId}
      >
        {candidatos.map((c) => (
          <option key={c.id} value={c.id}>
            {c.codigo} · {c.nome}
          </option>
        ))}
      </select>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          aria-label="Rótulo da ligação"
          onChange={(e) => setRotulo(e.target.value)}
          placeholder="ex.: alimenta"
          style={{ ...INPUT, flex: 1 }}
          value={rotulo}
        />
        <BotaoSecundario
          disabled={pendente || !podeCriarLigacao(paraId, rotulo)}
          onClick={criar}
        >
          Adicionar
        </BotaoSecundario>
      </div>
    </div>
  );
}
