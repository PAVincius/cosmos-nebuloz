/// <reference path="./modulos.d.ts" />
import { layoutProcess } from "bpmn-auto-layout";
import { BpmnModdle, type ElementoModdle } from "bpmn-moddle";
import { lerProcesso, type NoDoProcesso, type ProcessoBpmn } from "./esquema";
import { checarEstrutura, type Grafo } from "./estrutura";
import {
  type Caixa,
  type Desenho,
  desenhar,
  idDoFluxo,
  type Posicao,
} from "./layout";
import { lintarBpmn } from "./lint";
import { validarXmlBpmn } from "./validar";

/**
 * JSON do processo → XML BPMN 2.0, sem mão humana no XML.
 *
 * 1. esquema fechado + integridade referencial (`lerProcesso`);
 * 2. checagens estruturais próprias (alcance, fim, gateway rotulado);
 * 3. `bpmn-auto-layout` num processo sem raias, para obter coluna e linha;
 * 4. desenho com pool e raias (`layout.ts`) e serialização pelo bpmn-moddle;
 * 5. o XML gerado passa de novo pelo validador e pelo bpmnlint `recommended`
 *    sem nenhum relato — se não passar, é defeito do compilador, e ele falha
 *    em vez de entregar um diagrama torto.
 */

export class ErroDeCompilacao extends Error {
  readonly problemas: string[];

  constructor(problemas: string[]) {
    super(`Processo inválido:\n- ${problemas.join("\n- ")}`);
    this.name = "ErroDeCompilacao";
    this.problemas = problemas;
  }
}

const TIPO_BPMN: Record<NoDoProcesso["tipo"], string> = {
  inicio: "bpmn:StartEvent",
  fim: "bpmn:EndEvent",
  tarefaUsuario: "bpmn:UserTask",
  tarefaServico: "bpmn:ServiceTask",
  tarefaManual: "bpmn:ManualTask",
  gatewayExclusivo: "bpmn:ExclusiveGateway",
};

const sufixo = (codigo: string) => codigo.replace("-", "");

export function grafoDaDefinicao(p: ProcessoBpmn): Grafo {
  const tipo = (n: NoDoProcesso) => {
    if (n.tipo === "inicio" || n.tipo === "fim") {
      return n.tipo;
    }
    return n.tipo === "gatewayExclusivo" ? "gateway" : "outro";
  };
  return {
    nos: p.nos.map((n) => ({ id: n.id, tipo: tipo(n), nome: n.nome })),
    fluxos: p.fluxos.map((f) => ({
      de: f.de,
      para: f.para,
      rotulo: f.condicao,
    })),
  };
}

/** Nós e fluxos semânticos, com incoming/outgoing preenchidos — o bpmnlint e o
 *  bpmn-js leem essas listas, e o moddle não as deriva sozinho. */
function elementosDoProcesso(moddle: BpmnModdle, p: ProcessoBpmn) {
  const nos = new Map<string, ElementoModdle>();
  for (const n of p.nos) {
    const el = moddle.create(TIPO_BPMN[n.tipo], {
      id: n.id,
      ...(n.nome.trim() ? { name: n.nome.trim() } : {}),
    });
    el.incoming = [];
    el.outgoing = [];
    if (n.origem) {
      el.documentation = [
        moddle.create("bpmn:Documentation", { text: `Origem: ${n.origem}` }),
      ];
    }
    nos.set(n.id, el);
  }
  const fluxos: ElementoModdle[] = p.fluxos.map((f) => {
    const origem = nos.get(f.de) as ElementoModdle;
    const destino = nos.get(f.para) as ElementoModdle;
    const fluxo = moddle.create("bpmn:SequenceFlow", {
      id: idDoFluxo(f.de, f.para),
      ...(f.condicao ? { name: f.condicao } : {}),
      sourceRef: origem,
      targetRef: destino,
    });
    if (f.condicao) {
      fluxo.conditionExpression = moddle.create("bpmn:FormalExpression", {
        body: f.condicao,
      });
    }
    origem.outgoing.push(fluxo);
    destino.incoming.push(fluxo);
    return fluxo;
  });
  return { nos, fluxos };
}

/** Coluna e linha de cada nó, pelo auto-layout do bpmn.io. */
async function grade(p: ProcessoBpmn): Promise<Map<string, Posicao>> {
  const moddle = new BpmnModdle();
  const { nos, fluxos } = elementosDoProcesso(moddle, p);
  const processo = moddle.create("bpmn:Process", {
    id: "Processo",
    isExecutable: false,
    flowElements: [...nos.values(), ...fluxos],
  });
  const definicoes = moddle.create("bpmn:Definitions", {
    id: "Definicoes",
    targetNamespace: "https://nebuloz.ai/processos",
    rootElements: [processo],
  });
  const { xml } = await moddle.toXML(definicoes);
  const { rootElement } = await moddle.fromXML(await layoutProcess(xml));

  const centros = new Map<string, { cx: number; cy: number }>();
  for (const el of rootElement.diagrams[0].plane
    .planeElement as ElementoModdle[]) {
    if (el.$type === "bpmndi:BPMNShape" && nos.has(el.bpmnElement.id)) {
      const b = el.bounds as Caixa;
      centros.set(el.bpmnElement.id, {
        cx: Math.round(b.x + b.width / 2),
        cy: Math.round(b.y + b.height / 2),
      });
    }
  }
  const rank = (valores: number[]) => {
    const ordenados = [...new Set(valores)].sort((a, b) => a - b);
    return (v: number) => ordenados.indexOf(v);
  };
  const coluna = rank([...centros.values()].map((c) => c.cx));
  const linha = rank([...centros.values()].map((c) => c.cy));
  return new Map(
    [...centros].map(([id, c]) => [
      id,
      { coluna: coluna(c.cx), linha: linha(c.cy) },
    ])
  );
}

function documentacaoDoProcesso(p: ProcessoBpmn): string {
  const linhas = [
    `${p.codigo} · ${p.nome}. Gerado de definição JSON por @repo/bpmn — não edite o XML à mão.`,
    ...p.fonte.map((f) => `Fonte: ${f.arquivo} — ${f.secao}`),
    ...p.lacunas.map((l) => `Lacuna: ${l}`),
  ];
  return linhas.join("\n");
}

function forma(
  moddle: BpmnModdle,
  el: ElementoModdle,
  caixa: Caixa,
  extra: Record<string, unknown> = {}
): ElementoModdle {
  return moddle.create("bpmndi:BPMNShape", {
    id: `${el.id}_di`,
    bpmnElement: el,
    bounds: moddle.create("dc:Bounds", { ...caixa }),
    ...extra,
  });
}

function rotulo(moddle: BpmnModdle, caixa: Caixa): ElementoModdle {
  return moddle.create("bpmndi:BPMNLabel", {
    bounds: moddle.create("dc:Bounds", { ...caixa }),
  });
}

async function serializar(p: ProcessoBpmn, d: Desenho): Promise<string> {
  const moddle = new BpmnModdle();
  const s = sufixo(p.codigo);
  const { nos, fluxos } = elementosDoProcesso(moddle, p);

  const raias = p.raias.map((r) =>
    moddle.create("bpmn:Lane", {
      id: r.id,
      name: r.nome,
      flowNodeRef: p.nos
        .filter((n) => n.raia === r.id)
        .map((n) => nos.get(n.id)),
    })
  );
  const processo = moddle.create("bpmn:Process", {
    id: `Processo_${s}`,
    name: p.nome,
    isExecutable: false,
    documentation: [
      moddle.create("bpmn:Documentation", { text: documentacaoDoProcesso(p) }),
    ],
    laneSets: [
      moddle.create("bpmn:LaneSet", { id: `Raias_${s}`, lanes: raias }),
    ],
    flowElements: [...nos.values(), ...fluxos],
  });
  const pool = moddle.create("bpmn:Participant", {
    id: `Pool_${s}`,
    name: p.pool,
    processRef: processo,
  });
  const colaboracao = moddle.create("bpmn:Collaboration", {
    id: `Colaboracao_${s}`,
    participants: [pool],
  });

  const formas: ElementoModdle[] = [
    forma(moddle, pool, d.pool, { isHorizontal: true }),
    ...raias.map((r) =>
      forma(moddle, r, d.raias.get(r.id as string) as Caixa, {
        isHorizontal: true,
      })
    ),
    ...[...nos.values()].map((el) => {
      const caixaDoRotulo = d.rotulosDeNo.get(el.id as string);
      return forma(
        moddle,
        el,
        d.nos.get(el.id as string) as Caixa,
        caixaDoRotulo ? { label: rotulo(moddle, caixaDoRotulo) } : {}
      );
    }),
  ];
  const arestas = fluxos.map((f) => {
    const desenho = d.fluxos.get(f.id as string) as NonNullable<
      ReturnType<Desenho["fluxos"]["get"]>
    >;
    return moddle.create("bpmndi:BPMNEdge", {
      id: `${f.id}_di`,
      bpmnElement: f,
      waypoint: desenho.pontos.map((pt) =>
        moddle.create("dc:Point", { ...pt })
      ),
      ...(desenho.rotulo ? { label: rotulo(moddle, desenho.rotulo) } : {}),
    });
  });

  const definicoes = moddle.create("bpmn:Definitions", {
    id: `Definicoes_${s}`,
    targetNamespace: "https://nebuloz.ai/processos",
    exporter: "@repo/bpmn",
    exporterVersion: "1",
    rootElements: [colaboracao, processo],
    diagrams: [
      moddle.create("bpmndi:BPMNDiagram", {
        id: `Diagrama_${s}`,
        plane: moddle.create("bpmndi:BPMNPlane", {
          id: `Plano_${s}`,
          bpmnElement: colaboracao,
          planeElement: [...formas, ...arestas],
        }),
      }),
    ],
  });
  const { xml } = await moddle.toXML(definicoes, { format: true });
  return `${xml}\n`;
}

/** Compila a definição (JSON já parseado) em XML BPMN 2.0 com layout. */
export async function compilarProcesso(entrada: unknown): Promise<string> {
  const leitura = lerProcesso(entrada);
  if (!leitura.ok) {
    throw new ErroDeCompilacao(leitura.problemas);
  }
  const p = leitura.processo;
  const estrutura = checarEstrutura(grafoDaDefinicao(p));
  if (estrutura.length > 0) {
    throw new ErroDeCompilacao(estrutura);
  }

  const xml = await serializar(p, desenhar(p, await grade(p)));

  const validacao = await validarXmlBpmn(xml);
  const lint = await lintarBpmn(xml);
  const defeitos = [...(validacao.ok ? [] : validacao.problemas), ...lint];
  if (defeitos.length > 0) {
    throw new ErroDeCompilacao(
      defeitos.map((d) => `XML gerado reprovado (defeito do compilador): ${d}`)
    );
  }
  return xml;
}
