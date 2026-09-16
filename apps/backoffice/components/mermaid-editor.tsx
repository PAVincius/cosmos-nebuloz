"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BotaoPrimario, Erro, mensagemDeErro, rotuloSalvar } from "./campo";

/**
 * Diagrama-como-código sobre Mermaid.
 *
 * O texto é a fonte da verdade e o canvas reflete o texto — nunca o contrário.
 * É isso que torna o diagrama diffável numa revisão e versionável em git, que é
 * a razão de a tela existir em vez de um editor de arrastar caixinha.
 *
 * Mermaid roda inteiro no cliente: nenhum byte do diagrama sai da máquina de
 * quem edita. Foi o critério que descartou o Eraser aqui — lá o render é SaaS
 * atrás de API key, e o conteúdo teria de viajar a cada preview.
 */

export const MERMAID_EXEMPLO = `flowchart LR
  A[Proposta enviada] --> B{Desconto > 15%?}
  B -- não --> C[Contrato gerado]
  B -- sim --> D[Fila de aprovação]
  D --> E{Aprovado?}
  E -- sim --> C
  E -- não --> F[Devolvido ao comercial]`;

const ESPERA_MS = 400;
const VAZIO = "flowchart LR\n  vazio[Sem conteúdo]";

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const ZOOM_PASSO = 0.25;

/** Mantém o zoom dentro da faixa útil: abaixo de 25% nada se lê, acima de 400%
 *  o SVG vira pixel gigante sem ganho de informação. */
const limitar = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

function BotaoZoom({
  children,
  onClick,
  rotulo,
}: {
  children: string;
  onClick: () => void;
  rotulo: string;
}) {
  return (
    <button
      aria-label={rotulo}
      className="btn"
      onClick={onClick}
      style={{
        width: 24,
        height: 24,
        display: "grid",
        placeItems: "center",
        background: "none",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-sm)",
        fontSize: "var(--fs-forte)",
        fontWeight: 700,
        lineHeight: 1,
        color: "var(--ink-muted)",
        cursor: "pointer",
      }}
      title={rotulo}
      type="button"
    >
      {children}
    </button>
  );
}

/** Renderiza a DSL em SVG. Fora do componente para o efeito ficar só com o
 *  debounce e a decisão de qual resposta ainda vale. */
async function renderizar(id: string, source: string): Promise<string> {
  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    securityLevel: "strict",
    fontFamily: "inherit",
  });
  const { svg } = await mermaid.render(id, source.trim() || VAZIO);
  return svg;
}

export function MermaidEditor({
  sourceInicial,
  podeEscrever,
  nomeArquivo = "diagrama",
  onSalvar,
  onSujo,
}: {
  sourceInicial: string;
  podeEscrever: boolean;
  /** Slug do diagrama; vira o nome do arquivo exportado. */
  nomeArquivo?: string;
  onSalvar: (source: string, nota: string) => Promise<string | null>;
  /** Avisa a tela quando há edição não salva — é ela quem segura a troca de
   *  diagrama e o fechar da aba; o editor só sabe do próprio texto. */
  onSujo?: (sujo: boolean) => void;
}) {
  const [source, setSource] = useState(sourceInicial);
  const [svg, setSvg] = useState<string>("");
  const [erroRender, setErroRender] = useState<string | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [zoom, setZoom] = useState(1);
  const seq = useRef(0);

  const sujo = source !== sourceInicial;

  useEffect(() => {
    onSujo?.(sujo);
  }, [sujo, onSujo]);

  useEffect(() => {
    // Debounce: renderizar a cada tecla faz o parser rodar em texto sempre
    // incompleto, e o preview pisca em erro enquanto a pessoa ainda digita.
    const t = setTimeout(() => {
      seq.current += 1;
      const meu = seq.current;
      // A guarda `meu === seq.current` descarta resposta de render superseded:
      // sem ela, um texto inválido que demora pode chegar depois do válido e
      // deixar o preview mostrando o erro de algo que já não existe mais.
      renderizar(`m-${meu}`, source)
        .then((gerado) => {
          if (meu === seq.current) {
            setSvg(gerado);
            setErroRender(null);
          }
        })
        .catch((e) => {
          if (meu === seq.current) {
            setErroRender(mensagemDeErro(e));
          }
        });
    }, ESPERA_MS);

    return () => clearTimeout(t);
  }, [source]);

  const podeSalvar = podeEscrever && sujo && !salvando;
  const podeExportar = Boolean(svg) && !erroRender;

  /**
   * Baixa a prévia como `.svg`.
   *
   * O texto do SVG já está em memória — é o mesmo que a prévia renderiza — então
   * exportar é um Blob e um clique sintético, sem ida ao servidor. `revokeObjectURL`
   * logo em seguida porque a URL segura o Blob vivo até o fim da aba.
   */
  const exportar = useCallback(() => {
    const url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nomeArquivo}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [svg, nomeArquivo]);

  const salvar = useCallback(async () => {
    setSalvando(true);
    setErroSalvar(null);
    const falha = await onSalvar(source, nota);
    if (falha) {
      setErroSalvar(falha);
    } else {
      setNota("");
    }
    setSalvando(false);
  }, [source, nota, onSalvar]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {erroSalvar ? <Erro>{erroSalvar}</Erro> : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <input
          aria-label="O que mudou nesta revisão"
          disabled={!podeEscrever}
          onChange={(e) => setNota(e.target.value)}
          placeholder="O que mudou nesta revisão"
          style={{
            flex: 1,
            minWidth: 220,
            background: "var(--surface-2)",
            border: "1px solid var(--hairline)",
            borderRadius: "var(--r-md)",
            padding: "9px 12px",
            fontFamily: "inherit",
            fontSize: "var(--fs-base)",
            fontWeight: 600,
            color: "var(--ink)",
          }}
          value={nota}
        />
        <BotaoPrimario
          disabled={!podeSalvar}
          full={false}
          onClick={salvar}
          type="button"
        >
          {rotuloSalvar(salvando, sujo)}
        </BotaoPrimario>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) minmax(0,1.2fr)",
          gap: 12,
          alignItems: "stretch",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label
            className="mono"
            htmlFor="mermaid-source"
            style={{
              fontSize: "var(--fs-micro)",
              fontWeight: 700,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
            }}
          >
            Fonte
          </label>
          <textarea
            className="mono scroll"
            disabled={!podeEscrever}
            id="mermaid-source"
            onChange={(e) => setSource(e.target.value)}
            spellCheck={false}
            style={{
              height: 460,
              resize: "vertical",
              background: "var(--surface-2)",
              border: "1px solid var(--hairline)",
              borderRadius: "var(--r-md)",
              padding: 13,
              fontSize: "var(--fs-base)",
              lineHeight: 1.65,
              color: "var(--ink)",
            }}
            value={source}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              className="mono"
              style={{
                flex: 1,
                fontSize: "var(--fs-micro)",
                fontWeight: 700,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: erroRender ? "var(--red-text)" : "var(--ink-faint)",
              }}
            >
              {erroRender ? "Não renderizou" : "Prévia"}
            </span>
            {/* Zoom só sobre a prévia — o diagrama gerado costuma sair maior
                que a caixa, e sem isto a única saída é ler o SVG rolando. */}
            <BotaoZoom
              onClick={() => setZoom((z) => limitar(z - ZOOM_PASSO))}
              rotulo="Diminuir zoom"
            >
              −
            </BotaoZoom>
            <button
              className="btn mono"
              onClick={() => setZoom(1)}
              style={{
                minWidth: 46,
                background: "none",
                border: "1px solid var(--hairline)",
                borderRadius: "var(--r-sm)",
                padding: "3px 6px",
                fontSize: "var(--fs-nota)",
                fontWeight: 700,
                color: "var(--ink-muted)",
                cursor: "pointer",
              }}
              title="Voltar para 100%"
              type="button"
            >
              {Math.round(zoom * 100)}%
            </button>
            <BotaoZoom
              onClick={() => setZoom((z) => limitar(z + ZOOM_PASSO))}
              rotulo="Aumentar zoom"
            >
              +
            </BotaoZoom>
            <button
              className="btn mono"
              disabled={!podeExportar}
              onClick={exportar}
              style={{
                background: "none",
                border: "1px solid var(--hairline)",
                borderRadius: "var(--r-sm)",
                padding: "3px 8px",
                fontSize: "var(--fs-nota)",
                fontWeight: 700,
                color: podeExportar ? "var(--ink-muted)" : "var(--ink-faint)",
                cursor: podeExportar ? "pointer" : "not-allowed",
              }}
              title={
                podeExportar
                  ? "Baixar a prévia como .svg"
                  : "Exporta quando a prévia renderizar"
              }
              type="button"
            >
              SVG
            </button>
          </div>
          <div
            className="scroll"
            style={{
              height: 460,
              overflow: "auto",
              display: "grid",
              placeItems: zoom > 1 ? "start" : "center",
              padding: 14,
              background: "var(--surface)",
              border: `1px solid ${erroRender ? "rgba(var(--red-rgb),.35)" : "var(--hairline)"}`,
              borderRadius: "var(--r-md)",
            }}
          >
            {erroRender ? (
              <pre
                className="mono"
                style={{
                  margin: 0,
                  fontSize: "var(--fs-nota)",
                  color: "var(--red-text)",
                  whiteSpace: "pre-wrap",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                {erroRender}
              </pre>
            ) : (
              // SVG gerado pelo Mermaid a partir do texto do próprio operador.
              //
              // Conferido no pacote instalado, não presumido: mermaid 11.12.1
              // declara `dompurify ^3.2.5` como dependência e o dist chama
              // `sanitize()` junto de `securityLevel` em 8 arquivos. Com
              // "strict" a saída passa por DOMPurify antes de voltar daqui.
              //
              // Além disso o texto de entrada é de staff autenticado que passou
              // por `assertCanWrite` — não é conteúdo de terceiro. Se um dia
              // esta tela aceitar fonte de fora, esta linha precisa voltar para
              // discussão.
              <div
                // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG sanitizado pelo DOMPurify do mermaid em securityLevel strict
                dangerouslySetInnerHTML={{ __html: svg }}
                style={{
                  transform: `scale(${zoom})`,
                  // Cresce a partir do topo-esquerda para o scroll alcançar o
                  // que passou da caixa; com origem no centro, metade do
                  // diagrama ampliado fica fora e inacessível.
                  transformOrigin: "top left",
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
