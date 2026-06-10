// @vitest-environment node
// Tests for applyInsight / dismissInsight logic — pure unit tests.
// Database calls are mocked; no DATABASE_URL required.

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock server infrastructure before module import
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({
    tenantId: "tenant_1",
    userId: "user_1",
    role: "ADMIN",
  }),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({}),
}));

vi.mock("@repo/database", () => ({
  database: {
    meetingInsight: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    meetingTranscript: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    risk: {
      create: vi.fn(),
    },
    decisionLogEntry: {
      create: vi.fn(),
    },
  },
}));

import { database } from "@repo/database";
import {
  applyInsight,
  dismissInsight,
  listMeetingInsights,
} from "@/app/actions/meeting/insights";

const db = database as unknown as {
  meetingInsight: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  meetingTranscript: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  risk: { create: ReturnType<typeof vi.fn> };
  decisionLogEntry: { create: ReturnType<typeof vi.fn> };
};

beforeEach(() => vi.clearAllMocks());

describe("applyInsight", () => {
  it("ACTION insight → creates Risk + marks APPLIED", async () => {
    db.meetingInsight.findFirst.mockResolvedValueOnce({
      id: "ins_1",
      type: "ACTION",
      text: "Update release plan",
      status: "PENDING",
      transcript: { id: "tx_1", piPlanId: "pi_1" },
    });
    db.risk.create.mockResolvedValueOnce({ id: "risk_1" });

    const res = await applyInsight({ insightId: "ins_1" });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.entityType).toBe("Risk");
    expect(res.data.entityId).toBe("risk_1");
    expect(db.risk.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Update release plan",
          status: "IDENTIFIED",
          piPlanId: "pi_1",
          category: "organizational",
        }),
      })
    );
    expect(db.meetingInsight.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "APPLIED", appliedEntityId: "risk_1" },
      })
    );
  });

  it("DECISION insight → creates DecisionLogEntry", async () => {
    db.meetingInsight.findFirst.mockResolvedValueOnce({
      id: "ins_2",
      type: "DECISION",
      text: "Adotar feature flags",
      status: "PENDING",
      transcript: { id: "tx_2", piPlanId: "pi_2" },
    });
    db.decisionLogEntry.create.mockResolvedValueOnce({ id: "dec_1" });

    const res = await applyInsight({ insightId: "ins_2" });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.entityType).toBe("DecisionLog");
    expect(db.decisionLogEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          decisao: "Adotar feature flags",
          targetType: "PI",
          targetId: "pi_2",
        }),
      })
    );
  });

  it("edited text overrides original", async () => {
    db.meetingInsight.findFirst.mockResolvedValueOnce({
      id: "ins_3",
      type: "RISK",
      text: "Old text",
      status: "PENDING",
      transcript: { id: "tx_3", piPlanId: null },
    });
    db.risk.create.mockResolvedValueOnce({ id: "risk_2" });

    await applyInsight({ insightId: "ins_3", text: "New text" });

    expect(db.risk.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "New text" }),
      })
    );
  });

  it("already APPLIED → returns err (idempotency)", async () => {
    db.meetingInsight.findFirst.mockResolvedValueOnce({
      id: "ins_4",
      type: "ACTION",
      text: "Some action",
      status: "APPLIED",
      transcript: { id: "tx_4", piPlanId: null },
    });

    const res = await applyInsight({ insightId: "ins_4" });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/já aplicado/i);
    expect(db.risk.create).not.toHaveBeenCalled();
  });
});

describe("dismissInsight", () => {
  it("PENDING insight → marks DISMISSED", async () => {
    db.meetingInsight.findFirst.mockResolvedValueOnce({
      id: "ins_5",
      status: "PENDING",
    });

    const res = await dismissInsight({ insightId: "ins_5" });

    expect(res.ok).toBe(true);
    expect(db.meetingInsight.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "DISMISSED" } })
    );
  });

  it("non-PENDING insight → returns err", async () => {
    db.meetingInsight.findFirst.mockResolvedValueOnce({
      id: "ins_6",
      status: "APPLIED",
    });

    const res = await dismissInsight({ insightId: "ins_6" });

    expect(res.ok).toBe(false);
  });
});

describe("listMeetingInsights", () => {
  it("missing transcript → returns err", async () => {
    db.meetingTranscript.findFirst.mockResolvedValueOnce(null);

    const res = await listMeetingInsights("tx_missing");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/não encontrada/i);
  });
});
