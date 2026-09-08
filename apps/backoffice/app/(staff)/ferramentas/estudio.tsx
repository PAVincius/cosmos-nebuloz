"use client";

import { Badge, SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback, useState } from "react";
import {
  createDiagramAction,
  type DiagramDetail,
  type DiagramKind,
  type DiagramRow,
  getDiagram,
  updateDiagramAction,
} from "@/app/actions/diagrams";
import { BPMN_EM_BRANCO, BpmnModeler } from "@/components/bpmn-modeler";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";
import { MERMAID_EXEMPLO, MermaidEditor } from "@/components/mermaid-editor";
import { SeletorDeAcervo } from "@/components/seletor-de-acervo";

/**
 * Estúdio de diagramas: lista à esquerda, editor à direita, histórico embaixo.
 *
 * Um componente para BPMN e Mermaid porque tudo em volta do canvas é idêntico —
 * listar, criar, salvar revisão, ver histórico. Só o editor troca, e ele entra
 * por `kind`. Duas cópias divergiriam no primeiro ajuste de fluxo.
 */

/** Teto do arquivo enviado. Um BPMN de processo real fica na casa das dezenas
 *  de KB; 2 MB já é sinal de arquivo errado, e recusar aqui evita descobrir
 *  isso só quando o payload da action estourar. */
const LIMITE_BYTES = 2 * 1024 * 1024;

const EXTENSOES: Record<DiagramKind, string> = {
  BPMN: ".bpmn,.xml",
  MERMAID: ".mmd,.mermaid,.md,.txt",
};

/** No topo por exigência do lint, e com razão: regex literal dentro de handler
 *  é recompilada a cada render. */
const EXTENSAO_FINAL = /\.[^.]+$/;

type Enviado = { nome: string; texto: string };

/** O que a linha de dica diz, nos três casos. */
function dica(enviado: Enviado | null, kind: DiagramKind): string {
  if (enviado) {
    return `${enviado.nome} · ${Math.round(enviado.texto.length / 1024)} KB`;
  }
  return kind === "BPMN"
    ? "sem arquivo — nasce com um evento de início"
    : "sem arquivo — nasce com um fluxo de exemplo";
}

/**
 * Criação de diagrama: nome mais duas origens, em branco ou arquivo existente.
 *
 * Sem a segunda, trazer um diagrama que já existe obriga a abrir o arquivo,
 * copiar e colar — e no BPMN isso é um XML de dezenas de KB.
 */
function FormularioNovo({
  kind,
  nome,
  enviado,
  onNome,
  onArquivo,
  onCriar,
}: {
  kind: DiagramKind;
  nome: string;
  enviado: Enviado | null;
  onNome: (v: string) => void;
  onArquivo: (f: File | undefined) => void;
  onCriar: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <Campo htmlFor="nome-diagrama" label="Nome">
        <input
          id="nome-diagrama"
          onChange={(e) => onNome(e.target.value)}
          style={INPUT}
          value={nome}
        />
      </Campo>

      <Campo htmlFor="arquivo-diagrama" label="Ou envie um arquivo">
        <input
          accept={EXTENSOES[kind]}
          id="arquivo-diagrama"
          onChange={(e) => onArquivo(e.target.files?.[0])}
          style={{
            ...INPUT,
            padding: "7px 9px",
            fontSize: "var(--fs-nota)",
            cursor: "pointer",
          }}
          type="file"
        />
      </Campo>

      <p
        className="mono"
        style={{
          margin: 0,
          fontSize: "var(--fs-nota)",
          lineHeight: 1.5,
          color: enviado ? "var(--green-text)" : "var(--ink-faint)",
        }}
      >
        {dica(enviado, kind)}
      </p>

      <BotaoPrimario
        disabled={nome.trim().length < 2}
        onClick={onCriar}
        type="button"
      >
        {enviado ? "Importar" : "Criar em branco"}
      </BotaoPrimario>
    </div>
  );
}

export function Estudio({
  kind,
  iniciais,
  podeEscrever,
}: {
  kind: DiagramKind;
  iniciais: DiagramRow[];
  podeEscrever: boolean;
}) {
  const [lista, setLista] = useState(iniciais);
  const [aberto, setAberto] = useState<DiagramDetail | null>(null);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [enviado, setEnviado] = useState<Enviado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const emBranco = kind === "BPMN" ? BPMN_EM_BRANCO : MERMAID_EXEMPLO;

  const receberArquivo = useCallback(async (arquivo: File | undefined) => {
    if (!arquivo) {
      return;
    }
    setErro(null);
    if (arquivo.size > LIMITE_BYTES) {
      setErro(
        `${arquivo.name} tem ${Math.round(arquivo.size / 1024)} KB e o limite é 2 MB. Confira se é mesmo um diagrama.`
      );
      return;
    }
    const texto = await arquivo.text();
    setEnviado({ nome: arquivo.name, texto });
    // Nome do arquivo sem extensão vira sugestão, e só quando o campo está
    // vazio: sobrescrever o que a pessoa já digitou seria roubar o teclado.
    setNome((atual) => atual || arquivo.name.replace(EXTENSAO_FINAL, ""));
  }, []);

  const abrir = useCallback(async (id: string) => {
    setErro(null);
    const res = await getDiagram(id);
    if (res.ok) {
      setAberto(res.data);
    } else {
      setErro(res.error);
    }
  }, []);

  const criar = useCallback(async () => {
    setErro(null);
    const res = await createDiagramAction({
      kind,
      name: nome,
      source: enviado?.texto ?? emBranco,
    });
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setCriando(false);
    setNome("");
    setEnviado(null);
    // Recarrega o detalhe em vez de montar a linha na mão: o que a tela mostra
    // passa a ser o que o banco gravou, e não a minha suposição do que gravou.
    const det = await getDiagram(res.data.id);
    if (det.ok) {
      setAberto(det.data);
      setLista((atual) => [
        {
          id: det.data.id,
          kind: det.data.kind,
          name: det.data.name,
          slug: det.data.slug,
          descricao: det.data.descricao,
          versoes: det.data.versoes,
          atualizadoEm: det.data.atualizadoEm,
          criadoPorNome: det.data.criadoPorNome,
        },
        ...atual,
      ]);
    }
  }, [kind, nome, emBranco, enviado]);

  const salvar = useCallback(
    async (source: string, nota: string): Promise<string | null> => {
      if (!aberto) {
        return "Nenhum diagrama aberto.";
      }
      const res = await updateDiagramAction({ id: aberto.id, source, nota });
      if (!res.ok) {
        return res.error;
      }
      const det = await getDiagram(aberto.id);
      if (det.ok) {
        setAberto(det.data);
      }
      return null;
    },
    [aberto]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {erro ? <Erro>{erro}</Erro> : null}

      <SeletorDeAcervo
        acao={
          podeEscrever ? (
            <BotaoPrimario
              full={false}
              onClick={() => setCriando((v) => !v)}
              type="button"
            >
              {criando ? "Cancelar" : "Novo"}
            </BotaoPrimario>
          ) : null
        }
        formulario={
          criando ? (
            <FormularioNovo
              enviado={enviado}
              kind={kind}
              nome={nome}
              onArquivo={receberArquivo}
              onCriar={criar}
              onNome={setNome}
            />
          ) : null
        }
        icone={kind === "BPMN" ? "fileCode" : "server"}
        itens={lista.map((d) => ({
          id: d.id,
          titulo: d.name,
          detalhe: `${d.slug} · v${d.versoes}`,
        }))}
        onSelecionar={abrir}
        selecionadoId={aberto?.id ?? null}
        subtitulo={`${lista.length} diagrama(s)`}
        titulo="Diagramas"
        vazio={`Nenhum diagrama ainda. ${podeEscrever ? "Crie o primeiro em Novo." : "Criar exige papel ADMIN."}`}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {aberto ? (
          <>
            <SectionCard
              icon={kind === "BPMN" ? "fileCode" : "server"}
              subtitle={`${aberto.slug} · versão atual v${aberto.versoes}`}
              title={aberto.name}
            >
              {kind === "BPMN" ? (
                <BpmnModeler
                  onSalvar={salvar}
                  podeEscrever={podeEscrever}
                  sourceInicial={aberto.source}
                />
              ) : (
                <MermaidEditor
                  onSalvar={salvar}
                  podeEscrever={podeEscrever}
                  sourceInicial={aberto.source}
                />
              )}
            </SectionCard>

            <SectionCard
              icon="history"
              subtitle="append-only — editar cria revisão, nunca sobrescreve"
              title="Histórico"
            >
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {aberto.historico.map((h, i) => (
                  <li
                    key={h.versao}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 2px",
                      borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
                    }}
                  >
                    <Badge tone={i === 0 ? "green" : "neutral"}>
                      v{h.versao}
                    </Badge>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: "var(--fs-base)",
                      }}
                    >
                      {h.nota ?? (
                        <span style={{ color: "var(--ink-faint)" }}>
                          sem nota
                        </span>
                      )}
                    </span>
                    <span
                      className="mono"
                      style={{
                        fontSize: "var(--fs-nota)",
                        color: "var(--ink-faint)",
                      }}
                    >
                      {h.autorNome ?? "—"} ·{" "}
                      {new Date(h.criadoEm).toLocaleString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </>
        ) : (
          <SectionCard title="Nenhum diagrama aberto">
            <p
              style={{
                margin: 0,
                padding: 24,
                textAlign: "center",
                fontSize: "var(--fs-base)",
                lineHeight: 1.6,
                color: "var(--ink-muted)",
              }}
            >
              Escolha um diagrama na lista para editar.
            </p>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
