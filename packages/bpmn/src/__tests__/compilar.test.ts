import { BpmnModdle } from "bpmn-moddle";
import { describe, expect, it } from "vitest";
import { compilarProcesso, ErroDeCompilacao } from "../compilar";
import type { ProcessoBpmnEntrada } from "../esquema";
import { lintarBpmn, regrasFaltando } from "../lint";
import { validarXmlBpmn } from "../validar";
import { processoMinimo } from "./fixture";

type Caixa = { x: number; y: number; width: number; height: number };

async function caixas(xml: string): Promise<Map<string, Caixa>> {
  const { rootElement } = await new BpmnModdle().fromXML(xml);
  const mapa = new Map<string, Caixa>();
  for (const el of rootElement.diagrams[0].plane.planeElement) {
    if (el.$type === "bpmndi:BPMNShape") {
      mapa.set(el.bpmnElement.id, el.bounds);
    }
  }
  return mapa;
}

function dentro(a: Caixa, b: Caixa): boolean {
  return (
    a.x >= b.x &&
    a.y >= b.y &&
    a.x + a.width <= b.x + b.width &&
    a.y + a.height <= b.y + b.height
  );
}

describe("compilarProcesso", () => {
  it("gera XML que importa no moddle, passa nas checagens e no bpmnlint", async () => {
    const xml = await compilarProcesso(processoMinimo());
    expect(await validarXmlBpmn(xml)).toEqual({ ok: true });
    expect(await lintarBpmn(xml)).toEqual([]);
  });

  it("desenha pool e raias, com cada nó dentro da própria raia", async () => {
    const def = processoMinimo();
    const xml = await compilarProcesso(def);
    expect(xml).toContain('<bpmn:participant id="Pool_PZ99" name="Nebuloz"');
    const mapa = await caixas(xml);
    const pool = mapa.get("Pool_PZ99") as Caixa;
    for (const raia of def.raias) {
      expect(dentro(mapa.get(raia.id) as Caixa, pool)).toBe(true);
    }
    for (const no of def.nos) {
      expect(dentro(mapa.get(no.id) as Caixa, mapa.get(no.raia) as Caixa)).toBe(
        true
      );
    }
  });

  it("não sobrepõe nós", async () => {
    const def = processoMinimo();
    const mapa = await caixas(await compilarProcesso(def));
    const ids = def.nos.map((n) => n.id);
    for (const a of ids) {
      for (const b of ids) {
        if (a >= b) {
          continue;
        }
        const ca = mapa.get(a) as Caixa;
        const cb = mapa.get(b) as Caixa;
        const cruza =
          ca.x < cb.x + cb.width &&
          cb.x < ca.x + ca.width &&
          ca.y < cb.y + cb.height &&
          cb.y < ca.y + ca.height;
        expect(cruza, `${a} × ${b}`).toBe(false);
      }
    }
  });

  it("condição vira expressão e rótulo do fluxo; origem vira documentação", async () => {
    const xml = await compilarProcesso(processoMinimo());
    expect(xml).toMatch(
      /<bpmn:sequenceFlow id="Fluxo_Decisao_Gravar" name="sim"[^>]*>\s*<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">sim<\/bpmn:conditionExpression>/
    );
    expect(xml).toContain("Origem: docs/teste.md §1");
    expect(xml).toContain("Fonte: docs/teste.md — §1");
  });

  it("saídas do mesmo gateway não dividem traçado nem rótulo", async () => {
    const xml = await compilarProcesso(processoMinimo());
    const { rootElement } = await new BpmnModdle().fromXML(xml);
    const arestas = rootElement.diagrams[0].plane.planeElement.filter(
      (el: { bpmnElement: { id: string } }) =>
        el.bpmnElement.id.startsWith("Fluxo_Decisao_")
    );
    expect(arestas).toHaveLength(2);
    const [a, b] = arestas;
    expect(a.waypoint[1]).not.toEqual(b.waypoint[1]);
    expect(a.label.bounds.y).not.toBe(b.label.bounds.y);
  });

  it("o lint cobre todas as regras da config recommended", () => {
    expect(regrasFaltando()).toEqual([]);
  });

  it("é determinístico", async () => {
    const a = await compilarProcesso(processoMinimo());
    const b = await compilarProcesso(processoMinimo());
    expect(a).toBe(b);
  });

  it("recusa definição inválida com a lista de problemas", async () => {
    const def = processoMinimo();
    def.fluxos = def.fluxos.filter((f) => f.para !== "Fim");
    const erro = await compilarProcesso(def).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDeCompilacao);
    expect((erro as ErroDeCompilacao).problemas.join(" ")).toMatch(
      /não chega a um fim/
    );
  });

  it("recusa saída de gateway sem condição", async () => {
    const def = processoMinimo();
    def.fluxos = def.fluxos.map((f) =>
      f.de === "Decisao" && f.para === "Avisar" ? { de: f.de, para: f.para } : f
    );
    await expect(compilarProcesso(def)).rejects.toThrow(/sem rótulo/);
  });

  it("volta para trás (retrabalho) também compila e passa no lint", async () => {
    // A volta entra numa junção explícita: duas entradas direto na tarefa
    // seriam o "fake-join" que o bpmnlint aponta.
    const def = {
      ...processoMinimo(),
      nos: [
        {
          id: "Inicio",
          tipo: "inicio",
          nome: "Pedido chega",
          raia: "Raia_comercial",
        },
        {
          id: "Reentrada",
          tipo: "gatewayExclusivo",
          nome: "",
          raia: "Raia_comercial",
        },
        {
          id: "Analisar",
          tipo: "tarefaUsuario",
          nome: "Analisar",
          raia: "Raia_comercial",
        },
        {
          id: "Decisao",
          tipo: "gatewayExclusivo",
          nome: "Completo?",
          raia: "Raia_comercial",
        },
        {
          id: "Gravar",
          tipo: "tarefaServico",
          nome: "Gravar",
          raia: "Raia_sistema",
        },
        { id: "Fim", tipo: "fim", nome: "Gravado", raia: "Raia_sistema" },
      ],
      fluxos: [
        { de: "Inicio", para: "Reentrada" },
        { de: "Reentrada", para: "Analisar" },
        { de: "Analisar", para: "Decisao" },
        { de: "Decisao", para: "Gravar", condicao: "sim" },
        { de: "Decisao", para: "Reentrada", condicao: "não, completar" },
        { de: "Gravar", para: "Fim" },
      ],
    } satisfies ProcessoBpmnEntrada;
    const xml = await compilarProcesso(def);
    expect(await validarXmlBpmn(xml)).toEqual({ ok: true });
    expect(await lintarBpmn(xml)).toEqual([]);
  });
});
