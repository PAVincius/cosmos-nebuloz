import { beforeEach, describe, expect, it, vi } from "vitest";

// Gap register — FR-023/FR-027/FR-028.
//
// Três invariantes: ciclo é recusado na escrita (e a mensagem nomeia o ciclo),
// gap promovido não é apagado, e promover não transfere posse — o estado muda,
// o registro continua aqui.

const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  assessmentFindFirst: vi.fn(),
  gapFindMany: vi.fn(),
  gapFindFirst: vi.fn(),
  gapCreate: vi.fn(),
  gapUpdate: vi.fn(),
  gapDelete: vi.fn(),
  depFindMany: vi.fn(),
  depCreate: vi.fn(),
  depDeleteMany: vi.fn(),
  promotionFindFirst: vi.fn(),
  promotionCreate: vi.fn(),
  promotionUpdate: vi.fn(),
  scaffoldTrackFindFirst: vi.fn(),
  planItemFindFirst: vi.fn(),
  sequenceUpsert: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/meridian/guards", () => ({
  requireMeridianPermissionContext: h.requirePerm,
  requireMeridianContext: h.requirePerm,
  MeridianRuleError: class extends Error {
    rule: string;
    status = 422;
    constructor(rule: string, message: string) {
      super(message);
      this.rule = rule;
    }
  },
  StateConflictError: class extends Error {
    rule: string;
    status = 409;
    blockers: string[];
    constructor(rule: string, message: string, blockers: string[] = []) {
      super(message);
      this.rule = rule;
      this.blockers = blockers;
    }
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      meridianAssessment: { findFirst: h.assessmentFindFirst },
      meridianGap: {
        findMany: h.gapFindMany,
        findFirst: h.gapFindFirst,
        create: h.gapCreate,
        update: h.gapUpdate,
        delete: h.gapDelete,
      },
      meridianGapDependency: {
        findMany: h.depFindMany,
        create: h.depCreate,
        deleteMany: h.depDeleteMany,
      },
      meridianGapPromotion: {
        findFirst: h.promotionFindFirst,
        create: h.promotionCreate,
        update: h.promotionUpdate,
      },
      scaffoldTrack: { findFirst: h.scaffoldTrackFindFirst },
      meridianPlanItem: { findFirst: h.planItemFindFirst },
      meridianSequence: { upsert: h.sequenceUpsert },
      auditLog: { create: h.auditCreate },
    }),
}));

import {
  deleteGap,
  linkGapDependency,
  promoteGap,
  revokePromotion,
  unlinkGapDependency,
} from "@/app/(meridian)/actions/gaps";

const CTX = {
  tenantId: "t1",
  userId: "u1",
  role: "ADMIN",
  meridianRole: "CONSULTANT",
  user: { name: "Marina", email: "m@x.com" },
};

const G1 = "clx000000000000000000g001";
const G2 = "clx000000000000000000g002";
const P1 = "clx000000000000000000p001";

beforeEach(() => {
  vi.clearAllMocks();
  // Assessment aberto para decisões (D-29): a trava de FINALISED não dispara.
  h.assessmentFindFirst.mockResolvedValue({ status: "REVIEW" });
  h.requirePerm.mockResolvedValue(CTX);
  h.gapFindMany.mockResolvedValue([
    { id: G1, code: "G-01" },
    { id: G2, code: "G-02" },
  ]);
  h.depFindMany.mockResolvedValue([]);
  h.depCreate.mockResolvedValue({});
  h.depDeleteMany.mockResolvedValue({ count: 1 });
  h.auditCreate.mockResolvedValue({});
  h.promotionFindFirst.mockResolvedValue(null);
  h.promotionCreate.mockResolvedValue({ id: P1 });
  h.gapUpdate.mockResolvedValue({});
  h.planItemFindFirst.mockResolvedValue(null);
});

describe("linkGapDependency", () => {
  it("aceita aresta que não fecha ciclo", async () => {
    const res = await linkGapDependency({
      gapId: G2,
      dependsOnGapId: G1,
    });
    expect(res.ok).toBe(true);
    expect(h.depCreate).toHaveBeenCalledTimes(1);
  });

  it("recusa auto-dependência", async () => {
    const res = await linkGapDependency({ gapId: G1, dependsOnGapId: G1 });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/si mesmo/i);
    expect(h.depCreate).not.toHaveBeenCalled();
  });

  it("recusa ciclo e nomeia os gaps do ciclo", async () => {
    h.depFindMany.mockResolvedValue([{ gapId: G1, dependsOnGapId: G2 }]);
    const res = await linkGapDependency({ gapId: G2, dependsOnGapId: G1 });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/G-01/);
    expect(res.ok === false && res.error).toMatch(/G-02/);
    expect(h.depCreate).not.toHaveBeenCalled();
  });

  it("recusa quando um dos gaps não é do tenant", async () => {
    h.gapFindMany.mockResolvedValue([{ id: G1, code: "G-01" }]);
    const res = await linkGapDependency({ gapId: G2, dependsOnGapId: G1 });
    expect(res.ok).toBe(false);
    expect(h.depCreate).not.toHaveBeenCalled();
  });
});

describe("deleteGap", () => {
  it("recusa apagar gap com promoção ativa", async () => {
    h.gapFindFirst.mockResolvedValue({
      id: G1,
      code: "G-01",
      state: "PROMOTED",
      promotions: [{ id: P1 }],
    });
    const res = await deleteGap({ id: G1 });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/promovido/i);
    expect(h.gapDelete).not.toHaveBeenCalled();
  });

  it("apaga gap sem promoção e registra a trilha", async () => {
    h.gapFindFirst.mockResolvedValue({
      id: G1,
      code: "G-01",
      state: "OPEN",
      promotions: [],
    });
    h.gapDelete.mockResolvedValue({});
    const res = await deleteGap({ id: G1 });
    expect(res.ok).toBe(true);
    expect(h.gapDelete).toHaveBeenCalledTimes(1);
    expect(h.auditCreate).toHaveBeenCalledTimes(1);
  });
});

describe("promoteGap", () => {
  beforeEach(() => {
    h.gapFindFirst.mockResolvedValue({
      id: G1,
      code: "G-01",
      state: "OPEN",
      statement: "Sem catálogo unificado: fontes fora do lake.",
    });
  });

  it("cria a promoção e move o gap para PROMOTED sem apagar nada", async () => {
    const res = await promoteGap({
      gapId: G1,
      targetProduct: "COSMOS",
      targetLabel: "Catálogo e linhagem",
    });
    expect(res.ok).toBe(true);
    expect(h.gapUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { state: "PROMOTED" } })
    );
    // O update do gap só toca `state`: enunciado, severidade e custo de atraso
    // continuam sendo do Meridian.
    const update = h.gapUpdate.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(Object.keys(update.data)).toEqual(["state"]);
  });

  it("recusa segunda promoção enquanto a primeira estiver ativa", async () => {
    h.promotionFindFirst.mockResolvedValue({ id: P1 });
    const res = await promoteGap({
      gapId: G1,
      targetProduct: "COSMOS",
      targetLabel: "x",
    });
    expect(res.ok).toBe(false);
    expect(h.promotionCreate).not.toHaveBeenCalled();
  });

  it("aceita destino sem entidade — Scaffold ainda não existe no repositório", async () => {
    const res = await promoteGap({
      gapId: G1,
      targetProduct: "SCAFFOLD",
      targetLabel: "Caso de negócio",
    });
    expect(res.ok).toBe(true);
    const created = h.promotionCreate.mock.calls[0]?.[0] as {
      data: { targetEntityId: string | null };
    };
    expect(created.data.targetEntityId).toBeNull();
  });
});

describe("revokePromotion", () => {
  it("devolve o gap a OPEN quando não há item de plano", async () => {
    h.promotionFindFirst.mockResolvedValue({
      id: P1,
      gap: { id: G1, code: "G-01" },
    });
    h.promotionUpdate.mockResolvedValue({});
    const res = await revokePromotion({ promotionId: P1 });
    expect(res.ok).toBe(true);
    expect(h.gapUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { state: "OPEN" } })
    );
  });

  it("devolve o gap a PLANNED quando ele já está no plano", async () => {
    h.promotionFindFirst.mockResolvedValue({
      id: P1,
      gap: { id: G1, code: "G-01" },
    });
    h.promotionUpdate.mockResolvedValue({});
    h.planItemFindFirst.mockResolvedValue({ id: "pi1" });
    await revokePromotion({ promotionId: P1 });
    expect(h.gapUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { state: "PLANNED" } })
    );
  });

  it("marca revokedAt em vez de apagar — a promoção aconteceu", async () => {
    h.promotionFindFirst.mockResolvedValue({
      id: P1,
      gap: { id: G1, code: "G-01" },
    });
    h.promotionUpdate.mockResolvedValue({});
    await revokePromotion({ promotionId: P1 });
    const update = h.promotionUpdate.mock.calls[0]?.[0] as {
      data: { revokedAt: Date };
    };
    expect(update.data.revokedAt).toBeInstanceOf(Date);
  });

  // ADR-0014: uma vez que o back-office materializa a promoção num
  // Engagement, apps/app não pode enxergar aquela entidade — mas
  // targetEntityId já mora na própria MeridianGapPromotion, dentro do tenant
  // do cliente, então a checagem não atravessa tenant nenhum.
  it("recusa revogar promoção já materializada em Engagement", async () => {
    h.promotionFindFirst.mockResolvedValue({
      id: P1,
      targetEntityId: "eng-1",
      gap: { id: G1, code: "G-01" },
    });

    const res = await revokePromotion({ promotionId: P1 });

    expect(res.ok).toBe(false);
    expect(h.promotionUpdate).not.toHaveBeenCalled();
    expect(h.gapUpdate).not.toHaveBeenCalled();
  });

  // Scaffold é a exceção, e a razão é a visibilidade: a trilha vive no tenant
  // do cliente, então dá para perguntar se ela ainda está em curso em vez de
  // recusar às cegas como no Engagement.
  it("recusa revogar quando a trilha do Scaffold está em curso", async () => {
    h.promotionFindFirst.mockResolvedValue({
      id: P1,
      targetEntityId: "trk-1",
      targetProduct: "SCAFFOLD",
      gap: { id: G1, code: "G-01" },
    });
    h.scaffoldTrackFindFirst.mockResolvedValue({ code: "TR-104" });

    const res = await revokePromotion({ promotionId: P1 });

    expect(res.ok).toBe(false);
    expect(h.promotionUpdate).not.toHaveBeenCalled();
  });

  it("permite revogar quando a trilha do Scaffold já foi cancelada", async () => {
    h.promotionFindFirst.mockResolvedValue({
      id: P1,
      targetEntityId: "trk-1",
      targetProduct: "SCAFFOLD",
      gap: { id: G1, code: "G-01" },
    });
    // `where` filtra por ACTIVE/STALLED, então trilha cancelada não volta.
    h.scaffoldTrackFindFirst.mockResolvedValue(null);
    h.promotionUpdate.mockResolvedValue({});
    h.planItemFindFirst.mockResolvedValue(null);
    h.gapUpdate.mockResolvedValue({});

    const res = await revokePromotion({ promotionId: P1 });

    expect(res.ok).toBe(true);
    expect(h.promotionUpdate).toHaveBeenCalled();
  });
});

// Achado 29c do Lacre: `unlinkGapDependency` apagava a dependência sem trilha,
// enquanto `linkGapDependency` já gravava. Desfazer um vínculo muda a ordem do
// plano; precisa deixar rastro igual ao de criá-lo.
describe("unlinkGapDependency — trilha de auditoria", () => {
  it("grava meridian.gap.unlink com os códigos dos dois gaps", async () => {
    const res = await unlinkGapDependency({ gapId: G1, dependsOnGapId: G2 });
    expect(res.ok).toBe(true);
    expect(h.auditCreate).toHaveBeenCalledTimes(1);
    const audit = h.auditCreate.mock.calls[0]?.[0] as {
      data: {
        action: string;
        entityType: string;
        entityId: string;
        diff: [string, string, string][];
        metadata: { target: string };
      };
    };
    expect(audit.data.action).toBe("meridian.gap.unlink");
    expect(audit.data.entityType).toBe("meridian.gapdependency");
    expect(audit.data.entityId).toBe(G1);
    expect(audit.data.metadata.target).toBe("G-01 deixa de depender de G-02");
    expect(audit.data.diff).toEqual([
      ["Dependência", "G-01 → G-02", "removida"],
    ]);
  });

  it("vínculo que não existia não grava trilha: nada foi escrito", async () => {
    h.depDeleteMany.mockResolvedValue({ count: 0 });
    await unlinkGapDependency({ gapId: G1, dependsOnGapId: G2 });
    expect(h.auditCreate).not.toHaveBeenCalled();
  });
});
