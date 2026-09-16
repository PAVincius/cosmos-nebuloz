"use client";

import { Badge, SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback, useEffect, useState } from "react";
import {
  createDiagramAction,
  type DiagramDetail,
  type DiagramKind,
  type DiagramRow,
  definirClienteDoDiagramaAction,
  getDiagram,
  updateDiagramAction,
} from "@/app/actions/diagrams";
import { BPMN_EM_BRANCO, BpmnModeler } from "@/components/bpmn-modeler";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";
import { MERMAID_EXEMPLO, MermaidEditor } from "@/components/mermaid-editor";
import { SeletorDeAcervo } from "@/components/seletor-de-acervo";
import { useGuardaDeRascunho } from "@/lib/rascunho-sujo";
import { useParamState, useSubstituirParams } from "@/lib/url-state";

/**
 * Estúdio de diagramas: lista à esquerda, editor à direita, histórico embaixo.
 *
 * Um componente para BPMN e Mermaid porque tudo em volta do canvas é idêntico —
 * listar, criar, salvar revisão, ver histórico. Só o editor troca, e ele entra
 * por `kind`. Duas cópias divergiriam no primeiro ajuste de fluxo.
 *
 * O diagrama aberto mora em `?diagrama=<id>`, não em `useState`: F5 reabre o
 * mesmo, e o mapa de processos linka direto no diagrama do processo. A URL é a
 * fonte — clicar na lista escreve o param, e é o param que dispara a leitura.
 * Id que não está na lista cai no estado vazio, sem erro: link velho não é
 * culpa de quem abriu.
 */

/** Teto do arquivo enviado. Um BPMN de processo real fica na casa das dezenas
 *  de KB; 2 MB já é sinal de arquivo errado, e recusar aqui evita descobrir
 *  isso só quando o payload da action estourar. */
const LIMITE_BYTES = 2 * 1024 * 1024;

const EXTENSOES: Record<DiagramKind, string> = {
  BPMN: ".bpmn,.xml",
  MERMAID: ".mmd,.mermaid,.md,.txt",
};

/** Fonte com que um diagrama novo nasce quando não há arquivo enviado. */
const EM_BRANCO: Record<DiagramKind, string> = {
  BPMN: BPMN_EM_BRANCO,
  MERMAID: MERMAID_EXEMPLO,
};

/** Ícone da lista e do cabeçalho — tabela em vez de ternário repetido. */
const ICONE: Record<DiagramKind, "fileCode" | "server"> = {
  BPMN: "fileCode",
  MERMAID: "server",
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

/** Só o que o seletor de cliente precisa. */
export type ClienteOpcao = { id: string; name: string };

/**
 * Seletor do cliente que o diagrama descreve (`StaffDiagram.sobreTenantId`).
 *
 * Fica no cabeçalho do diagrama aberto, e não no formulário de criação, porque
 * a pergunta "sobre quem é isto" costuma se responder depois de desenhar.
 */
function SeletorDeCliente({
  clientes,
  valor,
  podeEscrever,
  onTrocar,
}: {
  clientes: ClienteOpcao[];
  valor: string | null;
  podeEscrever: boolean;
  onTrocar: (id: string) => void;
}) {
  return (
    <select
      aria-label="Cliente que este diagrama descreve"
      disabled={!podeEscrever}
      onChange={(e) => onTrocar(e.target.value)}
      style={{
        ...INPUT,
        width: "auto",
        minWidth: 190,
        padding: "6px 9px",
        fontSize: "var(--fs-nota)",
        cursor: podeEscrever ? "pointer" : "not-allowed",
      }}
      title={
        podeEscrever
          ? "Cliente que este diagrama descreve"
          : "Trocar o cliente exige papel ADMIN"
      }
      value={valor ?? ""}
    >
      <option value="">Sem cliente — conhecimento da casa</option>
      {clientes.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

const BOTAO_PERGUNTA = {
  padding: "6px 12px",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--hairline)",
  background: "none",
  fontSize: "var(--fs-nota)",
  fontWeight: 600,
  cursor: "pointer",
} as const;

/**
 * Pergunta inline antes de trocar de diagrama com edição pendente. Mesma
 * prosa e mesma ordem de `components/confirmar-acao.tsx` (o alvo escrito,
 * "Voltar" antes de "Descartar"); local porque aquele componente está mudando
 * em PR aberto — pode migrar para lá depois. Não é `window.confirm`: aquele
 * é dispensável por hábito, não diz o alvo e some do teste.
 */
function PerguntaDescartar({
  nome,
  onVoltar,
  onDescartar,
}: {
  nome: string;
  onVoltar: () => void;
  onDescartar: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "10px 12px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--red-border, var(--hairline-strong))",
        background: "var(--red-soft, var(--surface-2))",
      }}
    >
      <span style={{ fontSize: "var(--fs-base)", fontWeight: 600 }}>
        Descartar alterações em «{nome}»?
      </span>
      <span style={{ fontSize: "var(--fs-nota)", color: "var(--ink-muted)" }}>
        O que você editou e ainda não salvou some. Para manter, volte e salve
        uma revisão antes de trocar.
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="btn"
          onClick={onVoltar}
          style={{ ...BOTAO_PERGUNTA, color: "var(--ink-muted)" }}
          type="button"
        >
          Voltar
        </button>
        <button
          className="btn"
          onClick={onDescartar}
          style={{ ...BOTAO_PERGUNTA, color: "var(--red-text)" }}
          type="button"
        >
          Descartar
        </button>
      </div>
    </div>
  );
}

/** Revisões do diagrama aberto, mais nova primeiro. Componente próprio (e não
 *  JSX inline no `Estudio`) para o componente raiz caber na conta de
 *  complexidade do lint; nada muda no que aparece. */
function Historico({ revisoes }: { revisoes: DiagramDetail["historico"] }) {
  return (
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
        {revisoes.map((h, i) => (
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
            <Badge tone={i === 0 ? "green" : "neutral"}>v{h.versao}</Badge>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: "var(--fs-base)",
              }}
            >
              {h.nota ?? (
                <span style={{ color: "var(--ink-faint)" }}>sem nota</span>
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
  );
}

/**
 * A URL manda: `?diagrama=` muda (clique, F5, link colado) e o detalhe é lido.
 * Só busca id que está na lista — link para diagrama apagado ou de outro tipo
 * cai no estado vazio em vez de virar um erro na cara de quem colou. Fora do
 * `Estudio` para o efeito ter nome e o componente caber na conta de
 * complexidade do lint.
 */
function useDiagramaDaUrl({
  diagramaId,
  lista,
  abertoId,
  setAberto,
  setErro,
}: {
  diagramaId: string;
  lista: DiagramRow[];
  abertoId: string | undefined;
  setAberto: (d: DiagramDetail | null) => void;
  setErro: (e: string | null) => void;
}) {
  useEffect(() => {
    if (!(diagramaId && lista.some((d) => d.id === diagramaId))) {
      setAberto(null);
      return;
    }
    if (abertoId === diagramaId) {
      return;
    }
    let vivo = true;
    setErro(null);
    getDiagram(diagramaId).then((res) => {
      if (!vivo) {
        return;
      }
      if (res.ok) {
        setAberto(res.data);
      } else {
        setErro(res.error);
      }
    });
    return () => {
      vivo = false;
    };
  }, [diagramaId, lista, abertoId, setAberto, setErro]);
}

export function Estudio({
  kind,
  iniciais,
  clientes,
  podeEscrever,
}: {
  kind: DiagramKind;
  iniciais: DiagramRow[];
  clientes: ClienteOpcao[];
  podeEscrever: boolean;
}) {
  const [lista, setLista] = useState(iniciais);
  const [diagramaId, setDiagramaId] = useParamState("diagrama");
  // `?novo=<nome>` vem de "Criar diagrama para {processo}" no mapa: abre o
  // formulário já com o nome. Só o estado inicial lê o param — depois disso
  // é o formulário que manda, e o param sai da URL quando o diagrama nasce.
  const [novo] = useParamState("novo");
  const substituirParams = useSubstituirParams();
  const [aberto, setAberto] = useState<DiagramDetail | null>(null);
  const [criando, setCriando] = useState(podeEscrever && novo !== "");
  const [nome, setNome] = useState(novo);
  const [enviado, setEnviado] = useState<Enviado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // O editor é quem sabe se o XML/texto mudou; ele avisa por `onSujo`.
  const [sujo, setSujo] = useState(false);

  const emBranco = EM_BRANCO[kind];
  const icone = ICONE[kind];

  useDiagramaDaUrl({
    abertoId: aberto?.id,
    diagramaId,
    lista,
    setAberto,
    setErro,
  });

  const abrirDeFato = useCallback(
    (id: string) => {
      setSujo(false);
      setErro(null);
      setDiagramaId(id);
    },
    [setDiagramaId]
  );

  // Trocar de diagrama com edição pendente pergunta antes — e enquanto está
  // sujo, fechar a aba passa pelo aviso do navegador.
  const guarda = useGuardaDeRascunho({
    abertoId: aberto?.id,
    abrirDeFato,
    sujo,
  });

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
      // Abre pela URL, como qualquer outro item da lista; `novo` sai junto,
      // num replace só — senão F5 reabriria o formulário com o nome usado.
      substituirParams({ diagrama: det.data.id, novo: "" });
    }
  }, [kind, nome, emBranco, enviado, substituirParams]);

  const trocarCliente = useCallback(
    async (sobreTenantId: string) => {
      if (!aberto) {
        return;
      }
      setErro(null);
      const res = await definirClienteDoDiagramaAction({
        id: aberto.id,
        sobreTenantId,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      const det = await getDiagram(aberto.id);
      if (det.ok) {
        setAberto(det.data);
      }
    },
    [aberto]
  );

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
        icone={icone}
        itens={lista.map((d) => ({
          id: d.id,
          titulo: d.name,
          detalhe: `${d.slug} · v${d.versoes}`,
        }))}
        onSelecionar={guarda.abrir}
        selecionadoId={aberto?.id ?? null}
        subtitulo={`${lista.length} ${lista.length === 1 ? "diagrama" : "diagramas"}`}
        titulo="Diagramas"
        vazio={`Nenhum diagrama ainda. ${podeEscrever ? "Crie o primeiro em Novo." : "Criar exige papel ADMIN."}`}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {aberto ? (
          <>
            {guarda.pendente ? (
              <PerguntaDescartar
                nome={aberto.name}
                onDescartar={guarda.descartar}
                onVoltar={guarda.voltar}
              />
            ) : null}
            <SectionCard
              action={
                <SeletorDeCliente
                  clientes={clientes}
                  onTrocar={trocarCliente}
                  podeEscrever={podeEscrever}
                  valor={aberto.sobreTenantId}
                />
              }
              icon={icone}
              subtitle={`${aberto.slug} · versão atual v${aberto.versoes} · ${aberto.sobreTenantNome ?? "sem cliente"}`}
              title={aberto.name}
            >
              {/* `key` por diagrama: trocar de item remonta o editor, então
                  fonte, nota e `sujo` nascem limpos em vez de vazar do
                  anterior — o Mermaid guarda o texto em `useState`. */}
              {kind === "BPMN" ? (
                <BpmnModeler
                  key={aberto.id}
                  onSalvar={salvar}
                  onSujo={setSujo}
                  podeEscrever={podeEscrever}
                  sourceInicial={aberto.source}
                />
              ) : (
                <MermaidEditor
                  key={aberto.id}
                  onSalvar={salvar}
                  onSujo={setSujo}
                  podeEscrever={podeEscrever}
                  sourceInicial={aberto.source}
                />
              )}
            </SectionCard>

            <Historico revisoes={aberto.historico} />
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
