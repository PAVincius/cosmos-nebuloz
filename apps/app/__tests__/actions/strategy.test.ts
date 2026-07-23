import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  strategyPillarFindMany: vi.fn(),
  strategyPillarCreate: vi.fn(),
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
    strategyPillar: {
      findMany: h.strategyPillarFindMany,
      create: h.strategyPillarCreate,
    },
  },
}));
vi.mock("../../app/actions/audit", () => ({ logAudit: h.logAudit }));

import { database } from "@repo/database";
import {
  createPillar,
  listStrategyPillars,
} from "../../app/(cosmos)/actions/strategy";

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
});

describe("listStrategyPillars", () => {
  it("returns tenant-scoped pillars with nested themes", async () => {
    h.strategyPillarFindMany.mockResolvedValue([
      {
        id: "p1",
        name: "Crescimento",
        tone: "accent",
        themes: [
          {
            id: "th1",
            title: "Expansão LATAM",
            healthStatus: "on",
            targetAllocationPct: 25,
          },
        ],
      },
    ]);

    const r = await listStrategyPillars();
    expect(r.ok).toBe(true);
    expect(database.strategyPillar.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
    if (r.ok) {
      expect(r.data[0].themes[0].title).toBe("Expansão LATAM");
    }
  });
});

describe("createPillar", () => {
  const validInput = {
    name: "Excelência Operacional",
    tone: "blue",
  };

  it("is denied when the role is not permitted (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await createPillar(validInput);

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN", "STE"], tenantCtx);
    expect(h.strategyPillarCreate).not.toHaveBeenCalled();
  });

  it("creates, audits, and revalidates on success", async () => {
    h.strategyPillarCreate.mockResolvedValue({ id: "new-pillar" });

    const res = await createPillar(validInput);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.id).toBe("new-pillar");
    }
    expect(h.strategyPillarCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          name: validInput.name,
          tone: validInput.tone,
        }),
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "created",
        entityType: "pillar",
        entityId: "new-pillar",
      })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
  });

  it("defaults tone to accent when omitted", async () => {
    h.strategyPillarCreate.mockResolvedValue({ id: "new-pillar-2" });

    await createPillar({ name: "Tema simples" });

    expect(h.strategyPillarCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tone: "accent",
        }),
      })
    );
  });
});
