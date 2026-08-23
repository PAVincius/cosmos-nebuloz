import { POLICY_SECTIONS } from "@repo/provisioning/src/charter";
import { describe, expect, it, vi } from "vitest";
// CORPORA mora em regulacao-corpora.ts (não em seed-regulacao.mts) — mesmo
// idioma de import direto usado por licenca-copyright.test.ts.
import { CORPORA } from "../../../../packages/database/scripts/regulacao-corpora";
import {
  montarContextoGeracao,
  SECAO_CATEGORIAS,
} from "../../lib/charter/policy-generation";

describe("SECAO_CATEGORIAS", () => {
  it("cobre toda categoria existente nos corpora — categoria órfã acusa aqui", () => {
    const noMapa = new Set(Object.values(SECAO_CATEGORIAS).flat());
    const nosCorpora = new Set(
      CORPORA.flatMap((c) => c.requisitos.map((r) => r.categoria)).filter(
        (x): x is string => Boolean(x)
      )
    );
    for (const cat of nosCorpora) {
      expect(noMapa, `categoria "${cat}" sem seção`).toContain(cat);
    }
  });

  it("só usa as seções do bootstrap — chaves vêm de POLICY_SECTIONS, não de lista redigitada", () => {
    expect(Object.keys(SECAO_CATEGORIAS).sort()).toEqual(
      POLICY_SECTIONS.map((s) => s.name).sort()
    );
  });

  it("seção nova em POLICY_SECTIONS sem entrada no mapa derruba o import — prova de mutação", async () => {
    vi.resetModules();
    vi.doMock("@repo/provisioning/src/charter", () => ({
      POLICY_SECTIONS: [
        ...POLICY_SECTIONS,
        { ordinal: 10, name: "Seção órfã inventada pelo teste" },
      ],
    }));

    await expect(import("../../lib/charter/policy-generation")).rejects.toThrow(
      /Seção órfã inventada pelo teste/
    );

    vi.doUnmock("@repo/provisioning/src/charter");
    vi.resetModules();
  });
});

describe("montarContextoGeracao", () => {
  it("inclui exigência sem categoria e exclui categoria de outra seção", () => {
    const semCategoria = {
      id: "1",
      codigo: "REG-1",
      citacao: "c1",
      resumo: "r1",
      categoria: null,
      peso: 1,
    };
    const daSecao = {
      id: "2",
      codigo: "SEC-DADOS-1",
      citacao: "c2",
      resumo: "r2",
      categoria: "dados",
      peso: 1,
    };
    const deOutraSecao = {
      id: "3",
      codigo: "SEC-BACKEND-1",
      citacao: "c3",
      resumo: "r3",
      categoria: "backend",
      peso: 1,
    };

    const ctx = montarContextoGeracao({
      secaoNome: "Classificação de dados", // mapeia para ["dados"]
      casos: [],
      fornecedores: [],
      exigencias: [semCategoria, daSecao, deOutraSecao],
    });

    const ids = ctx.grounded.map((g) => g.id);
    expect(ids).toContain("1");
    expect(ids).toContain("2");
    expect(ids).not.toContain("3");
  });

  it("ordena por peso desc com null por último e corta em 30", () => {
    const comPeso = Array.from({ length: 25 }, (_, i) => ({
      id: `p-${i}`,
      codigo: `P-${String(25 - i).padStart(2, "0")}`,
      citacao: "c",
      resumo: "r",
      categoria: null,
      peso: 25 - i,
    }));
    const semPeso = Array.from({ length: 10 }, (_, i) => ({
      id: `n-${i}`,
      codigo: `N-${String(i + 1).padStart(2, "0")}`,
      citacao: "c",
      resumo: "r",
      categoria: null,
      peso: null,
    }));

    const ctx = montarContextoGeracao({
      secaoNome: "Classificação de dados",
      casos: [],
      fornecedores: [],
      // ordem de entrada embaralhada de propósito — quem ordena é a função
      exigencias: [...semPeso, ...comPeso],
    });

    expect(ctx.grounded).toHaveLength(30);
    expect(ctx.grounded[0].codigo).toBe("P-25");
    expect(ctx.grounded[24].codigo).toBe("P-01");
    expect(ctx.grounded[25].codigo).toBe("N-01");
    expect(ctx.grounded[29].codigo).toBe("N-05");
  });

  it("grounded espelha exatamente o que entrou no prompt, na ordem", () => {
    const exigencias = [
      {
        id: "a",
        codigo: "A-1",
        citacao: "cit-a",
        resumo: "res-a",
        categoria: null,
        peso: 2,
      },
      {
        id: "b",
        codigo: "B-1",
        citacao: "cit-b",
        resumo: "res-b",
        categoria: null,
        peso: 5,
      },
    ];

    const ctx = montarContextoGeracao({
      secaoNome: "Classificação de dados",
      casos: [],
      fornecedores: [],
      exigencias,
    });

    // peso desc: B-1 (5) vem antes de A-1 (2)
    expect(ctx.grounded.map((g) => g.codigo)).toEqual(["B-1", "A-1"]);
    const idxB = ctx.prompt.indexOf("B-1");
    const idxA = ctx.prompt.indexOf("A-1");
    expect(idxB).toBeGreaterThan(-1);
    expect(idxA).toBeGreaterThan(-1);
    expect(idxB).toBeLessThan(idxA);
  });

  it("prompt cita caso e fornecedor pelo nome e marca bloco vazio com (nenhum cadastrado)", () => {
    const ctx = montarContextoGeracao({
      secaoNome: "Classificação de dados",
      casos: [
        {
          code: "UC-01",
          title: "Triagem de sinistros",
          department: "Sinistros",
          categoriasAltas: ["Privacidade"],
        },
      ],
      fornecedores: [{ name: "OpenAI", tier: "APPROVED" }],
      exigencias: [],
    });

    expect(ctx.prompt).toContain("UC-01");
    expect(ctx.prompt).toContain("Triagem de sinistros");
    expect(ctx.prompt).toContain("OpenAI");
    // bloco de exigências fica vazio — a IA precisa saber que não há nenhuma
    expect(ctx.prompt).toContain("(nenhum cadastrado)");
  });

  it("system exige não inventar exigência", () => {
    const ctx = montarContextoGeracao({
      secaoNome: "Classificação de dados",
      casos: [],
      fornecedores: [],
      exigencias: [],
    });
    expect(ctx.system).toMatch(/nunca invente|apenas as listadas/i);
  });

  it("sanitiza control chars e corta campos em 200", () => {
    const longo = `${String.fromCharCode(0)}x${String.fromCharCode(7)}${"y".repeat(250)}`;
    const ctx = montarContextoGeracao({
      secaoNome: "Classificação de dados",
      casos: [],
      fornecedores: [],
      exigencias: [
        {
          id: "1",
          codigo: "X-1",
          citacao: "c",
          resumo: longo,
          categoria: null,
          peso: 1,
        },
      ],
    });

    expect(ctx.prompt).not.toContain(String.fromCharCode(0));
    expect(ctx.prompt).not.toContain(String.fromCharCode(7));
    expect(ctx.prompt).toContain("y".repeat(197));
    expect(ctx.prompt).not.toContain("y".repeat(198));
  });
});
