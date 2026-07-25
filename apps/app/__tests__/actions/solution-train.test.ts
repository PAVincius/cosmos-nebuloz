import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  solutionTrainFindMany: vi.fn(),
  solutionTrainFindFirst: vi.fn(),
  capabilityCreate: vi.fn(),
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
    solutionTrain: {
      findMany: h.solutionTrainFindMany,
      findFirst: h.solutionTrainFindFirst,
    },
    capability: {
      create: h.capabilityCreate,
    },
  },
}));
vi.mock("../../app/actions/audit", () => ({ logAudit: h.logAudit }));

import { database } from "@repo/database";
import {
  createCapability,
  listSolutionTrains,
} from "../../app/(cosmos)/actions/solution-train";

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
});

describe("listSolutionTrains", () => {
  it("returns tenant-scoped solution trains with computed counts and capability details", async () => {
    h.solutionTrainFindMany.mockResolvedValue([
      {
        id: "s1",
        name: "Solution Pagamentos",
        description: null,
        arts: [{ id: "a1" }, { id: "a2" }],
        solutionEpics: [{ id: "e1" }],
        capabilities: [
          {
            id: "c1",
            title: "Checkout unificado",
            status: "IMPLEMENTING",
            milestone: "Marco Q2",
          },
          {
            id: "c2",
            title: "PIX instantâneo",
            status: "BACKLOG",
            milestone: null,
          },
          { id: "c3", title: "Antifraude v2", status: "DONE", milestone: null },
        ],
      },
    ]);

    const r = await listSolutionTrains();
    expect(r.ok).toBe(true);
    expect(database.solutionTrain.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
    if (r.ok) {
      expect(r.data).toHaveLength(1);
      expect(r.data[0]).toEqual({
        id: "s1",
        name: "Solution Pagamentos",
        description: null,
        artCount: 2,
        epicCount: 1,
        capabilityCount: 3,
        capabilities: [
          {
            id: "c1",
            title: "Checkout unificado",
            status: "IMPLEMENTING",
            milestone: "Marco Q2",
          },
          {
            id: "c2",
            title: "PIX instantâneo",
            status: "BACKLOG",
            milestone: null,
          },
          { id: "c3", title: "Antifraude v2", status: "DONE", milestone: null },
        ],
      });
    }
  });
});

describe("createCapability", () => {
  const validInput = {
    title: "Onboarding automatizado",
    description: "Reduz fricção no onboarding de clientes.",
    status: "BACKLOG" as const,
    milestone: "Marco Q2",
    solutionTrainId: "s1",
  };

  it("is denied when the role is not permitted (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await createCapability(validInput);

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN", "STE"], tenantCtx);
    expect(h.capabilityCreate).not.toHaveBeenCalled();
  });

  it("rejects an empty title", async () => {
    const res = await createCapability({ title: "" });
    expect(res.ok).toBe(false);
    expect(h.capabilityCreate).not.toHaveBeenCalled();
  });

  it("rejects a solutionTrainId that is not owned by the tenant (IDOR guard)", async () => {
    h.solutionTrainFindFirst.mockResolvedValue(null);

    const res = await createCapability({
      ...validInput,
      solutionTrainId: "foreign-train",
    });

    expect(res.ok).toBe(false);
    expect(h.solutionTrainFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "foreign-train", tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.capabilityCreate).not.toHaveBeenCalled();
  });

  it("creates without a solutionTrainId (optional relation)", async () => {
    h.capabilityCreate.mockResolvedValue({ id: "new-capability-2" });

    const res = await createCapability({
      title: "Capability sem train",
    });

    expect(res.ok).toBe(true);
    expect(h.solutionTrainFindFirst).not.toHaveBeenCalled();
    expect(h.capabilityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          solutionTrainId: null,
        }),
      })
    );
  });

  it("creates, audits, and revalidates on success, tenant-scoped", async () => {
    h.solutionTrainFindFirst.mockResolvedValue({ id: "s1" });
    h.capabilityCreate.mockResolvedValue({ id: "new-capability" });

    const res = await createCapability(validInput);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.id).toBe("new-capability");
    }
    expect(h.capabilityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          title: validInput.title,
          description: validInput.description,
          status: "BACKLOG",
          milestone: validInput.milestone,
          solutionTrainId: "s1",
        }),
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "created",
        entityType: "capability",
        entityId: "new-capability",
      })
    );
    expect(h.revalidateTag).toHaveBeenCalledWith(
      `solution-train:${tenantCtx.tenantId}`,
      "max"
    );
  });
});
