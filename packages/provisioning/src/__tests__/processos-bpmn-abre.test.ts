// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  abrirNoBpmnJs,
  prepararSvgDoJsdom,
} from "@repo/bpmn/src/testes/bpmn-js-no-jsdom";
import { beforeAll, describe, expect, it } from "vitest";
import { DEFINICOES_BPMN_NEBULOZ } from "../processos-bpmn";

const GOLDEN = path.resolve(__dirname, "../processos-bpmn/golden");

beforeAll(() => {
  prepararSvgDoJsdom();
});

describe("os golden .bpmn abrem no bpmn-js", () => {
  it.each(
    DEFINICOES_BPMN_NEBULOZ.map((d) => [d.codigo, d] as const)
  )("%s: importXML sem avisos, todos os nós e raias desenhados", async (codigo, d) => {
    const xml = readFileSync(path.join(GOLDEN, `${codigo}.bpmn`), "utf8");
    const r = await abrirNoBpmnJs(xml);
    expect(r.avisos).toEqual([]);
    for (const id of [...d.raias.map((x) => x.id), ...d.nos.map((n) => n.id)]) {
      expect(r.ids, id).toContain(id);
    }
  });
});
