import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/database", () => ({
  database: {
    accessExceptionRequest: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@repo/auth/server", () => ({
  AuthError: class AuthError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "AuthError";
    }
  },
}));

import { AuthError } from "@repo/auth/server";
import { database } from "@repo/database";
import { enforceWithPAE } from "@/app/actions/permissions";

const db = vi.mocked(database);

beforeEach(() => vi.clearAllMocks());

describe("enforceWithPAE", () => {
  it("passes immediately when can() returns true — no DB query", async () => {
    // ADMIN always passes can()
    await expect(
      enforceWithPAE({
        tenantId: "tenant-1",
        userId: "user-1",
        role: "ADMIN",
        entity: "Epic",
        action: "create",
      })
    ).resolves.toBeUndefined();
    expect(db.accessExceptionRequest.findFirst).not.toHaveBeenCalled();
  });

  it("passes when can() fails but active PAE grant exists", async () => {
    // DEV cannot create Epic by role — but has an active grant
    vi.mocked(db.accessExceptionRequest.findFirst).mockResolvedValue({
      id: "grant-1",
      tenantId: "tenant-1",
      requesterId: "user-1",
      entityType: "Epic",
      action: "create",
      targetEntityId: null,
      justification: null,
      duration: "4h",
      status: "APPROVED",
      approverId: "approver-1",
      approvedAt: new Date(),
      expiresAt: new Date(Date.now() + 3_600_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      enforceWithPAE({
        tenantId: "tenant-1",
        userId: "user-1",
        role: "DEV",
        entity: "Epic",
        action: "create",
      })
    ).resolves.toBeUndefined();
    expect(db.accessExceptionRequest.findFirst).toHaveBeenCalledOnce();
  });

  it("throws AuthError when can() fails and no active grant", async () => {
    vi.mocked(db.accessExceptionRequest.findFirst).mockResolvedValue(null);

    await expect(
      enforceWithPAE({
        tenantId: "tenant-1",
        userId: "user-1",
        role: "DEV",
        entity: "Epic",
        action: "create",
      })
    ).rejects.toThrow(AuthError);
  });

  it("queries DB only on blocked path — not for passing roles", async () => {
    // SM can read Epic — should not hit DB
    await expect(
      enforceWithPAE({
        tenantId: "tenant-1",
        userId: "user-1",
        role: "SM",
        entity: "Epic",
        action: "read",
      })
    ).resolves.toBeUndefined();
    expect(db.accessExceptionRequest.findFirst).not.toHaveBeenCalled();
  });
});
