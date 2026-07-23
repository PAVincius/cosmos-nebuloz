import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  strategicThemeFindMany: vi.fn(),
  strategicThemeCreate: vi.fn(),
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
    strategicTheme: {
      findMany: h.strategicThemeFindMany,
      create: h.strategicThemeCreate,
    },
  },
}));
vi.mock("../../app/actions/audit", () => ({ logAudit: h.logAudit }));

import { database } from "@repo/database";
import { createTheme, listThemes } from "../../app/(cosmos)/actions/themes";

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
});

describe("listThemes", () => {
  it("returns tenant-scoped themes with computed epic count and avg progress", async () => {
    h.strategicThemeFindMany.mockResolvedValue([
      {
        id: "th1",
        title: "Expansão LATAM",
        description: null,
        color: "#6366f1",
        healthStatus: "on",
        targetAllocationPct: 25,
        horizon: "PI-26",
        epics: [
          { featureCount: 4, doneFeatureCount: 2 },
          { featureCount: 2, doneFeatureCount: 2 },
        ],
      },
    ]);

    const r = await listThemes();
    expect(r.ok).toBe(true);
    expect(database.strategicTheme.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
    if (r.ok) {
      expect(r.data[0].epicCount).toBe(2);
      expect(r.data[0].avgProgress).toBe(75); // (50 + 100) / 2
    }
  });
});

describe("createTheme", () => {
  const validInput = {
    title: "Excelência Operacional",
    description: "Reduzir custo operacional em 15% no ano.",
    budgetTotal: 250_000,
  };

  it("is denied when the role is not permitted (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await createTheme(validInput);

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN", "STE"], tenantCtx);
    expect(h.strategicThemeCreate).not.toHaveBeenCalled();
  });

  it("creates, audits, and revalidates on success", async () => {
    h.strategicThemeCreate.mockResolvedValue({ id: "new-theme" });

    const res = await createTheme(validInput);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.id).toBe("new-theme");
    }
    expect(h.strategicThemeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          title: validInput.title,
          description: validInput.description,
          budgetTotal: validInput.budgetTotal,
        }),
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "created",
        entityType: "theme",
        entityId: "new-theme",
      })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
  });

  it("defaults description/budgetTotal to null when omitted", async () => {
    h.strategicThemeCreate.mockResolvedValue({ id: "new-theme-2" });

    await createTheme({ title: "Tema simples" });

    expect(h.strategicThemeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: null,
          budgetTotal: null,
        }),
      })
    );
  });
});
