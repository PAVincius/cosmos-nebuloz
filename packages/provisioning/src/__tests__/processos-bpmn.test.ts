import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { compilarProcesso, lerProcesso } from "@repo/bpmn";
import { describe, expect, it } from "vitest";
import { DEFINICOES_BPMN_NEBULOZ } from "../processos-bpmn";
import { PROCESSOS_NEBULOZ } from "../processos-nebuloz";

/**
 * Golden: o `.bpmn` versionado é o que o compilador gera hoje, para revisão
 * humana no diff do PR. Mudou a definição ou o compilador → rode
 * `ATUALIZAR_GOLDEN=1 npx vitest run src/__tests__/processos-bpmn.test.ts`
 * em packages/provisioning e revise o diff dos arquivos.
 */
const GOLDEN = path.resolve(__dirname, "../processos-bpmn/golden");
const ATUALIZAR = process.env.ATUALIZAR_GOLDEN === "1";

describe("definições BPMN dos processos da Nebuloz", () => {
  it("são seis, com códigos únicos que existem no mapa de processos", () => {
    const codigos = DEFINICOES_BPMN_NEBULOZ.map((d) => d.codigo);
    expect(codigos).toEqual([
      "PZ-01",
      "PZ-02",
      "PZ-08",
      "PZ-10",
      "PZ-22",
      "PZ-23",
    ]);
    const doMapa = new Set(PROCESSOS_NEBULOZ.map((p) => p.codigo));
    for (const c of codigos) {
      expect(doMapa.has(c), c).toBe(true);
    }
  });

  it("nome da definição é o nome do processo no mapa", () => {
    for (const d of DEFINICOES_BPMN_NEBULOZ) {
      const p = PROCESSOS_NEBULOZ.find((x) => x.codigo === d.codigo);
      expect(d.nome).toBe(p?.nome);
    }
  });

  it.each(
    DEFINICOES_BPMN_NEBULOZ.map((d) => [d.codigo, d] as const)
  )("%s cita fonte e cada tarefa diz a origem", (_codigo, d) => {
    const leitura = lerProcesso(d);
    expect(leitura.ok ? [] : leitura.problemas).toEqual([]);
    expect(d.fonte.length).toBeGreaterThan(0);
    for (const f of d.fonte) {
      const arquivo = path.resolve(__dirname, "../../../..", f.arquivo);
      expect(existsSync(arquivo), f.arquivo).toBe(true);
    }
    for (const n of d.nos.filter((x) => x.tipo.startsWith("tarefa"))) {
      expect(n.origem, `${d.codigo} ${n.id}`).toBeTruthy();
    }
  });

  it.each(
    DEFINICOES_BPMN_NEBULOZ.map((d) => [d.codigo, d] as const)
  )("%s compila e bate com o golden", async (codigo, d) => {
    const xml = await compilarProcesso(d);
    const arquivo = path.join(GOLDEN, `${codigo}.bpmn`);
    if (ATUALIZAR) {
      writeFileSync(arquivo, xml);
    }
    expect(xml).toBe(readFileSync(arquivo, "utf8"));
  });
});
