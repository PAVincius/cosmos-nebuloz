import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  decisionLogEntryFindMany: vi.fn(),
  decisionLogEntryCreate: vi.fn(),
  epicFindFirst: vi.fn(),
  strategicThemeFindFirst: vi.fn(),
  userFindMany: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: h.headers }));
vi.mock("next/cache", () => ({ revalidateTag: h.revalidateTag }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSession,
  requireRole: h.requireRole,
  AuthError: MockAuthError,
}));
vi.mock("@repo/database", () => ({
  database: {
    decisionLogEntry: {
      findMany: h.decisionLogEntryFindMany,
      create: h.decisionLogEntryCreate,
    },
    epic: {
      findFirst: h.epicFindFirst,
    },
    strategicTheme: {
      findFirst: h.strategicThemeFindFirst,
    },
    user: {
      findMany: h.userFindMany,
    },
  },
}));
vi.mock("../../app/actions/audit/log-audit", () => ({ logAudit: h.logAudit }));

import { database } from "@repo/database";
import {
  createDecision,
  exportDecisionLog,
  listDecisions,
} from "../../app/(cosmos)/actions/decisions";

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
});

// ── AC-001 — leitura restrita ─────────────────────────────────────────────
describe("listDecisions — leitura restrita", () => {
  it("nega a leitura para papel fora de ADMIN/RTE/STE, sem tocar no banco", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await listDecisions();

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(
      ["ADMIN", "RTE", "STE"],
      tenantCtx
    );
    expect(h.decisionLogEntryFindMany).not.toHaveBeenCalled();
  });
});

// ── AC-002 — superfície append-only ───────────────────────────────────────
describe("superfície do módulo de Decision Log", () => {
  it("não expõe nenhuma action de atualização ou exclusão de entrada", async () => {
    // import dinâmico: a superfície inteira do módulo é o objeto do teste, e o
    // import de namespace estático é barrado pelo lint do repo.
    const mod = await import("../../app/(cosmos)/actions/decisions");
    const surface = Object.keys(mod).filter(
      (k) => typeof (mod as Record<string, unknown>)[k] === "function"
    );

    expect(surface.sort()).toEqual([
      "createDecision",
      "exportDecisionLog",
      "listDecisions",
    ]);
    for (const name of surface) {
      expect(name).not.toMatch(/update|edit|patch|delete|remove|archive/i);
    }
  });
});

// ── AC-003 / AC-004 — export auditado ─────────────────────────────────────
describe("exportDecisionLog", () => {
  const rows = [
    {
      id: "d1",
      titulo: "Aprovar migração multi-tenant",
      decisao: "approved",
      justificativa: "Reduz dívida técnica crítica",
      tipo: "epic_decision",
      targetType: "epic",
      targetId: "epic-1",
      dataDecisao: new Date("2026-02-10T12:00:00Z"),
      tags: ["tech-debt"],
      decisorId: "user-1",
      dadosSuporte: { budgetInfo: { amount: 500_000 } },
    },
  ];

  it("é negado quando o papel não é permitido (RBAC), sem consultar nem auditar", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await exportDecisionLog();

    expect(res.ok).toBe(false);
    expect(h.decisionLogEntryFindMany).not.toHaveBeenCalled();
    expect(h.logAudit).not.toHaveBeenCalled();
  });

  it("lê tenant-scoped e entrega as entradas em ordem cronológica ascendente", async () => {
    // O leitor reusado devolve do mais recente para o mais antigo; o export
    // inverte, porque trilha de auditoria se lê do começo.
    h.decisionLogEntryFindMany.mockResolvedValue([
      { ...rows[0], id: "nova", dataDecisao: new Date("2026-03-01T00:00:00Z") },
      {
        ...rows[0],
        id: "antiga",
        dataDecisao: new Date("2026-01-01T00:00:00Z"),
      },
    ]);
    h.userFindMany.mockResolvedValue([]);

    const res = await exportDecisionLog();

    expect(h.decisionLogEntryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenantCtx.tenantId }),
      })
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.entries.map((e) => e.id)).toEqual(["antiga", "nova"]);
    }
  });

  it("monta o payload com entradas completas e rodapé de metadados", async () => {
    h.decisionLogEntryFindMany.mockResolvedValue(rows);
    h.userFindMany.mockResolvedValue([{ id: "user-1", name: "Helena Souza" }]);

    const res = await exportDecisionLog();

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.tenantId).toBe(tenantCtx.tenantId);
      expect(res.data.totalEntries).toBe(1);
      expect(res.data.exportedBy.id).toBe(tenantCtx.userId);
      expect(typeof res.data.exportedAt).toBe("string");

      const entry = res.data.entries[0];
      expect(entry.id).toBe("d1");
      expect(entry.decisorId).toBe("user-1");
      expect(entry.decisorName).toBe("Helena Souza");
      expect(entry.justificativa).toBe("Reduz dívida técnica crítica");
      expect(entry.dataDecisao).toBe("2026-02-10T12:00:00.000Z");
      expect(entry.dadosSuporte).toEqual({ budgetInfo: { amount: 500_000 } });
    }
  });

  it("audita o próprio export com ator e total exportado", async () => {
    h.decisionLogEntryFindMany.mockResolvedValue(rows);
    h.userFindMany.mockResolvedValue([]);

    await exportDecisionLog();

    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        userId: tenantCtx.userId,
        entityType: "decision_log_export",
        diff: expect.objectContaining({ totalEntries: "1" }),
      })
    );
  });

  it("não audita export algum quando a leitura falha", async () => {
    h.decisionLogEntryFindMany.mockRejectedValue(new Error("db down"));

    const res = await exportDecisionLog();

    expect(res.ok).toBe(false);
    expect(h.logAudit).not.toHaveBeenCalled();
  });
});

describe("listDecisions", () => {
  it("returns tenant-scoped decisions ordered by most recent", async () => {
    h.decisionLogEntryFindMany.mockResolvedValue([
      {
        id: "d1",
        titulo: "Aprovar migração multi-tenant",
        decisao: "approved",
        justificativa: "Reduz dívida técnica crítica",
        tipo: "epic_decision",
        targetType: "epic",
        dataDecisao: new Date("2026-02-10"),
        tags: ["tech-debt"],
      },
    ]);

    const r = await listDecisions();
    expect(r.ok).toBe(true);
    expect(database.decisionLogEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
        orderBy: { dataDecisao: "desc" },
      })
    );
    if (r.ok) {
      expect(r.data[0].titulo).toBe("Aprovar migração multi-tenant");
      expect(typeof r.data[0].dataDecisao).toBe("string");
      expect(r.data[0].decisorName).toBeNull();
    }
    expect(h.userFindMany).not.toHaveBeenCalled();
  });

  it("resolves the decisor name for decisions that have a decisorId", async () => {
    h.decisionLogEntryFindMany.mockResolvedValue([
      {
        id: "d1",
        titulo: "Aprovar migração multi-tenant",
        decisao: "approved",
        justificativa: "Reduz dívida técnica crítica",
        tipo: "epic_decision",
        targetType: "epic",
        dataDecisao: new Date("2026-02-10"),
        tags: ["tech-debt"],
        decisorId: "user-1",
      },
    ]);
    h.userFindMany.mockResolvedValue([{ id: "user-1", name: "Helena Souza" }]);

    const r = await listDecisions();

    expect(r.ok).toBe(true);
    expect(h.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["user-1"] } } })
    );
    if (r.ok) {
      expect(r.data[0].decisorName).toBe("Helena Souza");
    }
  });
});

describe("createDecision", () => {
  const validInput = {
    tipo: "epic_decision" as const,
    targetType: "epic" as const,
    targetId: "epic-1",
    decisao: "approved" as const,
    justificativa: "Reduz dívida técnica crítica.",
    titulo: "Aprovar migração multi-tenant",
    tags: ["tech-debt"],
  };

  it("is denied when the role is not permitted (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await createDecision(validInput);

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(
      ["ADMIN", "RTE", "STE"],
      tenantCtx
    );
    expect(h.decisionLogEntryCreate).not.toHaveBeenCalled();
  });

  it("rejects an epic targetId that is not owned by the tenant (IDOR guard)", async () => {
    h.epicFindFirst.mockResolvedValue(null);

    const res = await createDecision({
      ...validInput,
      targetType: "epic",
      targetId: "foreign-epic",
    });

    expect(res.ok).toBe(false);
    expect(h.epicFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "foreign-epic", tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.decisionLogEntryCreate).not.toHaveBeenCalled();
  });

  it("rejects a theme targetId that is not owned by the tenant (IDOR guard)", async () => {
    h.strategicThemeFindFirst.mockResolvedValue(null);

    const res = await createDecision({
      ...validInput,
      targetType: "theme",
      targetId: "foreign-theme",
    });

    expect(res.ok).toBe(false);
    expect(h.strategicThemeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "foreign-theme", tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.decisionLogEntryCreate).not.toHaveBeenCalled();
  });

  it("creates, audits, and revalidates on success, setting decisorId from ctx.userId", async () => {
    h.epicFindFirst.mockResolvedValue({ id: "epic-1" });
    h.decisionLogEntryCreate.mockResolvedValue({ id: "new-decision" });

    const res = await createDecision(validInput);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.id).toBe("new-decision");
    }
    expect(h.decisionLogEntryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          tipo: "epic_decision",
          targetType: "epic",
          targetId: "epic-1",
          decisao: "approved",
          justificativa: validInput.justificativa,
          titulo: validInput.titulo,
          tags: validInput.tags,
          decisorId: tenantCtx.userId,
        }),
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "created",
        entityType: "decision",
        entityId: "new-decision",
      })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
  });
});
