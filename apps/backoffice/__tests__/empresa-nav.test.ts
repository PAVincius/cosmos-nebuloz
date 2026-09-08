// empresa-nav.test.ts — a seção Empresa entra entre Comercial e Ferramentas,
// com as quatro rotas implementadas (sem `pendente`).
import { describe, expect, it } from "vitest";
import { BO_NAV, itemDaRota } from "../components/nav";

describe("seção Empresa", () => {
  it("fica entre Comercial e Ferramentas", () => {
    const secoes = BO_NAV.map((s) => s.section);
    expect(secoes.indexOf("Empresa")).toBe(secoes.indexOf("Comercial") + 1);
    expect(secoes.indexOf("Ferramentas")).toBe(secoes.indexOf("Empresa") + 1);
  });

  it("tem as quatro rotas, nenhuma pendente", () => {
    const empresa = BO_NAV.find((s) => s.section === "Empresa");
    expect(empresa?.items.map((i) => i.href)).toEqual([
      "/empresa/fornecedores",
      "/empresa/consentimento",
      "/empresa/cac",
      "/empresa/financeiro",
    ]);
    for (const href of empresa?.items.map((i) => i.href) ?? []) {
      expect(itemDaRota(href)?.pendente).toBeUndefined();
    }
  });
});
