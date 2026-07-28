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
  listDecisions,
} from "../../app/(cosmos)/actions/decisions";

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
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
