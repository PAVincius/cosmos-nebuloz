import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  epicFindMany: vi.fn(),
  epicFindFirst: vi.fn(),
  epicUpdate: vi.fn(),
  epicCreate: vi.fn(),
  epicAggregate: vi.fn(),
  tenantFindUnique: vi.fn(),
  themeFindFirst: vi.fn(),
  logAudit: vi.fn(),
  transitionEpicStatus: vi.fn(),
  epicCount: vi.fn(),
  tenantFindFirst: vi.fn(),
  decisionLogCreate: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("next/cache", () => ({
  revalidateTag: h.revalidateTag,
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSession,
  requireRole: h.requireRole,
  AuthError: MockAuthError,
}));
vi.mock("@repo/database", () => ({
  Prisma: {},
  database: {
    epic: {
      findMany: h.epicFindMany,
      findFirst: h.epicFindFirst,
      update: h.epicUpdate,
      create: h.epicCreate,
      aggregate: h.epicAggregate,
      count: h.epicCount,
    },
    decisionLogEntry: { create: h.decisionLogCreate },
    tenant: { findUnique: h.tenantFindUnique, findFirst: h.tenantFindFirst },
    strategicTheme: { findFirst: h.themeFindFirst },
  },
}));
vi.mock("../../app/actions/audit/log-audit", () => ({ logAudit: h.logAudit }));
vi.mock("../../app/actions/epics/transition-status", () => ({
  transitionEpicStatus: h.transitionEpicStatus,
}));

import {
  createEpic,
  listEpics,
  moveEpic,
} from "../../app/(cosmos)/actions/kanban";

const epicRow = {
  id: "ep-1",
  title: "Antifraude",
  lifecycleStatus: "ANALYZING",
  lifecycleOrder: 0,
  wsjf: 19.6,
  sizePoints: 55,
  hot: true,
  ownerName: "Letícia",
  artId: "data",
  artTone: "amber",
  featureCount: 100,
  doneFeatureCount: 6,
  strategicTheme: { title: "Confiança & Risco" },
};

beforeEach(() => {
  vi.clearAllMocks();
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
  // listEpics fingerprints the tenant's epic rows to build its cache key.
  h.epicAggregate.mockResolvedValue({
    _count: { _all: 1 },
    _max: { updatedAt: new Date("2026-01-01T00:00:00.000Z") },
  });
  // Tenant sem config salva ⇒ DEFAULT_PORTFOLIO_COLUMNS. Coluna vazia por
  // padrão, para o gate de WIP não interferir nos testes que não são sobre ele.
  h.tenantFindFirst.mockResolvedValue({ metadata: null });
  h.epicCount.mockResolvedValue(0);
});

describe("listEpics", () => {
  it("scopes the query to the caller tenant and maps the DTO", async () => {
    h.epicFindMany.mockResolvedValue([epicRow]);
    const res = await listEpics();
    expect(res.ok).toBe(true);
    expect(h.epicFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenantCtx.tenantId }),
      })
    );
    if (res.ok) {
      expect(res.data[0]).toMatchObject({
        id: "ep-1",
        column: "analyzing",
        theme: "Confiança & Risco",
        wsjf: 19.6,
        size: 55,
        artTone: "amber",
        owner: "Letícia",
        progress: 6,
        hot: true,
      });
    }
  });
});

// story-061 — o limite de WIP é a regra central do Portfolio Kanban no SAFe:
// coluna cheia significa parar de puxar, não puxar mais devagar. A config e a
// checagem existiam em app/actions/portfolio-kanban sem nenhum chamador, e o
// board do Cosmos movia épico sem olhar limite algum.
describe("moveEpic — limite de WIP", () => {
  // DEFAULT_PORTFOLIO_COLUMNS dá wipLimit 5 a PORTFOLIO_BACKLOG.
  const colunaCheia = () => {
    h.epicFindFirst.mockResolvedValue({
      id: "ep-1",
      lifecycleStatus: "ANALYZING",
    });
    h.epicCount.mockResolvedValue(5);
  };

  it("bloqueia quem não pode estourar o limite", async () => {
    colunaCheia();
    h.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "DEV" });

    const res = await moveEpic({ id: "ep-1", column: "backlog", order: 0 });

    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error).toContain("WIP_LIMIT_EXCEEDED");
    // A máquina de estados nem chega a ser consultada: o limite é anterior.
    expect(h.transitionEpicStatus).not.toHaveBeenCalled();
  });

  it("exige justificativa de quem pode estourar", async () => {
    colunaCheia();
    h.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "RTE" });

    const res = await moveEpic({ id: "ep-1", column: "backlog", order: 0 });

    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error).toContain("WIP_OVERRIDE_REASON_REQUIRED");
    expect(h.transitionEpicStatus).not.toHaveBeenCalled();
  });

  it("deixa passar com justificativa e registra no Decision Log", async () => {
    colunaCheia();
    h.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "RTE" });
    h.transitionEpicStatus.mockResolvedValue({
      ok: true,
      data: {
        epicId: "ep-1",
        fromStatus: "ANALYZING",
        toStatus: "PORTFOLIO_BACKLOG",
      },
    });
    h.epicUpdate.mockResolvedValue({ id: "ep-1" });
    h.decisionLogCreate.mockResolvedValue({ id: "dl-1" });

    const res = await moveEpic({
      id: "ep-1",
      column: "backlog",
      order: 0,
      wipOverrideReason: "Épico regulatório com prazo legal em 30 dias",
    });

    expect(res.ok).toBe(true);
    // Estourar WIP sem deixar rastro é o mesmo que não ter limite: o registro
    // é o que permite a retrospectiva perguntar por que a coluna encheu.
    expect(h.decisionLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          decisao: "wip_override",
          justificativa: "Épico regulatório com prazo legal em 30 dias",
        }),
      })
    );
    expect(h.transitionEpicStatus).toHaveBeenCalled();
  });

  it("não checa WIP ao reordenar dentro da mesma coluna", async () => {
    h.epicFindFirst.mockResolvedValue({
      id: "ep-1",
      lifecycleStatus: "PORTFOLIO_BACKLOG",
    });
    h.epicCount.mockResolvedValue(99);
    h.epicUpdate.mockResolvedValue({ id: "ep-1" });

    const res = await moveEpic({ id: "ep-1", column: "backlog", order: 2 });

    expect(res.ok).toBe(true);
    expect(h.decisionLogCreate).not.toHaveBeenCalled();
  });

  it("coluna sem limite configurado não bloqueia", async () => {
    h.epicFindFirst.mockResolvedValue({
      id: "ep-1",
      lifecycleStatus: "IMPLEMENTING",
    });
    // Config salva zerando o limite de DONE.
    h.tenantFindFirst.mockResolvedValue({
      metadata: {
        portfolioKanban: {
          columns: [{ id: "DONE", label: "Done", color: "#10b981" }],
        },
      },
    });
    h.epicCount.mockResolvedValue(999);
    h.transitionEpicStatus.mockResolvedValue({
      ok: true,
      data: { epicId: "ep-1", fromStatus: "IMPLEMENTING", toStatus: "DONE" },
    });
    h.epicUpdate.mockResolvedValue({ id: "ep-1" });

    const res = await moveEpic({ id: "ep-1", column: "done", order: 0 });

    expect(res.ok).toBe(true);
    expect(h.decisionLogCreate).not.toHaveBeenCalled();
  });
});

describe("moveEpic", () => {
  it("is denied when the role is not permitted (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });
    const res = await moveEpic({ id: "ep-1", column: "done", order: 0 });
    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(
      ["ADMIN", "RTE", "PO"],
      tenantCtx
    );
    expect(h.epicUpdate).not.toHaveBeenCalled();
  });

  it("rejects a cross-tenant epic id (tenant isolation)", async () => {
    h.epicFindFirst.mockResolvedValue(null); // id not found within tenant scope
    const res = await moveEpic({
      id: "other-tenant-epic",
      column: "done",
      order: 0,
    });
    expect(res.ok).toBe(false);
    expect(h.epicFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "other-tenant-epic",
          tenantId: tenantCtx.tenantId,
        }),
      })
    );
    expect(h.epicUpdate).not.toHaveBeenCalled();
  });

  it("routes a column change through the lifecycle machine, audits, and revalidates", async () => {
    h.epicFindFirst.mockResolvedValue({
      id: "ep-1",
      lifecycleStatus: "ANALYZING",
    });
    h.transitionEpicStatus.mockResolvedValue({
      ok: true,
      data: {
        epicId: "ep-1",
        fromStatus: "ANALYZING",
        toStatus: "PORTFOLIO_BACKLOG",
      },
    });
    h.epicUpdate.mockResolvedValue({ id: "ep-1" });

    const res = await moveEpic({ id: "ep-1", column: "backlog", order: 3 });

    expect(res.ok).toBe(true);
    expect(h.transitionEpicStatus).toHaveBeenCalledWith({
      epicId: "ep-1",
      event: "MOVE_TO_BACKLOG",
    });
    // o board só persiste a posição — o status é da máquina
    expect(h.epicUpdate).toHaveBeenCalledWith({
      where: { id: "ep-1" },
      data: { lifecycleOrder: 3 },
    });
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "status_changed",
        entityType: "epic",
        entityId: "ep-1",
      })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
  });

  it("propagates a lifecycle machine rejection instead of writing the status", async () => {
    h.epicFindFirst.mockResolvedValue({
      id: "ep-1",
      lifecycleStatus: "ANALYZING",
    });
    h.transitionEpicStatus.mockResolvedValue({
      ok: false,
      error: "GUARD_FAILED",
    });

    const res = await moveEpic({
      id: "ep-1",
      column: "implementing",
      order: 0,
    });

    expect(res.ok).toBe(false);
    expect(h.epicUpdate).not.toHaveBeenCalled();
  });

  it("refuses to drag a card back to the funnel", async () => {
    h.epicFindFirst.mockResolvedValue({
      id: "ep-1",
      lifecycleStatus: "ANALYZING",
    });

    const res = await moveEpic({ id: "ep-1", column: "funnel", order: 0 });

    expect(res.ok).toBe(false);
    expect(h.transitionEpicStatus).not.toHaveBeenCalled();
    expect(h.epicUpdate).not.toHaveBeenCalled();
  });

  it("reorders within the same column without touching the lifecycle", async () => {
    h.epicFindFirst.mockResolvedValue({
      id: "ep-1",
      lifecycleStatus: "ANALYZING",
    });
    h.epicUpdate.mockResolvedValue({ id: "ep-1" });

    const res = await moveEpic({ id: "ep-1", column: "analyzing", order: 5 });

    expect(res.ok).toBe(true);
    expect(h.transitionEpicStatus).not.toHaveBeenCalled();
    expect(h.epicUpdate).toHaveBeenCalledWith({
      where: { id: "ep-1" },
      data: { lifecycleOrder: 5 },
    });
  });
});

describe("createEpic", () => {
  it("rejects a strategicThemeId that is not owned by the tenant (IDOR guard)", async () => {
    h.themeFindFirst.mockResolvedValue(null); // theme not in tenant
    const res = await createEpic({
      title: "X",
      column: "funnel",
      strategicThemeId: "foreign-theme",
    });
    expect(res.ok).toBe(false);
    expect(h.epicCreate).not.toHaveBeenCalled();
  });

  it("creates, audits, and returns the id on success", async () => {
    h.epicCreate.mockResolvedValue({ id: "new-ep" });
    const res = await createEpic({ title: "Novo", column: "funnel" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.id).toBe("new-ep");
    expect(h.epicCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          title: "Novo",
          lifecycleStatus: "FUNNEL",
        }),
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "created",
        entityType: "epic",
        entityId: "new-ep",
      })
    );
  });

  it("title-only create leaves hypothesis and wsjf null (regression guard)", async () => {
    h.epicCreate.mockResolvedValue({ id: "new-ep" });
    const res = await createEpic({ title: "Só título", column: "funnel" });
    expect(res.ok).toBe(true);
    expect(h.epicCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Só título",
          hypothesis: null,
          wsjf: null,
        }),
      })
    );
  });

  it("persists hypothesis and the server-computed, correctly-rounded wsjf", async () => {
    h.epicCreate.mockResolvedValue({ id: "new-ep" });
    const res = await createEpic({
      title: "Com WSJF",
      column: "funnel",
      hypothesis: "Se fizermos X, esperamos Y.",
      bv: 8,
      tc: 5,
      rr: 3,
      js: 3,
    });
    expect(res.ok).toBe(true);
    // (8+5+3)/3 = 5.333... → Math.round(x*100)/100 = 5.33
    expect(h.epicCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          hypothesis: "Se fizermos X, esperamos Y.",
          wsjf: 5.33,
        }),
      })
    );
  });

  it("ignores a client-supplied score field — wsjf always comes from the server computation", async () => {
    h.epicCreate.mockResolvedValue({ id: "new-ep" });
    const res = await createEpic({
      title: "Score forjado",
      column: "funnel",
      bv: 1,
      tc: 1,
      rr: 1,
      js: 1,
      wsjf: 999,
    } as Parameters<typeof createEpic>[0] & { wsjf: number });
    expect(res.ok).toBe(true);
    expect(h.epicCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ wsjf: 3 }), // (1+1+1)/1 = 3, never 999
      })
    );
  });

  it("leaves wsjf null when only some of bv/tc/rr/js are provided (no partial score)", async () => {
    h.epicCreate.mockResolvedValue({ id: "new-ep" });
    const res = await createEpic({
      title: "Parcial",
      column: "funnel",
      bv: 8,
      tc: 5,
    });
    expect(res.ok).toBe(true);
    expect(h.epicCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ wsjf: null }),
      })
    );
  });

  it("rejects out-of-range bv (>10)", async () => {
    const res = await createEpic({
      title: "BV inválido",
      column: "funnel",
      bv: 11,
      tc: 5,
      rr: 5,
      js: 5,
    });
    expect(res.ok).toBe(false);
    expect(h.epicCreate).not.toHaveBeenCalled();
  });

  it("rejects out-of-range js (0 — job size is a divisor, min is 1)", async () => {
    const res = await createEpic({
      title: "JS inválido",
      column: "funnel",
      bv: 5,
      tc: 5,
      rr: 5,
      js: 0,
    });
    expect(res.ok).toBe(false);
    expect(h.epicCreate).not.toHaveBeenCalled();
  });
});
