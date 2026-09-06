"use client";

/**
 * Painel do nó (Task 5, spec §4; design `ProcessPanel` de
 * backoffice-process-map-screen.jsx, sem a tabela "Fontes conectadas" nem o
 * `ConnectSourceModal" — a spec §0 cortou fontes externas). Recebe o
 * processo já selecionado por `mapa.tsx` e devolve intenção por callback.
 */
import { Badge } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import type { LigacaoRow, ProcessoRow } from "@/app/actions/processos";
import { BotaoSecundario } from "@/components/campo";
import { ConfirmarAcao } from "@/components/confirmar-acao";
import {
  DOMINIOS,
  NIVEIS,
  STATUS,
  statusDe,
  tomCssDoDominio,
  vizinhos,
} from "@/lib/ferramentas/processos";
import {
  CartaoMetrica,
  formatarDataCurta,
  LinhaLigacao,
  Pilula,
} from "./painel-partes";

export type PainelProps = {
  processo: ProcessoRow;
  processos: ProcessoRow[];
  ligacoes: LigacaoRow[];
  podeEscrever: boolean;
  onSelecionar: (id: string) => void;
  onEditar: () => void;
  onExcluirProcesso: (id: string) => void;
  onExcluirLigacao: (id: string) => void;
};

/** "PZ-01 · Comercial · nível 2 tático · núcleo" — único lugar que junta os
 *  quatro pedaços do eyebrow, na ordem do design. */
function eyebrowDoProcesso(p: ProcessoRow): string {
  const tipo = p.tipo === "CORE" ? "núcleo" : "apoio";
  return `${p.codigo} · ${DOMINIOS[p.dominio].rotulo} · nível ${p.nivel} ${NIVEIS[p.nivel].rotulo.toLowerCase()} · ${tipo}`;
}

/** `undefined` (não uma função vazia) esconde o × de `LinhaLigacao` sem
 *  permissão — função em vez de ternário para o `&&`/`undefined` não passar
 *  pelo `noLeakedRender` da Biome. */
function onRemoverSeEscrever(
  podeEscrever: boolean,
  onExcluirLigacao: (id: string) => void,
  ligacaoId: string
): (() => void) | undefined {
  if (!podeEscrever) {
    return;
  }
  return () => onExcluirLigacao(ligacaoId);
}

const BOTAO_SECUNDARIO_LINK = {
  alignItems: "center",
  background: "var(--surface-2)",
  border: "1px solid var(--hairline-strong)",
  borderRadius: "var(--r-sm)",
  color: "var(--ink-muted)",
  display: "inline-flex",
  fontSize: "var(--fs-nota)",
  fontWeight: 700,
  gap: 6,
  padding: "6px 11px",
  textDecoration: "none",
} as const;

export function Painel({
  processo,
  processos,
  ligacoes,
  podeEscrever,
  onSelecionar,
  onEditar,
  onExcluirProcesso,
  onExcluirLigacao,
}: PainelProps) {
  const status = statusDe(processo);
  const tom = tomCssDoDominio(DOMINIOS[processo.dominio].tom);
  const porId = new Map(processos.map((p) => [p.id, p]));
  const ligacoesDoProcesso = vizinhos(processo.id, ligacoes);

  return (
    <aside
      style={{
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderLeft: `3px solid var(--${tom})`,
        borderRadius: "var(--r-lg)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: 16,
        position: "sticky",
        top: 0,
      }}
    >
      <div>
        <p
          className="mono"
          style={{
            color: `var(--${tom}-text)`,
            fontSize: "var(--fs-micro)",
            fontWeight: 700,
            letterSpacing: ".08em",
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          {eyebrowDoProcesso(processo)}
        </p>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "6px 0 0" }}>
          {processo.nome}
        </h2>
        <p
          style={{
            color: "var(--ink-muted)",
            fontSize: "var(--fs-base)",
            margin: "6px 0 0",
          }}
        >
          {processo.descricao}
        </p>
      </div>

      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
        <CartaoMetrica label="Status">
          <Badge tone={STATUS[status].tom}>{STATUS[status].rotulo}</Badge>
        </CartaoMetrica>
        <CartaoMetrica label="BPMN">
          {processo.diagram ? (
            <span>{processo.diagram.name}</span>
          ) : (
            <Badge tone="amber">sem modelo</Badge>
          )}
        </CartaoMetrica>
        <CartaoMetrica label="Dono">{processo.donoNome ?? "—"}</CartaoMetrica>
        <CartaoMetrica label="Revisado">
          {formatarDataCurta(processo.revisadoEm)}
        </CartaoMetrica>
      </div>

      <div
        style={{
          alignItems: "center",
          border: "1px dashed var(--hairline-strong)",
          borderRadius: "var(--r-md)",
          display: "flex",
          gap: 8,
          justifyContent: "space-between",
          padding: 10,
        }}
      >
        <span style={{ color: "var(--ink-muted)", fontSize: "var(--fs-nota)" }}>
          Documento
        </span>
        {processo.docUrl ? (
          <a
            href={processo.docUrl}
            rel="noreferrer"
            style={{
              color: "var(--accent-text)",
              fontSize: "var(--fs-nota)",
              fontWeight: 700,
            }}
            target="_blank"
          >
            Abrir
          </a>
        ) : (
          <span
            style={{ color: "var(--ink-faint)", fontSize: "var(--fs-nota)" }}
          >
            sem documento
          </span>
        )}
      </div>

      <div>
        <p
          className="mono"
          style={{
            color: "var(--ink-faint)",
            fontSize: "var(--fs-micro)",
            fontWeight: 700,
            letterSpacing: ".08em",
            margin: "0 0 8px",
            textTransform: "uppercase",
          }}
        >
          Ligações · {ligacoesDoProcesso.length}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ligacoesDoProcesso.map((v) => {
            const outro = porId.get(v.outro);
            if (!outro) {
              return null;
            }
            return (
              <LinhaLigacao
                dir={v.dir}
                key={v.ligacaoId}
                nome={outro.nome}
                onRemover={onRemoverSeEscrever(
                  podeEscrever,
                  onExcluirLigacao,
                  v.ligacaoId
                )}
                onSelecionar={() => onSelecionar(v.outro)}
                rotulo={v.rotulo}
              />
            );
          })}
        </div>
      </div>

      {processo.tags.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {processo.tags.map((tag) => (
            <Pilula key={tag}>{tag}</Pilula>
          ))}
        </div>
      ) : null}

      <div
        style={{
          borderTop: "1px solid var(--hairline)",
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          paddingTop: 12,
        }}
      >
        <Link href="/ferramentas/bpmn" style={BOTAO_SECUNDARIO_LINK}>
          Abrir no modelador
        </Link>
        {podeEscrever ? (
          <BotaoSecundario onClick={onEditar}>Editar</BotaoSecundario>
        ) : null}
        {podeEscrever ? (
          <ConfirmarAcao
            alvo={`${processo.codigo} · ${processo.nome}`}
            consequencia="O processo e as ligações dele somem. Não tem como desfazer."
            onConfirmar={() => onExcluirProcesso(processo.id)}
            rotulo="Excluir"
          />
        ) : null}
      </div>
    </aside>
  );
}
