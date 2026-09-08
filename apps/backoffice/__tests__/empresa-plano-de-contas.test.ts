import { describe, expect, it } from "vitest";
import {
  CONTAS_DO_CAC,
  centroDoGrupo,
  contaValida,
  grupoDoCodigo,
} from "../lib/empresa/plano-de-contas";

describe("plano de contas — regras", () => {
  it("valida o formato N.N ou N.NN, não a existência", () => {
    expect(contaValida("1.1")).toBe(true);
    expect(contaValida("4.12")).toBe(true);
    expect(contaValida("10.1")).toBe(false);
    expect(contaValida("1")).toBe(false);
    expect(contaValida("")).toBe(false);
  });
  it("grupo é o primeiro dígito, 1..6", () => {
    expect(grupoDoCodigo("4.7")).toBe(4);
    expect(grupoDoCodigo("7.1")).toBeNull();
  });
  it("centro de custo deriva do grupo", () => {
    expect(centroDoGrupo(1)).toBeNull();
    expect(centroDoGrupo(3)).toBe("entrega");
    expect(centroDoGrupo(4)).toBe("comercial");
    expect(centroDoGrupo(5)).toBe("produto-engenharia");
    expect(centroDoGrupo(6)).toBe("ga");
  });
  it("as seis contas do CAC continuam fixas", () => {
    expect([...CONTAS_DO_CAC]).toEqual([
      "4.1",
      "4.2",
      "4.3",
      "4.4",
      "4.5",
      "4.6",
    ]);
  });
});
