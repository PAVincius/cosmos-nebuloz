// @vitest-environment node
// Tests for applyInsight / dismissInsight logic — pure unit tests.
// Database calls are mocked; no DATABASE_URL required.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn().mockResolvedValue({
    tenantId: "tenant_1",
    userId: "user_1",
    role: "ADMIN",
  }),
  headers: vi.fn().mockResolvedValue({}),
  logDecision: vi.fn(),
  indexEntity: vi.fn().mockResolvedValue(undefined),
  // meetingInsight
  insightFindFirst: vi.fn(),
  insightUpdate: vi.fn().mockResolvedValue({}),
  // meetingTranscript
  transcriptFindFirst: vi.fn(),
  transcriptFindMany: vi.fn(),
  insightFindMany: vi.fn(),
  // pIPlan
  piPlanFindFirst: vi.fn(),
  // sprint
  sprintFindFirst: vi.fn(),
  // impediment
  impedimentCreate: vi.fn(),
  // risk
  riskCreate: vi.fn(),
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/database", () => ({
  database: {
    meetingInsight: {
      findFirst: mocks.insightFindFirst,
      findMany: mocks.insightFindMany,
      update: mocks.insightUpdate,
    },
    meetingTranscript: {
      findFirst: mocks.transcriptFindFirst,
      findMany: mocks.transcriptFindMany,
    },
    pIPlan: { findFirst: mocks.piPlanFindFirst },
    sprint: { findFirst: mocks.sprintFindFirst },
    impediment: { create: mocks.impedimentCreate },
    risk: { create: mocks.riskCreate },
  },
}));
vi.mock("@/app/actions/governance/decision-log", () => ({
  logDecision: mocks.logDecision,
}));
vi.mock("@/app/actions/safe-copilot/index-entity", () => ({
  indexEntity: mocks.indexEntity,
}));

import {
  applyInsight,
  dismissInsight,
  listMeetingInsights,
} from "@/app/actions/meeting/insights";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireTenantSession.mockResolvedValue({
    tenantId: "tenant_1",
    userId: "user_1",
    role: "ADMIN",
  });
  mocks.headers.mockResolvedValue({});
  mocks.piPlanFindFirst.mockResolvedValue({ artId: "art_1" });
  mocks.sprintFindFirst.mockResolvedValue({ teamId: "team_1" });
  mocks.impedimentCreate.mockResolvedValue({ id: "imp_1" });
  mocks.riskCreate.mockResolvedValue({ id: "risk_1" });
  mocks.logDecision.mockResolvedValue({ id: "dec_1" });
  mocks.insightUpdate.mockResolvedValue({});
  mocks.transcriptFindFirst.mockResolvedValue({ id: "tx_1" });
});

describe("applyInsight", () => {
  it("ACTION insight → creates Impediment with artId, marks APPLIED", async () => {
    mocks.insightFindFirst.mockResolvedValueOnce({
      id: "ins_1",
      type: "ACTION",
      text: "Update release plan",
      status: "PENDING",
      transcript: { id: "tx_1", piPlanId: "pi_1" },
    });

    const res = await applyInsight({ insightId: "ins_1" });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.entityType).toBe("Impediment");
    expect(res.data.entityId).toBe("imp_1");

    expect(mocks.piPlanFindFirst).toHaveBeenCalledWith({
      where: { id: "pi_1", tenantId: "tenant_1" },
      select: { artId: true },
    });
    expect(mocks.sprintFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACTIVE" }),
      })
    );
    expect(mocks.impedimentCreate).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant_1",
        title: "Update release plan",
        status: "OPEN",
        artId: "art_1",
        teamId: "team_1",
      },
      select: { id: true },
    });
    expect(mocks.riskCreate).not.toHaveBeenCalled();
    expect(mocks.insightUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "APPLIED", appliedEntityId: "imp_1" },
      })
    );
  });

  it("ACTION insight without piPlanId → creates Impediment without artId", async () => {
    mocks.insightFindFirst.mockResolvedValueOnce({
      id: "ins_1b",
      type: "ACTION",
      text: "Fix build",
      status: "PENDING",
      transcript: { id: "tx_1b", piPlanId: null },
    });

    const res = await applyInsight({ insightId: "ins_1b" });

    expect(res.ok).toBe(true);
    expect(mocks.piPlanFindFirst).not.toHaveBeenCalled();
    expect(mocks.sprintFindFirst).not.toHaveBeenCalled();
    expect(mocks.impedimentCreate).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant_1",
        title: "Fix build",
        status: "OPEN",
        artId: undefined,
        teamId: undefined,
      },
      select: { id: true },
    });
  });

  it("RISK insight → creates Risk with category technical", async () => {
    mocks.insightFindFirst.mockResolvedValueOnce({
      id: "ins_2",
      type: "RISK",
      text: "Dependency risk on library X",
      status: "PENDING",
      transcript: { id: "tx_2", piPlanId: "pi_2" },
    });

    const res = await applyInsight({ insightId: "ins_2" });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.entityType).toBe("Risk");
    expect(res.data.entityId).toBe("risk_1");

    expect(mocks.riskCreate).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant_1",
        title: "Dependency risk on library X",
        status: "IDENTIFIED",
        impact: "medium",
        probability: "medium",
        category: "technical",
        piPlanId: "pi_2",
      },
      select: { id: true },
    });
    expect(mocks.impedimentCreate).not.toHaveBeenCalled();
  });

  it("DECISION insight → calls logDecision and returns DecisionLog", async () => {
    mocks.insightFindFirst.mockResolvedValueOnce({
      id: "ins_3",
      type: "DECISION",
      text: "Adotar feature flags",
      status: "PENDING",
      transcript: { id: "tx_3", piPlanId: "pi_3" },
    });

    const res = await applyInsight({ insightId: "ins_3" });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.entityType).toBe("DecisionLog");
    expect(res.data.entityId).toBe("dec_1");

    expect(mocks.logDecision).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant_1" }),
      expect.objectContaining({
        tipo: "meeting-insight",
        targetType: "PI",
        targetId: "pi_3",
        decisao: "Adotar feature flags",
      })
    );
    expect(mocks.riskCreate).not.toHaveBeenCalled();
    expect(mocks.impedimentCreate).not.toHaveBeenCalled();
  });

  it("edited text overrides original", async () => {
    mocks.insightFindFirst.mockResolvedValueOnce({
      id: "ins_4",
      type: "RISK",
      text: "Old text",
      status: "PENDING",
      transcript: { id: "tx_4", piPlanId: null },
    });

    await applyInsight({ insightId: "ins_4", text: "New text" });

    expect(mocks.riskCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "New text" }),
      })
    );
  });

  it("already APPLIED → returns err (idempotency)", async () => {
    mocks.insightFindFirst.mockResolvedValueOnce({
      id: "ins_5",
      type: "ACTION",
      text: "Some action",
      status: "APPLIED",
      transcript: { id: "tx_5", piPlanId: null },
    });

    const res = await applyInsight({ insightId: "ins_5" });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/já aplicado/i);
    expect(mocks.impedimentCreate).not.toHaveBeenCalled();
    expect(mocks.riskCreate).not.toHaveBeenCalled();
  });

  it("insight not found → returns err", async () => {
    mocks.insightFindFirst.mockResolvedValueOnce(null);

    const res = await applyInsight({ insightId: "missing" });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/não encontrado/i);
  });
});

describe("dismissInsight", () => {
  it("PENDING insight → marks DISMISSED", async () => {
    mocks.insightFindFirst.mockResolvedValueOnce({
      id: "ins_6",
      status: "PENDING",
    });

    const res = await dismissInsight({ insightId: "ins_6" });

    expect(res.ok).toBe(true);
    expect(mocks.insightUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "DISMISSED" } })
    );
  });

  it("non-PENDING insight → returns err", async () => {
    mocks.insightFindFirst.mockResolvedValueOnce({
      id: "ins_7",
      status: "APPLIED",
    });

    const res = await dismissInsight({ insightId: "ins_7" });

    expect(res.ok).toBe(false);
  });
});

describe("listMeetingInsights", () => {
  it("missing transcript → returns err", async () => {
    mocks.transcriptFindFirst.mockResolvedValueOnce(null);

    const res = await listMeetingInsights("tx_missing");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/não encontrada/i);
  });
});
