/// <reference path="./modulos.d.ts" />
import { BpmnModdle, type ElementoModdle } from "bpmn-moddle";
import { checarEstrutura, type Grafo, type NoDoGrafo } from "./estrutura";

export type Validacao = { ok: true } | { ok: false; problemas: string[] };

function tipoDoNo(el: ElementoModdle): NoDoGrafo["tipo"] {
  if (el.$instanceOf("bpmn:StartEvent")) {
    return "inicio";
  }
  if (el.$instanceOf("bpmn:EndEvent")) {
    return "fim";
  }
  if (el.$instanceOf("bpmn:ExclusiveGateway")) {
    return "gateway";
  }
  return "outro";
}

/** Rótulo que conta para a checagem do gateway: nome, expressão de condição
 *  ou ser o fluxo padrão (a barra no desenho já diz "senão"). */
function rotuloDoFluxo(fluxo: ElementoModdle): string | undefined {
  const origem = fluxo.sourceRef as ElementoModdle | undefined;
  if (origem?.default === fluxo) {
    return "padrão";
  }
  const nome = (fluxo.name as string | undefined)?.trim();
  const condicao = (
    fluxo.conditionExpression?.body as string | undefined
  )?.trim();
  return nome || condicao || undefined;
}

/** Grafo de nível superior de um processo. Subprocesso entra como nó comum. */
function grafoDoProcesso(processo: ElementoModdle): Grafo {
  const elementos: ElementoModdle[] = processo.flowElements ?? [];
  const nos: NoDoGrafo[] = elementos
    .filter((el) => el.$instanceOf("bpmn:FlowNode"))
    .map((el) => ({
      id: el.id as string,
      tipo: tipoDoNo(el),
      nome: (el.name as string | undefined) ?? "",
      hospedeiro: el.attachedToRef?.id as string | undefined,
    }));
  const fluxos = elementos
    .filter(
      (el) =>
        el.$instanceOf("bpmn:SequenceFlow") && el.sourceRef && el.targetRef
    )
    .map((el) => ({
      de: el.sourceRef.id as string,
      para: el.targetRef.id as string,
      rotulo: rotuloDoFluxo(el),
    }));
  return { nos, fluxos };
}

async function importar(
  xml: string
): Promise<{ definicoes: ElementoModdle; avisos: string[] } | string> {
  try {
    const { rootElement, warnings } = await new BpmnModdle().fromXML(xml);
    if (!rootElement?.$instanceOf?.("bpmn:Definitions")) {
      return "o texto não é um documento BPMN (falta bpmn:definitions)";
    }
    return {
      definicoes: rootElement,
      avisos: warnings.map((w) => `XML: ${w.message}`),
    };
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e);
    return `o texto não é XML BPMN válido: ${motivo}`;
  }
}

/**
 * Importa no moddle e roda as checagens estruturais em cada processo.
 * Sem bpmnlint de propósito: isto roda no servidor a cada salvamento do
 * editor, e o que barra salvar é estrutura quebrada, não estilo.
 */
export async function validarXmlBpmn(xml: string): Promise<Validacao> {
  const importado = await importar(xml);
  if (typeof importado === "string") {
    return { ok: false, problemas: [importado] };
  }
  const { definicoes, avisos } = importado;

  const processos = (
    (definicoes.rootElements ?? []) as ElementoModdle[]
  ).filter(
    (el) => el.$instanceOf("bpmn:Process") && (el.flowElements?.length ?? 0) > 0
  );
  if (processos.length === 0) {
    return {
      ok: false,
      problemas: [...avisos, "o XML não tem nenhum processo com elementos"],
    };
  }

  const problemas = [...avisos];
  for (const processo of processos) {
    const prefixo = processos.length > 1 ? `processo ${processo.id}: ` : "";
    for (const p of checarEstrutura(grafoDoProcesso(processo))) {
      problemas.push(prefixo + p);
    }
  }
  return problemas.length > 0 ? { ok: false, problemas } : { ok: true };
}
