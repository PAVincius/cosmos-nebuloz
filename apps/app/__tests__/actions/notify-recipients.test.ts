import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tenantMemberFindMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@repo/database", () => ({
  database: {
    tenantMember: { findMany: mocks.tenantMemberFindMany },
  },
}));

import {
  dedupeRecipients,
  findRecipientsByRole,
} from "../../app/actions/notify-recipients";

describe("findRecipientsByRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns userIds for matching roles, tenant-scoped", async () => {
    mocks.tenantMemberFindMany.mockResolvedValue([
      { userId: "user-1" },
      { userId: "user-2" },
    ]);

    const result = await findRecipientsByRole("tenant-abc", ["PO", "SM"]);

    expect(result).toEqual(["user-1", "user-2"]);
    expect(mocks.tenantMemberFindMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-abc", role: { in: ["PO", "SM"] } },
      select: { userId: true },
    });
  });

  it("returns [] when DB throws (error swallowed)", async () => {
    mocks.tenantMemberFindMany.mockRejectedValue(
      new Error("DB connection failed")
    );

    const result = await findRecipientsByRole("tenant-abc", ["PO"]);

    expect(result).toEqual([]);
  });

  it("returns [] when no members match the roles", async () => {
    mocks.tenantMemberFindMany.mockResolvedValue([]);

    const result = await findRecipientsByRole("tenant-abc", ["RTE"]);

    expect(result).toEqual([]);
  });
});

describe("dedupeRecipients", () => {
  it("merges and deduplicates multiple arrays", () => {
    const result = dedupeRecipients(
      ["user-1", "user-2"],
      ["user-2", "user-3"],
      ["user-1", "user-4"]
    );

    expect(result).toEqual(["user-1", "user-2", "user-3", "user-4"]);
  });

  it("handles empty arrays gracefully", () => {
    const result = dedupeRecipients([], [], []);

    expect(result).toEqual([]);
  });
});
