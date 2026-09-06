import { describe, expect, it } from "vitest";
import {
  CONTAS_DO_CAC,
  contasDoGrupo,
  contaValida,
  LINHAS_CUSTO,
  LINHAS_DESPESA,
  LINHAS_RECEITA,
  PLANO_DE_CONTAS,
} from "../lib/empresa/plano-de-contas";

describe("PLANO_DE_CONTAS", () => {
  it("tem as 27 contas de plano-de-contas.md, sem código repetido", () => {
    const codigos = PLANO_DE_CONTAS.map((c) => c.conta);
    expect(codigos).toHaveLength(27);
    expect(new Set(codigos).size).toBe(27);
    expect(contasDoGrupo(2)).toEqual(["2.1", "2.2"]);
  });

  it("valida código conhecido e recusa desconhecido", () => {
    expect(contaValida("1.1")).toBe(true);
    expect(contaValida("6.3")).toBe(true);
    expect(contaValida("7.1")).toBe(false);
    expect(contaValida("")).toBe(false);
  });

  it("as seis contas do CAC são todas do grupo 4 e do centro comercial", () => {
    expect(contasDoGrupo(4)).toEqual([...CONTAS_DO_CAC]);
    for (const c of CONTAS_DO_CAC) {
      const conta = PLANO_DE_CONTAS.find((p) => p.conta === c);
      expect(conta?.centroDeCusto).toBe("comercial");
    }
  });

  it("as linhas do DRE cobrem receita (1), custo (3) e despesa (4–6) sem sobra nem repetição", () => {
    const receita = LINHAS_RECEITA.flatMap((l) => l.contas).sort();
    const custo = LINHAS_CUSTO.flatMap((l) => l.contas).sort();
    const despesa = LINHAS_DESPESA.flatMap((l) => l.contas).sort();
    expect(receita).toEqual(contasDoGrupo(1).sort());
    expect(custo).toEqual(contasDoGrupo(3).sort());
    expect(despesa).toEqual(
      [...contasDoGrupo(4), ...contasDoGrupo(5), ...contasDoGrupo(6)].sort()
    );
  });
});
