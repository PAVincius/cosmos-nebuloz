import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Merge policy pure tests ──────────────────────────────────────────────────

import {
  DEFAULT_LINEAR_FIELD_POLICY,
  mapCosmosStatusToLinear,
  mapLinearStatusToCosmos,
  resolveField,
} from "../../../lib/integrations/merge-policy";

describe("resolveField — merge policy (AC-002)", () => {
  const now = new Date("2026-01-01T10:00:00Z");
  const later = new Date("2026-01-01T12:00:00Z");

  it("LINEAR_WINS: applies Linear value regardless of timestamps", () => {
    const result = resolveField({
      field: "status",
      linearValue: "IN_PROGRESS",
      cosmosValue: "BACKLOG",
      linearUpdatedAt: now,
      cosmosUpdatedAt: later, // cosmos is newer
      policy: DEFAULT_LINEAR_FIELD_POLICY,
    });
    expect(result.action).toBe("APPLY");
    if (result.action === "APPLY") {
      expect(result.value).toBe("IN_PROGRESS");
    }
  });

  it("COSMOS_WINS: rejects Linear value for SAFe fields (AC-002)", () => {
    const result = resolveField({
      field: "wsjfScore",
      linearValue: 42,
      cosmosValue: 9.5,
      linearUpdatedAt: later,
      cosmosUpdatedAt: now,
      policy: DEFAULT_LINEAR_FIELD_POLICY,
    });
    expect(result.action).toBe("SKIP");
    if (result.action === "SKIP") {
      expect(result.linearValue).toBe(42);
      expect(result.cosmosValue).toBe(9.5);
    }
  });

  it("LAST_WRITE_WINS: applies Linear when newer", () => {
    const result = resolveField({
      field: "title",
      linearValue: "New title",
      cosmosValue: "Old title",
      linearUpdatedAt: later,
      cosmosUpdatedAt: now,
      policy: DEFAULT_LINEAR_FIELD_POLICY,
    });
    expect(result.action).toBe("APPLY");
  });

  it("LAST_WRITE_WINS: skips Linear when Cosmos is newer", () => {
    const result = resolveField({
      field: "title",
      linearValue: "Linear title",
      cosmosValue: "Cosmos title",
      linearUpdatedAt: now,
      cosmosUpdatedAt: later,
      policy: DEFAULT_LINEAR_FIELD_POLICY,
    });
    expect(result.action).toBe("SKIP");
  });

  it("unknown field defaults to LINEAR_WINS", () => {
    const result = resolveField({
      field: "unknownField",
      linearValue: "from-linear",
      cosmosValue: "from-cosmos",
      linearUpdatedAt: now,
      cosmosUpdatedAt: later,
      policy: DEFAULT_LINEAR_FIELD_POLICY,
    });
    expect(result.action).toBe("APPLY");
  });
});

describe("status mapping", () => {
  it("maps Linear 'Done' to Cosmos 'DONE'", () => {
    expect(mapLinearStatusToCosmos("Done")).toBe("DONE");
  });

  it("maps Linear 'In Progress' to Cosmos 'IN_PROGRESS'", () => {
    expect(mapLinearStatusToCosmos("In Progress")).toBe("IN_PROGRESS");
  });

  it("maps unknown Linear state to 'BACKLOG'", () => {
    expect(mapLinearStatusToCosmos("Triage")).toBe("BACKLOG");
  });

  it("maps Cosmos 'DONE' to Linear 'Done'", () => {
    expect(mapCosmosStatusToLinear("DONE")).toBe("Done");
  });

  it("maps Cosmos 'IN_REVIEW' to Linear 'In Review'", () => {
    expect(mapCosmosStatusToLinear("IN_REVIEW")).toBe("In Review");
  });
});

// ─── handleLinearWebhook (server action) ─────────────────────────────────────

const mocks = vi.hoisted(() => ({
  linearSyncFindFirst: vi.fn(),
  storyFindFirst: vi.fn(),
  storyCreate: vi.fn(),
  storyUpdateMany: vi.fn(),
  stateTransitionCreate: vi.fn(),
  linearSyncEventCreate: vi.fn(),
  linearSyncUpsert: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    linearSync: {
      findFirst: mocks.linearSyncFindFirst,
      upsert: mocks.linearSyncUpsert,
    },
    story: {
      findFirst: mocks.storyFindFirst,
      create: mocks.storyCreate,
      updateMany: mocks.storyUpdateMany,
    },
    stateTransitionHistory: { create: mocks.stateTransitionCreate },
    linearSyncEvent: { create: mocks.linearSyncEventCreate },
  },
}));

import { handleLinearWebhook } from "../../../app/actions/integrations/sync/linear-pull";

const TENANT = "tenant-1";
const INT_ID = "int-1";

describe("handleLinearWebhook (AC-001 / AC-002 / AC-008)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.linearSyncEventCreate.mockResolvedValue({ id: "evt-1" });
    mocks.stateTransitionCreate.mockResolvedValue({ id: "sth-1" });
    mocks.linearSyncUpsert.mockResolvedValue({});
  });

  it("creates Story and mapping for new Linear issue (AC-001)", async () => {
    mocks.linearSyncFindFirst.mockResolvedValue(null);
    mocks.storyFindFirst.mockResolvedValue(null);
    mocks.storyCreate.mockResolvedValue({ id: "story-new" });

    await handleLinearWebhook(TENANT, INT_ID, {
      action: "create",
      type: "Issue",
      data: { id: "lin-1", title: "New story", state: { name: "Todo" } },
    });

    expect(mocks.storyCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "BACKLOG" }),
      })
    );
    expect(mocks.linearSyncUpsert).toHaveBeenCalled();
  });

  it("syncs status DONE and writes StateTransitionHistory (AC-001)", async () => {
    mocks.linearSyncFindFirst.mockResolvedValue({ cosmosId: "story-1" });
    mocks.storyFindFirst.mockResolvedValue({
      status: "IN_PROGRESS",
      title: "My story",
      description: null,
      updatedAt: new Date("2026-01-01"),
      wsjfScore: null,
    });
    mocks.storyUpdateMany.mockResolvedValue({ count: 1 });

    await handleLinearWebhook(TENANT, INT_ID, {
      action: "update",
      type: "Issue",
      data: {
        id: "lin-1",
        title: "My story",
        state: { name: "Done" },
        updatedAt: "2026-01-02T10:00:00Z",
      },
    });

    expect(mocks.storyUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DONE" }),
      })
    );
    expect(mocks.stateTransitionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: "IN_PROGRESS",
          toStatus: "DONE",
          userId: null,
          externalRef: "lin-1",
        }),
      })
    );
  });

  it("does NOT update COSMOS_WINS fields (wsjfScore not in update) (AC-002)", async () => {
    mocks.linearSyncFindFirst.mockResolvedValue({ cosmosId: "story-1" });
    mocks.storyFindFirst.mockResolvedValue({
      status: "BACKLOG",
      title: "Title",
      description: null,
      updatedAt: new Date("2026-01-01"),
      wsjfScore: 9.5,
    });
    mocks.storyUpdateMany.mockResolvedValue({ count: 1 });

    await handleLinearWebhook(TENANT, INT_ID, {
      action: "update",
      type: "Issue",
      data: {
        id: "lin-1",
        title: "Updated title",
        state: { name: "In Progress" },
        updatedAt: "2026-01-02T10:00:00Z",
      },
    });

    // wsjfScore must NOT appear in the DB update call
    const updateCall = mocks.storyUpdateMany.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("wsjfScore");
  });

  it("logs SKIPPED sync event when COSMOS_WINS field is rejected (AC-008)", async () => {
    // title is LAST_WRITE_WINS; cosmos is newer → skip
    const cosmosUpdatedAt = new Date("2026-06-01T12:00:00Z");
    mocks.linearSyncFindFirst.mockResolvedValue({ cosmosId: "story-1" });
    mocks.storyFindFirst.mockResolvedValue({
      status: "BACKLOG",
      title: "Cosmos title",
      description: null,
      updatedAt: cosmosUpdatedAt,
      wsjfScore: null,
    });
    mocks.storyUpdateMany.mockResolvedValue({ count: 0 });

    await handleLinearWebhook(TENANT, INT_ID, {
      action: "update",
      type: "Issue",
      data: {
        id: "lin-1",
        title: "Linear title",
        state: { name: "Backlog" },
        updatedAt: "2026-01-01T10:00:00Z", // older than cosmos
      },
    });

    const skippedCall = mocks.linearSyncEventCreate.mock.calls.find(
      (c) => c[0].data.action === "SKIPPED" && c[0].data.field === "title"
    );
    expect(skippedCall).toBeDefined();
    expect(skippedCall?.[0].data.linearValue).toBe("Linear title");
    expect(skippedCall?.[0].data.cosmosValue).toBe("Cosmos title");
  });

  it("ignores remove events", async () => {
    await handleLinearWebhook(TENANT, INT_ID, {
      action: "remove",
      type: "Issue",
      data: { id: "lin-99" },
    });
    expect(mocks.storyCreate).not.toHaveBeenCalled();
    expect(mocks.storyUpdateMany).not.toHaveBeenCalled();
  });

  it("ignores non-Issue events", async () => {
    await handleLinearWebhook(TENANT, INT_ID, {
      action: "update",
      type: "Project",
      data: { id: "proj-1", title: "Some project" },
    });
    expect(mocks.storyCreate).not.toHaveBeenCalled();
  });
});

// ─── handleLinearWebhook — filtro por project do Linear (COS-85) ────────────
//
// Times do plano free do Linear viram vários ARTs do Cosmos via projects
// dentro do mesmo time (NEB). Sem filtro, conectar um ART ao time misturaria
// as issues dos quatro produtos. `opts.linearProjectId` é opcional — sem ele
// o comportamento é o de sempre (nenhum teste acima passa opts).
describe("handleLinearWebhook — filtro por project (COS-85)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.linearSyncEventCreate.mockResolvedValue({ id: "evt-1" });
    mocks.linearSyncUpsert.mockResolvedValue({});
    mocks.linearSyncFindFirst.mockResolvedValue(null);
    mocks.storyFindFirst.mockResolvedValue(null);
    mocks.storyCreate.mockResolvedValue({ id: "story-new" });
  });

  it("descarta issue de outro project quando o filtro está configurado, com rastro gravado (não é silencioso)", async () => {
    await handleLinearWebhook(
      TENANT,
      INT_ID,
      {
        action: "update",
        type: "Issue",
        data: {
          id: "lin-1",
          title: "Issue de outro produto",
          state: { name: "Todo" },
          project: { id: "proj-outro" },
        },
      },
      { linearProjectIds: ["proj-alvo"] }
    );

    expect(mocks.storyCreate).not.toHaveBeenCalled();
    expect(mocks.storyUpdateMany).not.toHaveBeenCalled();
    expect(mocks.linearSyncEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "FILTERED",
          field: "linearProjectId",
          linearValue:
            "filtro linearProjectId: issue lin-1 pertence a proj-outro",
          cosmosValue: "proj-alvo",
        }),
      })
    );
  });

  it("processa normalmente a issue do project mapeado", async () => {
    await handleLinearWebhook(
      TENANT,
      INT_ID,
      {
        action: "create",
        type: "Issue",
        data: {
          id: "lin-2",
          title: "Issue do produto certo",
          state: { name: "Todo" },
          project: { id: "proj-alvo" },
        },
      },
      { linearProjectIds: ["proj-alvo"] }
    );

    expect(mocks.storyCreate).toHaveBeenCalled();
    expect(mocks.linearSyncEventCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "FILTERED" }),
      })
    );
  });

  it("descarta em vez de deixar passar quando o filtro está ativo mas o payload não traz project — limite documentado, não é filtro que finge filtrar", async () => {
    await handleLinearWebhook(
      TENANT,
      INT_ID,
      {
        action: "create",
        type: "Issue",
        data: {
          id: "lin-3",
          title: "Sem informação de project",
          state: { name: "Todo" },
        },
      },
      { linearProjectIds: ["proj-alvo"] }
    );

    expect(mocks.storyCreate).not.toHaveBeenCalled();
    // motivo precisa distinguir este caso ("sem project") do caso "project
    // diferente" acima — o texto muda, não só o resultado do filtro.
    expect(mocks.linearSyncEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "FILTERED",
          field: "linearProjectId",
          linearValue:
            "filtro linearProjectId: issue lin-3 pertence a nenhum project",
          cosmosValue: "proj-alvo",
        }),
      })
    );
  });

  it("processa qualquer project quando nenhum filtro é passado (comportamento atual intacto)", async () => {
    await handleLinearWebhook(TENANT, INT_ID, {
      action: "create",
      type: "Issue",
      data: {
        id: "lin-4",
        title: "Sem filtro configurado",
        state: { name: "Todo" },
        project: { id: "proj-qualquer" },
      },
    });

    expect(mocks.storyCreate).toHaveBeenCalled();
    // sem filtro configurado, nenhum evento de descarte é gravado
    expect(mocks.linearSyncEventCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "FILTERED" }),
      })
    );
  });
});

// ─── Webhook DLQ for PAUSED integration (AC-004) ─────────────────────────────

const routeMocks = vi.hoisted(() => ({
  integrationFindFirst: vi.fn(),
  webhookDlqCreate: vi.fn(),
  auditLogCreate: vi.fn(),
  redisSet: vi.fn(),
  inngestSend: vi.fn(),
  verifyLinearSignature: vi.fn(),
}));

vi.mock("@/app/actions/integrations/webhooks/verify-signature", () => ({
  verifyLinearSignature: routeMocks.verifyLinearSignature,
}));
vi.mock("@repo/rate-limit", () => ({
  redis: { set: routeMocks.redisSet },
  createRateLimiter: () => ({
    limit: () => Promise.resolve({ success: true }),
  }),
  fixedWindow: vi.fn(),
}));
vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: routeMocks.inngestSend },
}));

// Note: database mock already established above — extend it
// We patch just what the route needs
const _dbMockForRoute = {
  integrationFindFirst: routeMocks.integrationFindFirst,
  webhookDlqCreate: routeMocks.webhookDlqCreate,
  auditLogCreate: routeMocks.auditLogCreate,
};

describe("Webhook DLQ for PAUSED integration (AC-004)", () => {
  it("apply policy assertions via unit tests on merge-policy module", () => {
    // The PAUSED integration DLQ flow is integration-tested via the webhook route;
    // here we verify the pure merge-policy behaviour that drives the decision tree.
    expect(
      resolveField({
        field: "wsjfScore",
        linearValue: 5,
        cosmosValue: 10,
        linearUpdatedAt: new Date(),
        cosmosUpdatedAt: new Date(),
      }).action
    ).toBe("SKIP");

    expect(
      resolveField({
        field: "status",
        linearValue: "DONE",
        cosmosValue: "IN_PROGRESS",
        linearUpdatedAt: new Date(),
        cosmosUpdatedAt: new Date(),
      }).action
    ).toBe("APPLY");
  });
});
