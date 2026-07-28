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
  epicFindMany: vi.fn(),
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
    epic: {
      findMany: h.epicFindMany,
    },
  },
}));
vi.mock("../../app/actions/audit/log-audit", () => ({ logAudit: h.logAudit }));

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
  h.epicFindMany.mockResolvedValue([]);
});

const baseTrain = {
  id: "s1",
  name: "Solution Pagamentos",
  description: null,
  arts: [
    { id: "a1", name: "ART Pagamentos" },
    { id: "a2", name: "ART Antifraude" },
  ],
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
  solutionRisks: [],
  crossArtDeps: [],
};

describe("listSolutionTrains", () => {
  it("returns tenant-scoped solution trains with computed counts and capability details", async () => {
    h.solutionTrainFindMany.mockResolvedValue([baseTrain]);

    const r = await listSolutionTrains();
    expect(r.ok).toBe(true);
    expect(database.solutionTrain.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
    if (r.ok) {
      expect(r.data).toHaveLength(1);
      expect(r.data[0]).toMatchObject({
        id: "s1",
        name: "Solution Pagamentos",
        description: null,
        artCount: 2,
        epicCount: 1,
        capabilityCount: 3,
        capabilities: baseTrain.capabilities,
      });
    }
  });

  it("resolves each ART's epic/feature completion from a single tenant-scoped Epic query (no N+1)", async () => {
    h.solutionTrainFindMany.mockResolvedValue([baseTrain]);
    h.epicFindMany.mockResolvedValue([
      {
        artId: "a1",
        lifecycleStatus: "DONE",
        featureCount: 4,
        doneFeatureCount: 4,
      },
      {
        artId: "a1",
        lifecycleStatus: "IMPLEMENTING",
        featureCount: 3,
        doneFeatureCount: 1,
      },
      {
        artId: "a2",
        lifecycleStatus: "FUNNEL",
        featureCount: 0,
        doneFeatureCount: 0,
      },
    ]);

    const r = await listSolutionTrains();

    expect(h.epicFindMany).toHaveBeenCalledTimes(1);
    expect(h.epicFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId, artId: { in: ["a1", "a2"] } },
      })
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0].arts).toEqual([
        {
          id: "a1",
          name: "ART Pagamentos",
          epicCount: 2,
          epicDoneCount: 1,
          featureCount: 7,
          doneFeatureCount: 5,
        },
        {
          id: "a2",
          name: "ART Antifraude",
          epicCount: 1,
          epicDoneCount: 0,
          featureCount: 0,
          doneFeatureCount: 0,
        },
      ]);
    }
  });

  it("groups solution-level risks by ROAM status, tenant-scoped", async () => {
    h.solutionTrainFindMany.mockResolvedValue([
      {
        ...baseTrain,
        solutionRisks: [
          {
            id: "r1",
            title: "Fornecedor de pagamento instável",
            roamStatus: "OWNED",
            owner: "Maria",
            affectedArtIds: ["a1"],
          },
          {
            id: "r2",
            title: "Licença de antifraude vence no PI",
            roamStatus: "MITIGATED",
            owner: null,
            affectedArtIds: ["a2"],
          },
          {
            id: "r3",
            title: "Auditoria concluída",
            roamStatus: "RESOLVED",
            owner: "Maria",
            affectedArtIds: [],
          },
        ],
      },
    ]);

    const r = await listSolutionTrains();

    expect(database.solutionTrain.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          solutionRisks: expect.objectContaining({
            where: { tenantId: tenantCtx.tenantId },
          }),
        }),
      })
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0].roam.counts).toEqual({
        RESOLVED: 1,
        OWNED: 1,
        ACCEPTED: 0,
        MITIGATED: 1,
      });
      expect(r.data[0].roam.risks).toHaveLength(3);
    }
  });

  it("gives an honest empty ROAM rollup when the solution train has no solution-level risks", async () => {
    h.solutionTrainFindMany.mockResolvedValue([baseTrain]);

    const r = await listSolutionTrains();

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0].roam).toEqual({
        counts: { RESOLVED: 0, OWNED: 0, ACCEPTED: 0, MITIGATED: 0 },
        risks: [],
      });
    }
  });

  it("resolves cross-ART dependency ART names from the train's own ART list, tenant-scoped", async () => {
    h.solutionTrainFindMany.mockResolvedValue([
      {
        ...baseTrain,
        crossArtDeps: [
          {
            id: "dep1",
            sourceArtId: "a1",
            targetArtId: "a2",
            type: "NEEDS",
          },
        ],
      },
    ]);

    const r = await listSolutionTrains();

    expect(database.solutionTrain.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          crossArtDeps: expect.objectContaining({
            where: { tenantId: tenantCtx.tenantId },
          }),
        }),
      })
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0].crossArtDependencies).toEqual([
        {
          id: "dep1",
          sourceArtId: "a1",
          sourceArtName: "ART Pagamentos",
          targetArtId: "a2",
          targetArtName: "ART Antifraude",
          type: "NEEDS",
        },
      ]);
    }
  });

  it("never leaks another tenant's risks/deps/epics into the rollup — every nested query is ctx.tenantId-scoped", async () => {
    h.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      tenantId: "other-tenant",
    });
    h.solutionTrainFindMany.mockResolvedValue([baseTrain]);

    await listSolutionTrains();

    expect(database.solutionTrain.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "other-tenant" } })
    );
    expect(h.epicFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "other-tenant" }),
      })
    );
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
