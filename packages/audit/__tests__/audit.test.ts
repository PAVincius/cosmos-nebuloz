import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditLogCreate: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: { auditLog: { create: mocks.auditLogCreate } },
}));

vi.mock("@repo/observability/log", () => ({
  log: { info: mocks.logInfo, warn: mocks.logWarn, error: mocks.logError },
}));

import { logAdminEvent, logDataEvent, logSecurityEvent } from "../index";

const TENANT = "tenant-1";
const USER = "user-1";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auditLogCreate.mockResolvedValue({});
});

describe("logSecurityEvent", () => {
  it("grava no banco quando há tenant", async () => {
    await logSecurityEvent({
      action: "auth.login.success",
      tenantId: TENANT,
      userId: USER,
      ipAddress: "10.0.0.1",
    });

    expect(mocks.auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT,
        userId: USER,
        action: "auth.login.success",
        entityType: "SECURITY_EVENT",
        entityId: USER,
      }),
    });
  });

  // Evento de sistema não tem tenant e não pode inventar um: a linha de
  // AuditLog é por tenant. Vai só para observabilidade.
  it("não grava no banco sem tenant, mas registra no log", async () => {
    await logSecurityEvent({ action: "auth.login.failure", userId: USER });

    expect(mocks.auditLogCreate).not.toHaveBeenCalled();
    expect(mocks.logWarn).toHaveBeenCalled();
  });

  it("usa warn para falha e info para sucesso", async () => {
    await logSecurityEvent({ action: "auth.login.failure" });
    await logSecurityEvent({ action: "auth.mfa.failed" });
    await logSecurityEvent({ action: "access.denied" });
    expect(mocks.logWarn).toHaveBeenCalledTimes(3);
    expect(mocks.logInfo).not.toHaveBeenCalled();

    await logSecurityEvent({ action: "auth.login.success" });
    expect(mocks.logInfo).toHaveBeenCalledTimes(1);
  });

  it("prefere o alvo ao ator no entityId", async () => {
    await logSecurityEvent({
      action: "access.member.removed",
      tenantId: TENANT,
      userId: USER,
      targetUserId: "user-alvo",
    });

    expect(mocks.auditLogCreate.mock.calls[0][0].data.entityId).toBe(
      "user-alvo"
    );
  });

  it("cai em 'system' quando não há ator nem alvo", async () => {
    await logSecurityEvent({
      action: "admin.tenant.suspended",
      tenantId: TENANT,
    });
    expect(mocks.auditLogCreate.mock.calls[0][0].data.entityId).toBe("system");
  });

  it("junta metadata e contexto de request no diff", async () => {
    await logSecurityEvent({
      action: "auth.session.revoked",
      tenantId: TENANT,
      userId: USER,
      ipAddress: "10.0.0.1",
      userAgent: "curl/8",
      reason: "roubo de cookie",
      metadata: { sessionId: "sess-9" },
    });

    expect(mocks.auditLogCreate.mock.calls[0][0].data.diff).toEqual({
      ipAddress: "10.0.0.1",
      userAgent: "curl/8",
      reason: "roubo de cookie",
      sessionId: "sess-9",
    });
  });
});

describe("logDataEvent", () => {
  it("sempre grava no banco", async () => {
    await logDataEvent({
      action: "updated",
      tenantId: TENANT,
      userId: USER,
      entityType: "EPIC",
      entityId: "epic-1",
      diff: { titulo: ["antes", "depois"] },
    });

    expect(mocks.auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT,
        action: "updated",
        entityType: "EPIC",
        entityId: "epic-1",
        diff: { titulo: ["antes", "depois"] },
      }),
    });
  });

  it("normaliza ator ausente para null, não undefined", async () => {
    await logDataEvent({
      action: "deleted",
      tenantId: TENANT,
      entityType: "EPIC",
      entityId: "epic-1",
    });
    expect(mocks.auditLogCreate.mock.calls[0][0].data.userId).toBeNull();
  });
});

describe("logAdminEvent", () => {
  // Ação de admin é sempre warn: impersonação e gestão de tenant precisam
  // aparecer na trilha mesmo quando o banco falha.
  it("registra em warn e grava quando há tenant", async () => {
    await logAdminEvent({
      action: "admin.impersonation.started",
      tenantId: TENANT,
      userId: USER,
      targetUserId: "user-alvo",
    });

    expect(mocks.logWarn).toHaveBeenCalledWith(
      "[audit:admin]",
      expect.objectContaining({ action: "admin.impersonation.started" })
    );
    expect(mocks.auditLogCreate.mock.calls[0][0].data.entityType).toBe(
      "ADMIN_EVENT"
    );
  });

  it("registra no log mesmo sem tenant", async () => {
    await logAdminEvent({ action: "admin.tenant.created", userId: USER });
    expect(mocks.logWarn).toHaveBeenCalled();
    expect(mocks.auditLogCreate).not.toHaveBeenCalled();
  });
});

describe("falha de escrita é não-bloqueante", () => {
  // A trilha de auditoria não pode derrubar a requisição que a originou:
  // banco fora significa evento perdido, não erro para o usuário.
  it("engole o erro do banco e registra em log.error", async () => {
    mocks.auditLogCreate.mockRejectedValue(new Error("banco fora"));

    await expect(
      logDataEvent({
        action: "created",
        tenantId: TENANT,
        entityType: "EPIC",
        entityId: "epic-1",
      })
    ).resolves.toBeUndefined();

    expect(mocks.logError).toHaveBeenCalledWith(
      "[audit] Failed to write audit log to database",
      expect.objectContaining({ error: expect.any(Error) })
    );
  });

  it("vale também para evento de segurança e de admin", async () => {
    mocks.auditLogCreate.mockRejectedValue(new Error("banco fora"));

    await expect(
      logSecurityEvent({ action: "auth.logout", tenantId: TENANT })
    ).resolves.toBeUndefined();
    await expect(
      logAdminEvent({ action: "admin.tenant.created", tenantId: TENANT })
    ).resolves.toBeUndefined();

    expect(mocks.logError).toHaveBeenCalledTimes(2);
  });
});
