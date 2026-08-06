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
  onSalvar,
}: {
  sourceInicial: string;
  podeEscrever: boolean;
  onSalvar: (source: string, nota: string) => Promise<string | null>;
}) {
  const [source, setSource] = useState(sourceInicial);
  const [svg, setSvg] = useState<string>("");
  const [erroRender, setErroRender] = useState<string | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [salvando, setSalvando] = useState(false);
  const seq = useRef(0);

  const sujo = source !== sourceInicial;

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
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ink)",
            outline: "none",
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
              fontSize: 10,
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
              fontSize: 12.5,
              lineHeight: 1.65,
              color: "var(--ink)",
              outline: "none",
            }}
            value={source}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span
            className="mono"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: erroRender ? "var(--red-text)" : "var(--ink-faint)",
            }}
          >
            {erroRender ? "Não renderizou" : "Prévia"}
          </span>
          <div
            className="scroll"
            style={{
              height: 460,
              overflow: "auto",
              display: "grid",
              placeItems: "center",
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
                  fontSize: 11.5,
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
              // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG sanitizado pelo DOMPurify do mermaid em securityLevel strict
              <div dangerouslySetInnerHTML={{ __html: svg }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
