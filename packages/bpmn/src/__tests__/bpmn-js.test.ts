// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import { compilarProcesso } from "../compilar";
import { abrirNoBpmnJs, prepararSvgDoJsdom } from "../testes/bpmn-js-no-jsdom";
import { processoMinimo } from "./fixture";

beforeAll(() => {
  prepararSvgDoJsdom();
});

describe("o XML gerado abre no bpmn-js", () => {
  it("importXML sem avisos, com pool, raias e todos os nós desenhados", async () => {
    const def = processoMinimo();
    const r = await abrirNoBpmnJs(await compilarProcesso(def));
    expect(r.avisos).toEqual([]);
    for (const id of [
      "Pool_PZ99",
      ...def.raias.map((x) => x.id),
      ...def.nos.map((n) => n.id),
    ]) {
      expect(r.ids).toContain(id);
    }
  });

  it("o harness enxerga aviso quando o XML tem defeito (prova que o teste morde)", async () => {
    const xml = (await compilarProcesso(processoMinimo())).replace(
      'bpmnElement="Analisar"',
      'bpmnElement="NaoExiste"'
    );
    const r = await abrirNoBpmnJs(xml);
    expect(r.avisos.length).toBeGreaterThan(0);
  });
});
