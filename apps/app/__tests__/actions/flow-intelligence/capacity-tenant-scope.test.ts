import { beforeEach, describe, expect, it, vi } from "vitest";

// Sec 2: upsertMemberAssignment's Prisma upsert key must carry tenantId.
// Without it, a caller-supplied sprintId+userId belonging to another tenant
// hits that tenant's existing row and falls into the `update` branch,
// overwriting capacityFactor/role cross-tenant.
const h = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  requireTenantSessionMock: vi.fn(async () => ({
    tenantId: "tenant-1",
    userId: "user-1",
    role: "PO",
  })),
}));

vi.mock("@repo/database", () => ({
  database: {
    teamMemberAssignment: { upsert: h.upsertMock },
  },
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSessionMock,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("server-only", () => ({}));

import { upsertMemberAssignment } from "../../../app/actions/flow-intelligence/capacity";

describe("upsertMemberAssignment tenant scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.requireTenantSessionMock.mockResolvedValue({
      tenantId: "tenant-1",
      userId: "user-1",
      role: "PO",
    });
  });

  it("scopes the upsert key by tenant so it cannot update another tenant's row", async () => {
    h.upsertMock.mockResolvedValue({ id: "tma-1" });

    await upsertMemberAssignment("sprint-1", "team-1", "user-1", {
      capacityFactor: 0.5,
    });

    const arg = h.upsertMock.mock.calls[0][0];
    // A chave precisa carregar o tenantId — sem isso o upsert alcança a linha
    // de outro tenant e cai no ramo de update.
    expect(JSON.stringify(arg.where)).toContain("tenant-1");
  });

  it("rejects a capacityFactor outside [0, 1] without touching the database", async () => {
    const tooHigh = await upsertMemberAssignment(
      "sprint-1",
      "team-1",
      "user-1",
      {
        capacityFactor: 1.5,
      }
    );
    const tooLow = await upsertMemberAssignment(
      "sprint-1",
      "team-1",
      "user-1",
      {
        capacityFactor: -0.1,
      }
    );

    expect(tooHigh.ok).toBe(false);
    expect(tooLow.ok).toBe(false);
    expect(h.upsertMock).not.toHaveBeenCalled();
  });
});
