import { beforeEach, describe, expect, it, vi } from "vitest";

// X-03 — leitura de gaps ranqueados que o Scaffold consome na "Nova trilha".
//
// O Meridian é dono do gap e da escala de confiança (mapa de fronteiras,
// entidades 5 e 6): esta leitura só projeta. Três invariantes: filtra por
// tenant e ignora gap resolvido, a ordenação é total e determinística, e o
// contrato não carrega dado de respondente.

const h = vi.hoisted(() => ({
  requireModule: vi.fn(),
  gapFindMany: vi.fn(),
}));

vi.mock("@/lib/meridian/guards", () => ({ requireModule: h.requireModule }));
// Permissão real da matriz do Scaffold: o teste de papel recusado não pode
// depender de um mock que aprova tudo.
vi.mock("@/lib/scaffold/guards", async () => {
  const { hasScaffoldPermission } = await import("@repo/rbac");
  return {
    requireScaffoldPermission: (
      permission: Parameters<typeof hasScaffoldPermission>[1],
      c: { scaffoldRole: Parameters<typeof hasScaffoldPermission>[0] }
    ) => {
      if (!hasScaffoldPermission(c.scaffoldRole, permission)) {
        throw new Error(`FORBIDDEN:${permission}`);
      }
    },
  };
});
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({ meridianGap: { findMany: h.gapFindMany } }),
}));

import { rankGaps } from "@/lib/meridian/gap-ranking";
import { listRankedGaps } from "@/lib/meridian/ranked-gaps";

const ctx = {
  userId: "u1",
  tenantId: "t1",
  scaffoldRole: "TRANSFORMATION_LEAD",
} as never;
const ctxComo = (scaffoldRole: string) =>
  ({ userId: "u1", tenantId: "t1", scaffoldRole }) as never;

type Row = Parameters<typeof rankGaps>[0][number];
const row = (over: Partial<Row> & { code: string }): Row => ({
  id: `id-${over.code}`,
  assessmentId: "a1",
  assessmentCode: "AS-001",
  axis: "DATA",
  statement: `Lacuna ${over.code}`,
  severity: "MEDIUM",
  effort: "M",
  costOfDelay: 50,
  confidence: "ESTIMATED",
  state: "OPEN",
  promotion: null,
  ...over,
});

const codes = (rows: Row[]) => rankGaps(rows).map((g) => g.code);

describe("rankGaps — ordem", () => {
  it("custo de atraso maior vem primeiro", () => {
    expect(
      codes([
        row({ code: "G-01", costOfDelay: 20 }),
        row({ code: "G-02", costOfDelay: 90 }),
        row({ code: "G-03", costOfDelay: 55 }),
      ])
    ).toEqual(["G-02", "G-03", "G-01"]);
  });

  it("empate de custo: severidade HIGH > MEDIUM > LOW", () => {
    expect(
      codes([
        row({ code: "G-01", severity: "LOW" }),
        row({ code: "G-02", severity: "HIGH" }),
        row({ code: "G-03", severity: "MEDIUM" }),
      ])
    ).toEqual(["G-02", "G-03", "G-01"]);
  });

  it("empate de severidade: confiança MEASURED > ESTIMATED > DECLARED", () => {
    expect(
      codes([
        row({ code: "G-01", confidence: "DECLARED" }),
        row({ code: "G-02", confidence: "MEASURED" }),
        row({ code: "G-03", confidence: "ESTIMATED" }),
      ])
    ).toEqual(["G-02", "G-03", "G-01"]);
  });

  it("empate de confiança: esforço menor primeiro (S < M < L)", () => {
    expect(
      codes([
        row({ code: "G-01", effort: "L" }),
        row({ code: "G-02", effort: "S" }),
        row({ code: "G-03", effort: "M" }),
      ])
    ).toEqual(["G-02", "G-03", "G-01"]);
  });

  it("empate total: código em ordem natural (G-2 antes de G-10)", () => {
    expect(
      codes([
        row({ code: "G-10" }),
        row({ code: "G-2" }),
        row({ code: "G-100" }),
      ])
    ).toEqual(["G-2", "G-10", "G-100"]);
  });

  it("custo pesa mais que severidade", () => {
    expect(
      codes([
        row({ code: "G-01", costOfDelay: 60, severity: "LOW" }),
        row({ code: "G-02", costOfDelay: 40, severity: "HIGH" }),
      ])
    ).toEqual(["G-01", "G-02"]);
  });

  it("não depende da ordem de entrada", () => {
    const a = row({ code: "G-01", costOfDelay: 70 });
    const b = row({ code: "G-02", costOfDelay: 70, severity: "HIGH" });
    const c = row({ code: "G-03", costOfDelay: 10 });
    expect(codes([a, b, c])).toEqual(codes([c, b, a]));
  });

  it("numera rank a partir de 1 e não muta a entrada", () => {
    const input = [
      row({ code: "G-01", costOfDelay: 10 }),
      row({ code: "G-02", costOfDelay: 20 }),
    ];
    const ranked = rankGaps(input);
    expect(ranked.map((g) => g.rank)).toEqual([1, 2]);
    expect(input.map((g) => g.code)).toEqual(["G-01", "G-02"]);
  });
});

describe("rankGaps — promoção", () => {
  it("sem promoção ativa: promotion nulo", () => {
    expect(rankGaps([row({ code: "G-01" })])[0].promotion).toBeNull();
  });

  it("promoção pendente (sem entidade no destino) não conta como aterrissada", () => {
    const [g] = rankGaps([
      row({
        code: "G-01",
        promotion: {
          id: "p1",
          targetProduct: "SCAFFOLD",
          targetEntityId: null,
        },
      }),
    ]);
    expect(g.promotion).toEqual({
      id: "p1",
      product: "SCAFFOLD",
      landed: false,
    });
  });

  it("promoção com entidade no destino é aterrissada, sem vazar o id da entidade", () => {
    const [g] = rankGaps([
      row({
        code: "G-01",
        promotion: {
          id: "p1",
          targetProduct: "SCAFFOLD",
          targetEntityId: "trk-9",
        },
      }),
    ]);
    expect(g.promotion).toEqual({
      id: "p1",
      product: "SCAFFOLD",
      landed: true,
    });
  });
});

describe("listRankedGaps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.gapFindMany.mockResolvedValue([]);
  });

  it("exige módulo Meridian contratado antes de ler", async () => {
    h.requireModule.mockRejectedValueOnce(new Error("FORBIDDEN"));
    await expect(listRankedGaps(ctx)).rejects.toThrow("FORBIDDEN");
    expect(h.requireModule).toHaveBeenCalledWith("MERIDIAN", ctx);
    expect(h.gapFindMany).not.toHaveBeenCalled();
  });

  it("recusa papel sem track.manage (TEAM_MEMBER) antes de ler", async () => {
    await expect(listRankedGaps(ctxComo("TEAM_MEMBER"))).rejects.toThrow(
      "FORBIDDEN:track.manage"
    );
    expect(h.gapFindMany).not.toHaveBeenCalled();
  });

  it("aceita papel com track.manage", async () => {
    await expect(
      listRankedGaps(ctxComo("TRANSFORMATION_LEAD"))
    ).resolves.toEqual([]);
  });

  it("só lê gap de assessment FINALISED", async () => {
    await listRankedGaps(ctx);
    const args = h.gapFindMany.mock.calls[0][0];
    expect(args.where.assessment).toEqual({ status: "FINALISED" });
  });

  it("DRAFT, COLLECTING e REVIEW ficam fora; só FINALISED volta", async () => {
    const base = {
      assessmentId: "a",
      axis: "DATA",
      severity: "HIGH",
      effort: "S",
      costOfDelay: 50,
      confidence: "MEASURED",
      state: "OPEN",
      promotions: [],
    };
    const dataset = [
      ["G-01", "DRAFT"],
      ["G-02", "COLLECTING"],
      ["G-03", "REVIEW"],
      ["G-04", "FINALISED"],
    ].map(([code, status]) => ({
      ...base,
      id: code,
      code,
      statement: code,
      assessment: { code: "AS-1", status },
    }));
    // Simula o filtro do banco: aplica o `where.assessment.status` recebido.
    h.gapFindMany.mockImplementationOnce(
      async (args: { where: { assessment: { status: string } } }) =>
        dataset.filter(
          (r) => r.assessment.status === args.where.assessment.status
        )
    );
    const out = await listRankedGaps(ctx);
    expect(out.map((g) => g.code)).toEqual(["G-04"]);
  });

  it("filtra por tenant e exclui gap resolvido", async () => {
    await listRankedGaps(ctx);
    const args = h.gapFindMany.mock.calls[0][0];
    expect(args.where.tenantId).toBe("t1");
    expect(args.where.state).toEqual({ not: "RESOLVED" });
  });

  it("só considera promoção ativa (revokedAt nulo)", async () => {
    await listRankedGaps(ctx);
    const args = h.gapFindMany.mock.calls[0][0];
    expect(args.select.promotions.where).toEqual({ revokedAt: null });
  });

  it("não seleciona respondente, resposta, evidência nem nome da organização", async () => {
    await listRankedGaps(ctx);
    const args = h.gapFindMany.mock.calls[0][0];
    expect(args.include).toBeUndefined();
    expect(Object.keys(args.select.assessment.select).sort()).toEqual(["code"]);
    const selected = JSON.stringify(args.select);
    for (const proibido of [
      "respondent",
      "response",
      "evidence",
      "orgName",
      "ownerLabel",
    ]) {
      expect(selected).not.toContain(proibido);
    }
  });

  it("devolve o contrato tipado, ranqueado", async () => {
    h.gapFindMany.mockResolvedValueOnce([
      {
        id: "g1",
        code: "G-01",
        assessmentId: "a1",
        assessment: { code: "AS-001" },
        axis: "DATA",
        statement: "Dados sem dono",
        severity: "LOW",
        effort: "S",
        costOfDelay: 10,
        confidence: "DECLARED",
        state: "OPEN",
        promotions: [],
      },
      {
        id: "g2",
        code: "G-02",
        assessmentId: "a1",
        assessment: { code: "AS-001" },
        axis: "GOVERNANCE",
        statement: "Sem política de IA",
        severity: "HIGH",
        effort: "M",
        costOfDelay: 80,
        confidence: "MEASURED",
        state: "PROMOTED",
        promotions: [
          { id: "p1", targetProduct: "SCAFFOLD", targetEntityId: null },
        ],
      },
    ]);
    const out = await listRankedGaps(ctx);
    expect(out).toEqual([
      {
        rank: 1,
        id: "g2",
        code: "G-02",
        statement: "Sem política de IA",
        axis: "GOVERNANCE",
        severity: "HIGH",
        effort: "M",
        costOfDelay: 80,
        confidence: "MEASURED",
        state: "PROMOTED",
        assessmentId: "a1",
        assessmentCode: "AS-001",
        promotion: { id: "p1", product: "SCAFFOLD", landed: false },
      },
      {
        rank: 2,
        id: "g1",
        code: "G-01",
        statement: "Dados sem dono",
        axis: "DATA",
        severity: "LOW",
        effort: "S",
        costOfDelay: 10,
        confidence: "DECLARED",
        state: "OPEN",
        assessmentId: "a1",
        assessmentCode: "AS-001",
        promotion: null,
      },
    ]);
  });
});
