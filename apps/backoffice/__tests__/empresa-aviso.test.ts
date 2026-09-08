// empresa-aviso.test.ts — marcador sem valor fica visível; nunca se lê vazio.
import { describe, expect, it } from "vitest";
import { AVISOS, camposEmAberto, renderAviso } from "../lib/empresa/aviso";

const VAZIO = { ferramenta: null, prazoRetencao: null, contatoTitular: null };

describe("renderAviso", () => {
  it("substitui os três marcadores quando há valor", () => {
    const r = renderAviso("EXTERNA_PT", {
      ferramenta: "Fireflies",
      prazoRetencao: "12 meses",
      contatoTitular: "privacidade@nebuloz.ai",
    });
    expect(r.texto).toContain("pelo Fireflies");
    expect(r.texto).toContain("por 12 meses");
    expect(r.texto).toContain("para privacidade@nebuloz.ai");
    expect(r.texto).not.toContain("[ferramenta]");
    expect(r.abertos).toEqual([]);
  });

  it("marcador nulo permanece entre colchetes e é listado", () => {
    const r = renderAviso("EXTERNA_PT", { ...VAZIO, ferramenta: "Fireflies" });
    expect(r.texto).toContain("[prazo]");
    expect(r.texto).toContain("[contato]");
    expect(r.abertos).toEqual(["[prazo]", "[contato]"]);
  });

  it("[organização] nunca é substituído — muda por tenant", () => {
    const r = renderAviso("EXTERNA_EN", {
      ferramenta: "Fireflies",
      prazoRetencao: "12 months",
      contatoTitular: "x@y",
    });
    expect(r.texto).toContain("[organização]");
  });

  it("o aviso interno não tem [contato] e por isso não o lista", () => {
    const r = renderAviso("INTERNA_PT", VAZIO);
    expect(r.abertos).toEqual(["[ferramenta]", "[prazo]"]);
  });

  it("a cláusula termina com a frase que impede autorização genérica", () => {
    expect(
      AVISOS.CLAUSULA_PT.texto.trim().endsWith("diversa da aqui descrita.")
    ).toBe(true);
  });
});

describe("camposEmAberto", () => {
  it("conta os nulos e o vazio", () => {
    expect(camposEmAberto(VAZIO)).toEqual([
      "[ferramenta]",
      "[prazo]",
      "[contato]",
    ]);
    expect(camposEmAberto({ ...VAZIO, ferramenta: "  " })).toHaveLength(3);
    expect(
      camposEmAberto({
        ferramenta: "F",
        prazoRetencao: "P",
        contatoTitular: "C",
      })
    ).toEqual([]);
  });
});
