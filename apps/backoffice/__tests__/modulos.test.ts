import { describe, expect, it, vi } from "vitest";

// A lista de módulos já foi repetida à mão em cinco lugares deste app, e o
// custo apareceu duas vezes como build de produção quebrado e uma vez como
// tela silenciosamente desatualizada: o Meridian entrou no enum e não apareceu
// em /clientes/novo, porque aquela tela tinha a própria cópia de três itens.
//
// Nenhum teste pegava isso — uma cópia desatualizada é sintaticamente perfeita.
// Estes prendem a lista ao enum, que é a única definição que manda.
//
// O mock aponta para o client gerado em vez do índice de `@repo/database`:
// aquele valida variável de ambiente no import e derruba o teste. O enum
// comparado continua sendo o real, gerado do schema — trocá-lo por uma cópia
// no mock tornaria o teste tautológico, provando só que `Object.values` existe.
vi.mock("server-only", () => ({}));
vi.mock("@repo/database", async () => ({
  $Enums: (
    await vi.importActual<
      typeof import("../../../packages/database/generated/client.js")
    >("../../../packages/database/generated/client.js")
  ).$Enums,
}));

const { MODULOS_DA_PLATAFORMA } = await import("@/lib/modulos");
const { $Enums } = await import("@repo/database");

describe("MODULOS_DA_PLATAFORMA", () => {
  it("cobre todo valor do enum, sem faltar nenhum", () => {
    expect([...MODULOS_DA_PLATAFORMA].sort()).toEqual(
      Object.values($Enums.ProductModule).sort()
    );
  });

  it("inclui o Meridian — o caso que motivou o arquivo", () => {
    expect(MODULOS_DA_PLATAFORMA).toContain("MERIDIAN");
  });

  it("preserva a ordem de declaração do enum", () => {
    // A ordem é a de nascimento dos módulos, e é o que a tela exibe. Ordenar
    // por outro critério aqui mudaria a UI sem ninguém pedir.
    expect(MODULOS_DA_PLATAFORMA).toEqual(Object.values($Enums.ProductModule));
  });

  it("não tem duplicata", () => {
    expect(new Set(MODULOS_DA_PLATAFORMA).size).toBe(
      MODULOS_DA_PLATAFORMA.length
    );
  });
});
