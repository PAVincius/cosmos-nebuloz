import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  getEffectiveRole: vi.fn(),
  hasPermission: vi.fn(),
  auditLogCreate: vi.fn(),
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));

vi.mock("@repo/rbac", () => ({
  getEffectiveRole: mocks.getEffectiveRole,
  hasPermission: mocks.hasPermission,
}));

vi.mock("@repo/database", () => ({
  database: { auditLog: { create: mocks.auditLogCreate } },
}));

import { SecureActionError, withSecureAction } from "../secure-action";

const CTX = { userId: "user-1", tenantId: "tenant-1", role: "DEV" };
const HEADERS = new Headers();
const schema = z.object({ titulo: z.string().min(1) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireTenantSession.mockResolvedValue(CTX);
  mocks.getEffectiveRole.mockResolvedValue("DEV");
  mocks.hasPermission.mockReturnValue(true);
  mocks.auditLogCreate.mockResolvedValue({});
});

describe("autenticação", () => {
  it("vira UNAUTHORIZED quando a sessão falha", async () => {
    mocks.requireTenantSession.mockRejectedValue(new Error("sem sessão"));
    const action = withSecureAction({ schema, execute: vi.fn() });

    await expect(action({ titulo: "x" }, HEADERS)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("não executa nada quando não há sessão", async () => {
    mocks.requireTenantSession.mockRejectedValue(new Error("sem sessão"));
    const execute = vi.fn();

    await expect(
      withSecureAction({ schema, execute })({ titulo: "x" }, HEADERS)
    ).rejects.toThrow(SecureActionError);
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("autorização", () => {
  it("passa direto quando a ação não exige permissão", async () => {
    const execute = vi.fn().mockResolvedValue("ok");
    await withSecureAction({ schema, execute })({ titulo: "x" }, HEADERS);

    expect(mocks.getEffectiveRole).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalled();
  });

  it("resolve o papel efetivo no escopo do ART pedido", async () => {
    await withSecureAction({
      schema,
      requiredPermission: "epic:write",
      artId: "art-1",
      execute: vi.fn(),
    })({ titulo: "x" }, HEADERS);

    expect(mocks.getEffectiveRole).toHaveBeenCalledWith(
      "user-1",
      "tenant-1",
      "art-1"
    );
  });

  it("vira FORBIDDEN com o motivo quando falta permissão", async () => {
    mocks.hasPermission.mockReturnValue(false);
    mocks.getEffectiveRole.mockResolvedValue("MEMBER");

    const action = withSecureAction({
      schema,
      requiredPermission: "epic:write",
      execute: vi.fn(),
    });

    await expect(action({ titulo: "x" }, HEADERS)).rejects.toMatchObject({
      code: "FORBIDDEN",
      payload: {
        code: "INSUFFICIENT_ROLE",
        required: "epic:write",
        actual: "MEMBER",
      },
    });
  });

  it("não executa a ação quando a permissão é negada", async () => {
    mocks.hasPermission.mockReturnValue(false);
    const execute = vi.fn();

    await expect(
      withSecureAction({ schema, requiredPermission: "epic:write", execute })(
        { titulo: "x" },
        HEADERS
      )
    ).rejects.toThrow(SecureActionError);
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("trilha de auditoria da negativa", () => {
  it("registra authz.denied com recurso, permissão e papel", async () => {
    mocks.hasPermission.mockReturnValue(false);
    mocks.getEffectiveRole.mockResolvedValue("MEMBER");

    await withSecureAction({
      schema,
      requiredPermission: "budget:write",
      resource: "orcamento",
      execute: vi.fn(),
    })({ titulo: "x" }, HEADERS).catch(() => null);

    expect(mocks.auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        action: "authz.denied",
        actorId: "user-1",
        actorType: "user",
        metadata: {
          resource: "orcamento",
          requiredPermission: "budget:write",
          actualRole: "MEMBER",
        },
      }),
    });
  });

  it("usa 'unknown' quando o recurso não é informado", async () => {
    mocks.hasPermission.mockReturnValue(false);

    await withSecureAction({
      schema,
      requiredPermission: "budget:write",
      execute: vi.fn(),
    })({ titulo: "x" }, HEADERS).catch(() => null);

    expect(mocks.auditLogCreate.mock.calls[0][0].data.metadata.resource).toBe(
      "unknown"
    );
  });

  // Falha ao gravar auditoria não pode transformar um 403 em 500: o usuário
  // ainda tem de ser barrado, e com o erro certo.
  it("mantém o FORBIDDEN mesmo se a gravação da auditoria falhar", async () => {
    mocks.hasPermission.mockReturnValue(false);
    mocks.auditLogCreate.mockRejectedValue(new Error("banco fora"));

    await expect(
      withSecureAction({
        schema,
        requiredPermission: "budget:write",
        execute: vi.fn(),
      })({ titulo: "x" }, HEADERS)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("validação e execução", () => {
  it("valida a entrada e entrega o valor parseado", async () => {
    const execute = vi.fn().mockResolvedValue("feito");
    const result = await withSecureAction({ schema, execute })(
      { titulo: "épico", extra: "descartado" },
      HEADERS
    );

    expect(result).toBe("feito");
    expect(execute).toHaveBeenCalledWith({ titulo: "épico" }, CTX);
  });

  it("propaga o erro do schema quando a entrada é inválida", async () => {
    await expect(
      withSecureAction({ schema, execute: vi.fn() })({ titulo: "" }, HEADERS)
    ).rejects.toThrow();
  });

  // Ordem importa: a checagem de permissão vem antes do parse. Quem não pode
  // chamar a ação não deve descobrir o formato esperado da entrada.
  it("checa permissão antes de validar a entrada", async () => {
    mocks.hasPermission.mockReturnValue(false);

    await expect(
      withSecureAction({
        schema,
        requiredPermission: "epic:write",
        execute: vi.fn(),
      })({ entrada: "inválida" }, HEADERS)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("SecureActionError", () => {
  it("carrega nome, código e payload", () => {
    const e = new SecureActionError("FORBIDDEN", "sem acesso", {
      code: "INSUFFICIENT_ROLE",
      required: "epic:write",
      actual: "DEV",
    });

    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("SecureActionError");
    expect(e.code).toBe("FORBIDDEN");
    expect(e.payload?.actual).toBe("DEV");
  });
});
