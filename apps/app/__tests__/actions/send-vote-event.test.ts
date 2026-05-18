import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
  requireRole: mocks.requireRole,
  AuthError: MockAuthError,
}));

vi.mock("@repo/database", () => ({
  database: {
    confidenceVoteSession: {
      findFirst: mocks.findFirst,
      update: mocks.update,
    },
  },
}));

import { sendVoteEvent } from "../../app/actions/arts/confidence-vote";

const baseSession = {
  id: "session-1",
  xStateStatus: "NOT_STARTED",
  votes: [] as number[],
  piSession: {
    piPlan: { art: { id: "art-1" } },
  },
};

describe("sendVoteEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockReset();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx });
    mocks.findFirst.mockResolvedValue(baseSession);
    mocks.update.mockImplementation(async ({ data }) => ({
      id: "session-1",
      ...data,
    }));
  });

  it("transitions NOT_STARTED → OPEN on START_VOTING", async () => {
    const updated = await sendVoteEvent("session-1", { type: "START_VOTING" });

    expect(updated.xStateStatus).toBe("OPEN");
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "session-1", tenantId: tenantCtx.tenantId },
      })
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/arts/art-1/pi-planning"
    );
  });

  it("records a vote while session is OPEN", async () => {
    mocks.findFirst.mockResolvedValue({
      ...baseSession,
      xStateStatus: "OPEN",
    });

    const updated = await sendVoteEvent("session-1", {
      type: "SUBMIT_VOTE",
      vote: 4,
    });

    expect(updated.xStateStatus).toBe("OPEN");
    expect(updated.votes).toEqual([4]);
  });

  it("requires RTE role for privileged START_VOTING when mocked as DEV", async () => {
    mocks.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      role: "DEV",
    });
    mocks.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "role denied");
    });

    await expect(
      sendVoteEvent("session-1", { type: "START_VOTING" })
    ).rejects.toThrow(/role denied/);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("throws when session is missing for tenant", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(
      sendVoteEvent("session-1", { type: "START_VOTING" })
    ).rejects.toThrow(/não encontrada/i);
  });

  it("rejects invalid transition", async () => {
    mocks.findFirst.mockResolvedValue({
      ...baseSession,
      xStateStatus: "NOT_STARTED",
    });

    await expect(
      sendVoteEvent("session-1", { type: "SUBMIT_VOTE", vote: 5 })
    ).rejects.toThrow(/Transição inválida/);
  });
});
