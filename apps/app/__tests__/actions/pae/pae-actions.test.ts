import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/database", () => ({
  database: {
    accessExceptionRequest: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    tenantMember: { findMany: vi.fn(), findFirst: vi.fn() },
    epic: { findFirst: vi.fn() },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({
    tenantId: "cjld2cjxh0000qzrmn831i7rn",
    userId: "cjld2cjxh0001qzrmn831i7rn",
    role: "DEV",
  }),
}));

vi.mock("@/app/actions/notifications/push-notification", () => ({
  pushNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/app/actions/permissions", () => ({
  can: vi.fn().mockReturnValue(false),
}));

import { database } from "@repo/database";
import { pushNotification } from "@/app/actions/notifications/push-notification";
import {
  approvePAERequest,
  createPAERequest,
  denyPAERequest,
  listPAERequests,
  revokePAEGrant,
} from "@/app/actions/pae/index";
import { can } from "@/app/actions/permissions";

const db = vi.mocked(database);
const mockCan = vi.mocked(can);

beforeEach(() => {
  vi.clearAllMocks();
  mockCan.mockReturnValue(false); // restore default
});

describe("createPAERequest", () => {
  it("creates request when no duplicate pending exists", async () => {
    db.accessExceptionRequest.findFirst.mockResolvedValue(null);
    db.accessExceptionRequest.create.mockResolvedValue({
      id: "cjld2cjxh0002qzrmn831i7rn",
      tenantId: "cjld2cjxh0000qzrmn831i7rn",
      requesterId: "cjld2cjxh0001qzrmn831i7rn",
      entityType: "Epic",
      action: "create",
      targetEntityId: null,
      justification: null,
      duration: "4h",
      status: "PENDING",
      approverId: null,
      approvedAt: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    db.tenantMember.findMany.mockResolvedValue([]);

    const result = await createPAERequest({
      entityType: "Epic",
      action: "create",
      duration: "4h",
    });

    expect(result.ok).toBe(true);
    expect(db.accessExceptionRequest.create).toHaveBeenCalledOnce();
  });

  it("rejects duplicate pending request for same entity+action", async () => {
    db.accessExceptionRequest.findFirst.mockResolvedValue({
      id: "existing-cjld2cjxh0000",
    });

    const result = await createPAERequest({
      entityType: "Epic",
      action: "create",
      duration: "4h",
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(
      /já existe/i
    );
    expect(db.accessExceptionRequest.create).not.toHaveBeenCalled();
  });

  it("returns error on invalid input (empty entityType)", async () => {
    const result = await createPAERequest({
      entityType: "",
      action: "create",
      duration: "4h",
    });

    expect(result.ok).toBe(false);
  });

  it("notifies approvers when can() returns true for a member", async () => {
    db.accessExceptionRequest.findFirst.mockResolvedValue(null);
    db.accessExceptionRequest.create.mockResolvedValue({
      id: "cjld2cjxh0002qzrmn831i7rn",
      tenantId: "cjld2cjxh0000qzrmn831i7rn",
      requesterId: "cjld2cjxh0001qzrmn831i7rn",
      entityType: "Epic",
      action: "create",
      targetEntityId: null,
      justification: null,
      duration: "4h",
      status: "PENDING",
      approverId: null,
      approvedAt: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    // One member qualifies as approver
    db.tenantMember.findMany.mockResolvedValue([
      { userId: "cjld2cjxh0003qzrmn831i7rn", role: "PO" },
    ]);
    mockCan.mockReturnValue(true);

    await createPAERequest({
      entityType: "Epic",
      action: "create",
      duration: "4h",
    });

    expect(pushNotification).toHaveBeenCalledWith(
      "cjld2cjxh0000qzrmn831i7rn",
      expect.objectContaining({
        userId: "cjld2cjxh0003qzrmn831i7rn",
        type: "pae_request",
      })
    );
  });
});

describe("listPAERequests", () => {
  it("returns requests without error", async () => {
    db.accessExceptionRequest.findMany.mockResolvedValue([]);
    const result = await listPAERequests();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.data)).toBe(true);
    }
  });
});

describe("approvePAERequest", () => {
  it("sets status APPROVED and computes expiresAt for PENDING request", async () => {
    mockCan.mockReturnValue(true); // caller has permission to approve
    db.accessExceptionRequest.findUnique.mockResolvedValue({
      id: "cjld2cjxh0002qzrmn831i7rn",
      tenantId: "cjld2cjxh0000qzrmn831i7rn",
      requesterId: "cjld2cjxh0004qzrmn831i7rn",
      entityType: "Epic",
      action: "create",
      targetEntityId: null,
      justification: null,
      duration: "4h",
      status: "PENDING",
      approverId: null,
      approvedAt: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    db.accessExceptionRequest.update.mockResolvedValue({
      id: "cjld2cjxh0002qzrmn831i7rn",
      tenantId: "cjld2cjxh0000qzrmn831i7rn",
      requesterId: "cjld2cjxh0004qzrmn831i7rn",
      entityType: "Epic",
      action: "create",
      targetEntityId: null,
      justification: null,
      duration: "4h",
      status: "APPROVED",
      approverId: "cjld2cjxh0001qzrmn831i7rn",
      approvedAt: new Date(),
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await approvePAERequest({ id: "cjld2cjxh0002qzrmn831i7rn" });

    expect(result.ok).toBe(true);
    expect(db.accessExceptionRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cjld2cjxh0002qzrmn831i7rn" },
        data: expect.objectContaining({
          status: "APPROVED",
          approverId: "cjld2cjxh0001qzrmn831i7rn",
        }),
      })
    );
  });

  it("rejects approval of non-PENDING request", async () => {
    db.accessExceptionRequest.findUnique.mockResolvedValue({
      id: "cjld2cjxh0002qzrmn831i7rn",
      tenantId: "cjld2cjxh0000qzrmn831i7rn",
      status: "APPROVED",
      duration: "4h",
      entityType: "Epic",
      action: "create",
      requesterId: "cjld2cjxh0004qzrmn831i7rn",
      targetEntityId: null,
      justification: null,
      approverId: null,
      approvedAt: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await approvePAERequest({ id: "cjld2cjxh0002qzrmn831i7rn" });

    expect(result.ok).toBe(false);
    expect(db.accessExceptionRequest.update).not.toHaveBeenCalled();
  });

  it("rejects self-approval (requester === approver)", async () => {
    db.accessExceptionRequest.findUnique.mockResolvedValue({
      id: "cjld2cjxh0002qzrmn831i7rn",
      tenantId: "cjld2cjxh0000qzrmn831i7rn",
      requesterId: "cjld2cjxh0001qzrmn831i7rn", // same as ctx.userId
      entityType: "Epic",
      action: "create",
      targetEntityId: null,
      justification: null,
      duration: "4h",
      status: "PENDING",
      approverId: null,
      approvedAt: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockCan.mockReturnValue(true); // caller has permission but is the requester

    const result = await approvePAERequest({ id: "cjld2cjxh0002qzrmn831i7rn" });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(
      /própria solicitação/i
    );
    expect(db.accessExceptionRequest.update).not.toHaveBeenCalled();
  });
});

describe("denyPAERequest", () => {
  it("rejects denial of non-PENDING request", async () => {
    db.accessExceptionRequest.findUnique.mockResolvedValue({
      id: "cjld2cjxh0002qzrmn831i7rn",
      tenantId: "cjld2cjxh0000qzrmn831i7rn",
      requesterId: "cjld2cjxh0004qzrmn831i7rn",
      entityType: "Epic",
      action: "create",
      targetEntityId: null,
      justification: null,
      duration: "4h",
      status: "APPROVED",
      approverId: "cjld2cjxh0001qzrmn831i7rn",
      approvedAt: new Date(),
      expiresAt: new Date(Date.now() + 3_600_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await denyPAERequest({ id: "cjld2cjxh0002qzrmn831i7rn" });

    expect(result.ok).toBe(false);
    expect(db.accessExceptionRequest.update).not.toHaveBeenCalled();
  });

  it("sets status DENIED on PENDING request", async () => {
    mockCan.mockReturnValue(true); // caller has permission to deny
    db.accessExceptionRequest.findUnique.mockResolvedValue({
      id: "cjld2cjxh0002qzrmn831i7rn",
      tenantId: "cjld2cjxh0000qzrmn831i7rn",
      requesterId: "cjld2cjxh0004qzrmn831i7rn",
      entityType: "Epic",
      action: "create",
      targetEntityId: null,
      justification: null,
      duration: "4h",
      status: "PENDING",
      approverId: null,
      approvedAt: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    db.accessExceptionRequest.update.mockResolvedValue({
      id: "cjld2cjxh0002qzrmn831i7rn",
      tenantId: "cjld2cjxh0000qzrmn831i7rn",
      requesterId: "cjld2cjxh0004qzrmn831i7rn",
      entityType: "Epic",
      action: "create",
      targetEntityId: null,
      justification: null,
      duration: "4h",
      status: "DENIED",
      approverId: "cjld2cjxh0001qzrmn831i7rn",
      approvedAt: new Date(),
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await denyPAERequest({ id: "cjld2cjxh0002qzrmn831i7rn" });

    expect(result.ok).toBe(true);
    expect(db.accessExceptionRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DENIED" }),
      })
    );
  });
});

describe("revokePAEGrant", () => {
  it("sets status REVOKED on APPROVED grant when caller is approver", async () => {
    db.accessExceptionRequest.findUnique.mockResolvedValue({
      id: "cjld2cjxh0002qzrmn831i7rn",
      tenantId: "cjld2cjxh0000qzrmn831i7rn",
      requesterId: "cjld2cjxh0004qzrmn831i7rn",
      approverId: "cjld2cjxh0001qzrmn831i7rn",
      entityType: "Epic",
      action: "create",
      targetEntityId: null,
      justification: null,
      duration: "4h",
      status: "APPROVED",
      approvedAt: new Date(),
      expiresAt: new Date(Date.now() + 3_600_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    db.accessExceptionRequest.update.mockResolvedValue({
      id: "cjld2cjxh0002qzrmn831i7rn",
      tenantId: "cjld2cjxh0000qzrmn831i7rn",
      requesterId: "cjld2cjxh0004qzrmn831i7rn",
      approverId: "cjld2cjxh0001qzrmn831i7rn",
      entityType: "Epic",
      action: "create",
      targetEntityId: null,
      justification: null,
      duration: "4h",
      status: "REVOKED",
      approvedAt: new Date(),
      expiresAt: new Date(Date.now() + 3_600_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await revokePAEGrant({ id: "cjld2cjxh0002qzrmn831i7rn" });

    expect(result.ok).toBe(true);
    expect(db.accessExceptionRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REVOKED" }),
      })
    );
  });

  it("rejects revoke of non-APPROVED grant", async () => {
    db.accessExceptionRequest.findUnique.mockResolvedValue({
      id: "cjld2cjxh0002qzrmn831i7rn",
      tenantId: "cjld2cjxh0000qzrmn831i7rn",
      requesterId: "cjld2cjxh0004qzrmn831i7rn",
      approverId: "cjld2cjxh0001qzrmn831i7rn",
      entityType: "Epic",
      action: "create",
      targetEntityId: null,
      justification: null,
      duration: "4h",
      status: "DENIED",
      approvedAt: new Date(),
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await revokePAEGrant({ id: "cjld2cjxh0002qzrmn831i7rn" });

    expect(result.ok).toBe(false);
    expect(db.accessExceptionRequest.update).not.toHaveBeenCalled();
  });

  it("allows ADMIN to revoke even if not the original approver", async () => {
    // Override the session mock to return ADMIN role
    const { requireTenantSession } = await import("@repo/auth/server");
    vi.mocked(requireTenantSession).mockResolvedValueOnce({
      tenantId: "cjld2cjxh0000qzrmn831i7rn",
      userId: "cjld2cjxh0099qzrmn831i7rn", // different user
      role: "ADMIN",
    });

    db.accessExceptionRequest.findUnique.mockResolvedValue({
      id: "cjld2cjxh0002qzrmn831i7rn",
      tenantId: "cjld2cjxh0000qzrmn831i7rn",
      requesterId: "cjld2cjxh0004qzrmn831i7rn",
      approverId: "cjld2cjxh0001qzrmn831i7rn", // different from ADMIN userId
      entityType: "Epic",
      action: "create",
      targetEntityId: null,
      justification: null,
      duration: "4h",
      status: "APPROVED",
      approvedAt: new Date(),
      expiresAt: new Date(Date.now() + 3_600_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    db.accessExceptionRequest.update.mockResolvedValue({
      id: "cjld2cjxh0002qzrmn831i7rn",
      tenantId: "cjld2cjxh0000qzrmn831i7rn",
      requesterId: "cjld2cjxh0004qzrmn831i7rn",
      approverId: "cjld2cjxh0001qzrmn831i7rn",
      entityType: "Epic",
      action: "create",
      targetEntityId: null,
      justification: null,
      duration: "4h",
      status: "REVOKED",
      approvedAt: new Date(),
      expiresAt: new Date(Date.now() + 3_600_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await revokePAEGrant({ id: "cjld2cjxh0002qzrmn831i7rn" });

    expect(result.ok).toBe(true);
  });
});
