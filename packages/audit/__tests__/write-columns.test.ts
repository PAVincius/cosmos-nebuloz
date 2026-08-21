// write-columns.test.ts — cada campo vai na SUA coluna do AuditLog.
//
// Este é o teste que faltava quando `writeToDb` empilhava `ipAddress`,
// `userAgent`, `reason` e `metadata` dentro de `diff`. O bug não dava erro:
// gravava, retornava, e `apps/app/app/api/audit/route.ts` — que seleciona
// `actorId`, `actorType`, `metadata` e `ipAddress` — servia quatro nulos por
// linha. A regressão aqui é sempre silenciosa, então o teste olha o objeto
// exato entregue ao Prisma, campo por campo.

// `vi.hoisted` porque `vi.mock` sobe acima dos imports: um `const` de módulo
// referenciado dentro da fábrica chegaria lá antes de existir. É o item 5 do
// COMMON_MISTAKES.md.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { logAdminEvent, logDataEvent, logSecurityEvent } from "../index";

const mocks = vi.hoisted(() => ({
  create: vi.fn().mockResolvedValue({ id: "audit-1" }),
}));

vi.mock("@repo/database", () => ({
  database: { auditLog: { create: mocks.create } },
}));

vi.mock("@repo/observability/log", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** Os dados do último `auditLog.create`. */
const gravado = () => mocks.create.mock.calls.at(-1)?.[0].data;

beforeEach(() => {
  mocks.create.mockClear();
});

describe("logSecurityEvent", () => {
  it("grava cada campo na coluna dele, não dentro de diff", async () => {
    await logSecurityEvent({
      action: "auth.login.failure",
      userId: "user-1",
      tenantId: "tenant-1",
      targetUserId: "user-2",
      ipAddress: "203.0.113.7",
      userAgent: "Mozilla/5.0",
      reason: "invalid_credentials",
      metadata: { email: "alguem@exemplo.com" },
    });

    const d = gravado();
    expect(d.ipAddress).toBe("203.0.113.7");
    expect(d.userAgent).toBe("Mozilla/5.0");
    expect(d.targetUserId).toBe("user-2");
    expect(d.reason).toBe("invalid_credentials");
    expect(d.metadata).toEqual({ email: "alguem@exemplo.com" });
  });

  it("preenche actorId e actorType — a rota de audit lê os dois para dizer quem agiu", async () => {
    await logSecurityEvent({
      action: "auth.login.success",
      userId: "user-1",
      tenantId: "tenant-1",
    });

    const d = gravado();
    expect(d.actorId).toBe("user-1");
    expect(d.actorType).toBe("user");
  });

  it("sem userId o ato é do sistema, não de um usuário anônimo", async () => {
    await logSecurityEvent({
      action: "access.denied",
      tenantId: "tenant-1",
    });

    const d = gravado();
    expect(d.actorId).toBeNull();
    expect(d.actorType).toBe("system");
  });

  it("não grava sem tenantId — a coluna é obrigatória e a FK é Restrict", async () => {
    await logSecurityEvent({ action: "auth.login.failure" });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("não derruba o chamador quando gravar falha", async () => {
    mocks.create.mockRejectedValueOnce(new Error("banco fora"));
    await expect(
      logSecurityEvent({ action: "auth.logout", tenantId: "tenant-1" })
    ).resolves.toBeUndefined();
  });
});

describe("logDataEvent", () => {
  it("mantém o antes/depois em diff e o contexto nas colunas próprias", async () => {
    await logDataEvent({
      tenantId: "tenant-1",
      userId: "user-1",
      action: "updated",
      entityType: "Epic",
      entityId: "epic-1",
      diff: { titulo: { antes: "a", depois: "b" } },
      metadata: { origem: "kanban" },
      ipAddress: "203.0.113.9",
    });

    const d = gravado();
    // `diff` é o antes/depois da mutação — este continua sendo o lugar dele.
    expect(d.diff).toEqual({ titulo: { antes: "a", depois: "b" } });
    // E o contexto não se mistura mais com ele.
    expect(d.metadata).toEqual({ origem: "kanban" });
    expect(d.ipAddress).toBe("203.0.113.9");
  });
});

describe("logAdminEvent", () => {
  it("grava metadata em metadata — era o campo que a rota lia e vinha nulo", async () => {
    await logAdminEvent({
      action: "admin.impersonation.started",
      userId: "staff-1",
      tenantId: "tenant-1",
      targetUserId: "user-9",
      metadata: { motivo: "suporte ticket 42" },
    });

    const d = gravado();
    expect(d.metadata).toEqual({ motivo: "suporte ticket 42" });
    expect(d.targetUserId).toBe("user-9");
    expect(d.entityType).toBe("ADMIN_EVENT");
  });
});
