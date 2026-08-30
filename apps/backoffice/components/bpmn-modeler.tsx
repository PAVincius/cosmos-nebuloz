"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BotaoPrimario, Erro, mensagemDeErro, rotuloSalvar } from "./campo";

/**
 * Modeler BPMN 2.0 sobre bpmn-js, com properties panel, minimapa, simulação de
 * token e color picker.
 *
 * **Licença:** a bpmn.io License permite uso comercial, modificação e venda,
 * mas o watermark que linka para bpmn.io "MUST NOT be removed or changed" e
 * precisa ficar totalmente visível, sem sobreposição. A estilização abaixo mexe
 * só na moldura — canvas, painel e barra — e nunca cobre o canto onde ele fica.
 * Não é preferência estética: é condição de uso da biblioteca.
 *
 * Carga dinâmica dentro do efeito, não import de topo: bpmn-js e o properties
 * panel somam alguns MB e tocam `window` na importação. Import estático
 * quebraria o render no servidor e mandaria o peso todo para o chunk inicial de
 * uma tela que a maioria dos operadores nunca abre.
 */

/** XML mínimo válido — diagrama novo precisa nascer de algo que o modeler abra. */
export const BPMN_EM_BRANCO = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Início" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="180" y="160" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

type Modeler = {
  importXML: (xml: string) => Promise<{ warnings: unknown[] }>;
  saveXML: (opts: { format: boolean }) => Promise<{ xml?: string }>;
  destroy: () => void;
  on: (evento: string, cb: () => void) => void;
};

/**
 * Monta o modeler com os addons. Fora do componente porque é onde mora toda a
 * conversa com bibliotecas sem tipo — mantê-la aqui deixa uma fronteira só para
 * revisar, e o efeito lá embaixo volta a caber na cabeça.
 */
async function montarModeler(
  canvas: HTMLElement,
  painel: HTMLElement
): Promise<Modeler> {
  const [
    { default: BpmnJS },
    propsPanel,
    { default: minimapModule },
    tokenSim,
    { default: colorPicker },
  ] = await Promise.all([
    import("bpmn-js/lib/Modeler"),
    import("bpmn-js-properties-panel"),
    import("diagram-js-minimap"),
    import("bpmn-js-token-simulation"),
    import("bpmn-js-color-picker"),
  ]);

  return new (BpmnJS as unknown as new (o: unknown) => Modeler)({
    container: canvas,
    propertiesPanel: { parent: painel },
    additionalModules: [
      propsPanel.BpmnPropertiesPanelModule,
      propsPanel.BpmnPropertiesProviderModule,
      minimapModule,
      (tokenSim as { default: unknown }).default,
      colorPicker,
    ],
  });
}

export function BpmnModeler({
  sourceInicial,
  podeEscrever,
  onSalvar,
}: {
  sourceInicial: string;
  podeEscrever: boolean;
  onSalvar: (xml: string, nota: string) => Promise<string | null>;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<Modeler | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sujo, setSujo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [nota, setNota] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    const painel = painelRef.current;
    if (!(canvas && painel)) {
      return;
    }

    let vivo = true;
    let instancia: Modeler | null = null;

    const iniciar = async () => {
      instancia = await montarModeler(canvas, painel);
      // Desmontou durante o import dinâmico: descarta em vez de anexar um
      // modeler a um container que já saiu da árvore.
      if (!vivo) {
        instancia.destroy();
        return;
      }
      await instancia.importXML(sourceInicial);
      // `commandStack.changed` cobre desenhar, mover e editar propriedade —
      // um listener só em vez de um por tipo de interação.
      instancia.on("commandStack.changed", () => setSujo(true));
      modelerRef.current = instancia;
    };

    iniciar()
      .catch((e) => {
        if (vivo) {
          setErro(mensagemDeErro(e));
        }
      })
      .finally(() => {
        if (vivo) {
          setCarregando(false);
        }
      });

    return () => {
      vivo = false;
      instancia?.destroy();
      modelerRef.current = null;
    };
  }, [sourceInicial]);

  // Fora do JSX: o `||` inline é lido pelo lint como valor vazando para o
  // render, e a regra em si tem razão — atributo booleano merece nome.
  const podeSalvar = podeEscrever && sujo && !salvando;

  const salvar = useCallback(async () => {
    const m = modelerRef.current;
    if (!m) {
      return;
    }
    setSalvando(true);
    setErro(null);
    const { xml } = await m.saveXML({ format: true });
    if (!xml) {
      setErro("O modeler não devolveu XML. A alteração não foi gravada.");
      setSalvando(false);
      return;
    }
    const falha = await onSalvar(xml, nota);
    if (falha) {
      setErro(falha);
    } else {
      setSujo(false);
      setNota("");
    }
    setSalvando(false);
  }, [nota, onSalvar]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {erro ? <Erro>{erro}</Erro> : null}

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
            outline: "none",
          }}
          value={nota}
        />
        {/* Só habilita com alteração pendente: salvar sem mudança não cria
            revisão (a action recusa), e o botão vivo prometeria o contrário. */}
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
          gridTemplateColumns: "1fr 300px",
          gap: 0,
          height: 560,
          borderRadius: "var(--r-lg)",
          border: "1px solid var(--hairline)",
          overflow: "hidden",
          background: "var(--surface)",
        }}
      >
        <div
          className="bpmn-estudio"
          ref={canvasRef}
          style={{ height: "100%", minWidth: 0 }}
        />
        <div
          className="scroll bpmn-estudio-painel"
          ref={painelRef}
          style={{
            height: "100%",
            borderLeft: "1px solid var(--hairline)",
            background: "var(--surface-2)",
            overflowY: "auto",
          }}
        />
      </div>

      {carregando ? (
        <p
          style={{
            margin: 0,
            fontSize: "var(--fs-base)",
            color: "var(--ink-faint)",
          }}
        >
          Carregando o modeler…
        </p>
      ) : null}
    </div>
  );
}
