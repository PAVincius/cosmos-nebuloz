import { describe, expect, it, vi } from "vitest";
import { logPlatformAudit } from "../audit";

describe("logPlatformAudit", () => {
  it("grava o alvo no tenant do cliente, com o staff como ator", async () => {
    const create = vi.fn().mockResolvedValue({ id: "audit-1" });
    const db = { auditLog: { create } };

    await logPlatformAudit(db, {
      tenantId: "tenant-abc",
      actorUserId: "user-staff",
      actorName: "Vinícius",
      action: "module.contracted",
      entityType: "TenantModule",
      entityId: "tm-1",
      target: "vanta-saude · CHARTER",
    });

    expect(create).toHaveBeenCalledTimes(1);
    const { data } = create.mock.calls[0][0];

    expect(data.tenantId).toBe("tenant-abc");
    expect(data.actorId).toBe("user-staff");
    expect(data.actorType).toBe("user");
    expect(data.action).toBe("module.contracted");
    expect(data.metadata).toMatchObject({
      target: "vanta-saude · CHARTER",
      actorName: "Vinícius",
      platformStaff: true,
    });
  });

  it("marca platformStaff mesmo sem nome do ator", async () => {
    const create = vi.fn().mockResolvedValue({ id: "audit-2" });

    await logPlatformAudit(
      { auditLog: { create } },
      {
        tenantId: "tenant-abc",
        actorUserId: "user-staff",
        action: "tenant.provisioned",
        entityType: "Tenant",
        entityId: "tenant-abc",
        target: "vanta-saude",
      }
    );

    const { data } = create.mock.calls[0][0];
    expect(data.metadata.platformStaff).toBe(true);
    expect(data.metadata.actorName).toBeNull();
  });
});
