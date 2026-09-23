import { describe, expect, it, vi } from "vitest";

// Uma linha realista por model — não [] — para que os formatadores de
// `amostra` (o `.map()` de cada capacidade) executem de verdade. É lá que a
// maioria dos campos referenciados por capabilities.ts aparece; com []
// nenhum `.map()` roda e o teste nunca exercita esse código. O caso de
// `charterAcknowledgment` inclui uma linha com `acknowledgedAt: null` porque
// esse é o único campo opcional lido pelos formatadores (schema: `DateTime?`)
// — é onde um `.toLocaleDateString()` sem guarda quebraria.
const dbStub = {
  charterPolicyVersion: {
    count: vi.fn().mockResolvedValue(3),
    findMany: vi.fn().mockResolvedValue([{ version: "3.2", changeCount: 5 }]),
  },
  charterAcknowledgment: {
    count: vi.fn().mockResolvedValue(37),
    findMany: vi.fn().mockResolvedValue([
      { personName: "Bia", acknowledgedAt: new Date("2026-07-12") },
      { personName: "Caio", acknowledgedAt: null },
    ]),
  },
  charterDecision: {
    count: vi.fn().mockResolvedValue(12),
    findMany: vi.fn().mockResolvedValue([
      {
        outcome: "APPROVED",
        conditions: ["Revisão trimestral"],
        createdAt: new Date("2026-07-01"),
      },
    ]),
  },
  charterVendor: {
    count: vi.fn().mockResolvedValue(8),
    findMany: vi
      .fn()
      .mockResolvedValue([{ name: "Acme Cloud", tier: "APPROVED" }]),
  },
  charterPolicyLink: {
    count: vi.fn().mockResolvedValue(5),
    findMany: vi
      .fn()
      .mockResolvedValue([{ alvoTipo: "USE_CASE", alvoId: "uc-1" }]),
  },
  charterUseCase: {
    count: vi.fn().mockResolvedValue(21),
    findMany: vi
      .fn()
      .mockResolvedValue([{ code: "UC-118", riskPrivacy: 4, probPrivacy: 3 }]),
  },
  auditLog: {
    count: vi.fn().mockResolvedValue(400),
    findMany: vi
      .fn()
      .mockResolvedValue([
        { action: "Exportou pacote", createdAt: new Date("2026-07-20") },
      ]),
  },
};

vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) => fn(dbStub),
}));

import { CAPABILITIES, getCapability } from "@/lib/charter/capabilities";

describe("catálogo de capacidades", () => {
  it("tem id único por entrada", () => {
    const ids = CAPABILITIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("toda capacidade tem rótulo em pt-BR não vazio", () => {
    for (const c of CAPABILITIES) {
      expect(c.label.length).toBeGreaterThan(0);
    }
  });

  // Sozinho, este teste só garante forma: `evidencia()` roda sem lançar e
  // devolve { total: number, amostra: array }. Com linha realista no stub
  // (não []), o `.map()` de cada formatador executa de fato — mas isto não
  // valida nome de coluna contra o banco real, só contra o objeto stub acima.
  // Quem pega campo removido do schema é o `tsc --noEmit`, compilando cada
  // `select`/`.map()` contra o Prisma Client gerado. No CI, o job `typecheck`
  // roda esse `tsc` sem `continue-on-error`, e `build` só roda depois dele
  // passar (`needs:` em ci.yml) — um campo quebrado não chega a um run verde.
  // As duas coisas juntas impedem o produto de alegar ao comprador uma
  // conformidade que não consegue mais provar; rodar só `vitest` não basta.
  it.each(
    CAPABILITIES.map((c) => [c.id, c] as const)
  )("%s consegue buscar a própria evidência", async (_id, cap) => {
    const ev = await cap.evidencia("t-1");
    expect(typeof ev.total).toBe("number");
    expect(Array.isArray(ev.amostra)).toBe(true);
  });

  it("getCapability devolve undefined para id desconhecido, sem lançar", () => {
    expect(getCapability("NAO_EXISTE")).toBeUndefined();
  });

  // Review final — "duas escalas de risco divergentes": nivel()
  // (risk-matrix.ts, 15/9/4, maiúsculas) e riskScore() (rules.ts, 16/9/4) já
  // discordavam entre si; RISK_SCORING usava a primeira, e é a que sai no
  // export para o comprador. O stub tem riskPrivacy 4 × probPrivacy 3 = 12,
  // que nivel() rotularia "ALTO" e scoreLabel()/riskScore() rotula "Elevado".
  it("RISK_SCORING fala o vocabulário de riskScore() (Elevado), não o de nivel() (ALTO)", async () => {
    const cap = getCapability("RISK_SCORING");
    const ev = await cap?.evidencia("t-1");
    expect(ev?.amostra[0]).toContain("Elevado");
    expect(ev?.amostra[0]).not.toMatch(/ALTO|CRITICO|MEDIO|BAIXO/);
  });

  it("RISK_SCORING não promete probabilidade que nenhuma tela ainda captura", () => {
    const cap = CAPABILITIES.find((c) => c.id === "RISK_SCORING");
    expect(cap?.label).not.toMatch(/probabilidade/i);
  });

  // "O modo de falha que importa é o mapa mentir": contar o caso que nasceu
  // com os sete eixos no default 1 como "risco pontuado" é o mapa afirmando
  // uma avaliação que ninguém fez.
  it("RISK_SCORING só conta caso pontuado e nomeia os que faltam", async () => {
    const eixos = (n: number) => ({
      riskPrivacy: n,
      riskRegulatory: n,
      riskSecurity: n,
      riskBias: n,
      riskIp: n,
      riskOperational: n,
      riskReputational: n,
      probPrivacy: 1,
    });
    dbStub.charterUseCase.findMany.mockResolvedValueOnce([
      { code: "UC-001", title: "Triagem", ...eixos(3), riskScoredAt: null },
      { code: "UC-002", title: "Sumarizador", ...eixos(1), riskScoredAt: null },
      {
        code: "UC-003",
        title: "Classificador",
        ...eixos(1),
        riskScoredAt: new Date("2026-09-20"),
      },
    ]);

    const ev = await getCapability("RISK_SCORING")?.evidencia("t-1");

    expect(ev?.total).toBe(2);
    expect(ev?.de).toBe(3);
    expect(ev?.lacunas).toEqual(["UC-002 · Sumarizador"]);
    expect(ev?.amostra.join(" ")).not.toContain("UC-002");
  });

  it("POLICY_LINK reporta cobertura com denominador e nomeia o que falta", async () => {
    // O stub precisa ter caso vinculado E caso solto. Com listas vazias, `de` e
    // `lacunas` nunca são exercitados e o teste passaria sem provar nada — foi
    // esse exatamente o defeito que uma review pegou neste arquivo antes.
    dbStub.charterUseCase.findMany.mockResolvedValueOnce([
      { id: "uc-1", code: "UC-001", title: "Triagem de currículos" },
      { id: "uc-2", code: "UC-002", title: "Sumarizador de reunião" },
    ]);
    dbStub.charterVendor.findMany.mockResolvedValueOnce([
      { id: "v-1", code: "V-001", name: "OpenAI" },
    ]);
    dbStub.charterPolicyLink.findMany.mockResolvedValueOnce([
      { alvoTipo: "USE_CASE", alvoId: "uc-1" },
      { alvoTipo: "VENDOR", alvoId: "v-1" },
    ]);

    const cap = CAPABILITIES.find((c) => c.id === "POLICY_LINK");
    const ev = await cap!.evidencia("t1");

    expect(ev.total).toBe(2);
    expect(ev.de).toBe(3);
    expect(ev.lacunas).toEqual(["USE_CASE · UC-002 Sumarizador de reunião"]);
    expect(ev.href).toBe("/charter/policy");
  });

  it("POLICY_LINK sem nenhum caso nem fornecedor não divide por zero", async () => {
    dbStub.charterUseCase.findMany.mockResolvedValueOnce([]);
    dbStub.charterVendor.findMany.mockResolvedValueOnce([]);
    dbStub.charterPolicyLink.findMany.mockResolvedValueOnce([]);

    const cap = CAPABILITIES.find((c) => c.id === "POLICY_LINK");
    const ev = await cap!.evidencia("t1");

    expect(ev.total).toBe(0);
    expect(ev.de).toBe(0);
    expect(ev.lacunas).toEqual([]);
  });

  it("o rótulo do POLICY_LINK afirma cobertura, não contagem", () => {
    const cap = CAPABILITIES.find((c) => c.id === "POLICY_LINK");
    expect(cap!.label).toBe(
      "Todo caso de uso e fornecedor sob a política publicada"
    );
  });
});
