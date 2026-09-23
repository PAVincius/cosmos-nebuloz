"use client";

/**
 * Painel do nó (Task 5, spec §4; design `ProcessPanel` de
 * backoffice-process-map-screen.jsx, sem a tabela "Fontes conectadas" nem o
 * `ConnectSourceModal" — a spec §0 cortou fontes externas). Recebe o
 * processo já selecionado por `mapa.tsx` e devolve intenção por callback.
 */
import { Badge } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { useState } from "react";
import type { LigacaoRow, ProcessoRow } from "@/app/actions/processos";
import { BotaoSecundario } from "@/components/campo";
import { Confirmacao } from "@/components/confirmacao";
import { ConfirmarAcao } from "@/components/confirmar-acao";
import { formatarData } from "@/lib/empresa/formato";
import {
  DOMINIOS,
  NIVEIS,
  STATUS,
  statusDe,
  vizinhos,
} from "@/lib/ferramentas/processos";
import type { Result } from "@/lib/safe-action";
import { tomCss } from "@/lib/tom";
import {
  CartaoMetrica,
  FormularioNovaLigacao,
  LinhaLigacao,
  Pilula,
} from "./painel-partes";

export type PainelProps = {
  processo: ProcessoRow;
  processos: ProcessoRow[];
  ligacoes: LigacaoRow[];
  podeEscrever: boolean;
  executando: boolean;
  onSelecionar: (id: string) => void;
  onEditar: () => void;
  onExcluirProcesso: (id: string) => void;
  /** Resolve `true` quando a ligação saiu — o painel diz qual. */
  onExcluirLigacao: (id: string) => Promise<boolean>;
  onCriarLigacao: (paraId: string, rotulo: string) => Promise<Result<unknown>>;
};

/** "PZ-01 · Comercial · nível 2 tático · núcleo" — único lugar que junta os
 *  quatro pedaços do eyebrow, na ordem do design. */
function eyebrowDoProcesso(p: ProcessoRow): string {
  const tipo = p.tipo === "CORE" ? "núcleo" : "apoio";
  return `${p.codigo} · ${DOMINIOS[p.dominio].rotulo} · nível ${p.nivel} ${NIVEIS[p.nivel].rotulo.toLowerCase()} · ${tipo}`;
}

/** Com diagrama, o link abre exatamente ele (`?diagrama=<id>`, o param que o
 *  Estúdio lê); sem diagrama, convida a criar já com o nome do processo
 *  (`?novo=<nome>`, que o Estúdio usa para pré-preencher o formulário). Antes
 *  os dois rótulos levavam ao Estúdio genérico, e a pessoa tinha de achar o
 *  diagrama na lista de novo (spec §4; crítica, heurística 7). */
function linkDoModelador(p: ProcessoRow): { href: string; rotulo: string } {
  if (p.diagram) {
    return {
      href: `/ferramentas/bpmn?diagrama=${encodeURIComponent(p.diagram.id)}`,
      rotulo: "Abrir no modelador",
    };
  }
  return {
    href: `/ferramentas/bpmn?novo=${encodeURIComponent(p.nome)}`,
    rotulo: `Criar diagrama para ${p.nome}`,
  };
}

/** `undefined` (não uma função vazia) esconde o × de `LinhaLigacao` sem
 *  permissão — função em vez de ternário para o `&&`/`undefined` não passar
 *  pelo `noLeakedRender` da Biome. */
function onRemoverSeEscrever(
  podeEscrever: boolean,
  remover: () => void
): (() => void) | undefined {
  if (!podeEscrever) {
    return;
  }
  return remover;
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
  executando,
  onSelecionar,
  onEditar,
  onExcluirProcesso,
  onExcluirLigacao,
  onCriarLigacao,
}: PainelProps) {
  const status = statusDe(processo);
  const tom = tomCss(DOMINIOS[processo.dominio].tom);
  const porId = new Map(processos.map((p) => [p.id, p]));
  const ligacoesDoProcesso = vizinhos(processo.id, ligacoes);
  const candidatosLigacao = processos
    .filter((p) => p.id !== processo.id)
    .map((p) => ({ codigo: p.codigo, id: p.id, nome: p.nome }));
  const modelador = linkDoModelador(processo);
  // O fim das ações de ligação, no painel onde elas acontecem. Vive aqui e
  // não no `Mapa`: o painel remonta a cada processo (`key`), e a frase de um
  // não pode aparecer no outro.
  const [aviso, setAviso] = useState<string | null>(null);

  const removerLigacao = async (ligacaoId: string, nome: string) => {
    setAviso(null);
    if (await onExcluirLigacao(ligacaoId)) {
      setAviso(`Ligação com ${nome} removida.`);
    }
  };

  const criarLigacao = async (paraId: string, rotulo: string) => {
    setAviso(null);
    const res = await onCriarLigacao(paraId, rotulo);
    if (res.ok) {
      setAviso(
        `Ligação com ${porId.get(paraId)?.nome ?? "o processo"} criada.`
      );
    }
    return res;
  };

  return (
    <aside
      style={{
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
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
            alignItems: "center",
            color: `var(--${tom}-text)`,
            display: "flex",
            fontSize: "var(--fs-micro)",
            fontWeight: 700,
            gap: 6,
            letterSpacing: ".08em",
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          {/* A cor do domínio, num ponto ao lado do rótulo — não numa borda
              grossa no cartão (apps/backoffice/DESIGN.md: hairline, nunca borda
              grossa). O nome do domínio já está no texto; o ponto é só cor. */}
          <span
            aria-hidden="true"
            data-ponto-dominio=""
            style={{
              background: `var(--${tom})`,
              borderRadius: "var(--r-pill)",
              flex: "none",
              height: 7,
              width: 7,
            }}
          />
          {eyebrowDoProcesso(processo)}
        </p>
        <h2
          style={{
            fontSize: "var(--fs-titulo)",
            fontWeight: 700,
            margin: "6px 0 0",
          }}
        >
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

      <div className="bo-duas-colunas" style={{ gap: 8 }}>
        <CartaoMetrica label="Status">
          <Badge tone={STATUS[status].tom}>{STATUS[status].rotulo}</Badge>
        </CartaoMetrica>
        <CartaoMetrica label="BPMN">
          {processo.diagram ? (
            <span>v{processo.diagram.versoes}</span>
          ) : (
            <Badge tone="amber">sem modelo</Badge>
          )}
        </CartaoMetrica>
        <CartaoMetrica label="Dono">{processo.donoNome ?? "—"}</CartaoMetrica>
        <CartaoMetrica label="Revisado">
          {formatarData(processo.revisadoEm)}
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
                onRemover={onRemoverSeEscrever(podeEscrever, () =>
                  removerLigacao(v.ligacaoId, outro.nome)
                )}
                onSelecionar={() => onSelecionar(v.outro)}
                rotulo={v.rotulo}
              />
            );
          })}
        </div>
        {podeEscrever ? (
          <FormularioNovaLigacao
            candidatos={candidatosLigacao}
            onCriar={criarLigacao}
          />
        ) : null}
        {aviso ? (
          <div style={{ marginTop: 8 }}>
            <Confirmacao>{aviso}</Confirmacao>
          </div>
        ) : null}
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
        <Link href={modelador.href} style={BOTAO_SECUNDARIO_LINK}>
          {modelador.rotulo}
        </Link>
        {podeEscrever ? (
          <BotaoSecundario onClick={onEditar}>Editar</BotaoSecundario>
        ) : null}
        {podeEscrever ? (
          <ConfirmarAcao
            alvo={`${processo.codigo} · ${processo.nome}`}
            consequencia="O processo e as ligações dele somem. Não tem como desfazer."
            executando={executando}
            onConfirmar={() => onExcluirProcesso(processo.id)}
            rotulo="Excluir"
          />
        ) : null}
      </div>
    </aside>
  );
}
