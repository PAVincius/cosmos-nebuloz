import { describe, expect, it } from "vitest";
import { FORNECEDORES_DPA, PERGUNTAS_AO_PARECER } from "../empresa-nebuloz";

describe("empresa-nebuloz", () => {
  it("18 fornecedores V-01..V-18, sem repetição, e a contagem do documento", () => {
    expect(FORNECEDORES_DPA.map((f) => f.codigo)).toEqual(
      Array.from(
        { length: 18 },
        (_, i) => `V-${String(i + 1).padStart(2, "0")}`
      )
    );
    const por = (e: string) =>
      FORNECEDORES_DPA.filter((f) => f.estado === e).length;
    expect(por("EMBUTIDO")).toBe(8);
    expect(por("A_ASSINAR")).toBe(6);
    expect(por("SEM_DOCUMENTO")).toBe(4);
    expect(
      FORNECEDORES_DPA.filter((f) => f.bloqueiaVenda).map((f) => f.codigo)
    ).toEqual(["V-03", "V-11", "V-14"]);
    expect(
      FORNECEDORES_DPA.find((f) => f.codigo === "V-07")?.classificacaoProvisoria
    ).toBe(true);
  });

  it("7 perguntas numeradas 1..7 com dono", () => {
    expect(PERGUNTAS_AO_PARECER.map((p) => p.numero)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(
      PERGUNTAS_AO_PARECER.filter((p) => p.donoPapel === "Dono do SLA").map(
        (p) => p.numero
      )
    ).toEqual([5, 6]);
  });
});
