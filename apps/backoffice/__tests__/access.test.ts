// access.test.ts — leitura da trilha de acesso ao painel (FR-30) e
// observabilidade cruzada. A gravação da trilha mora em
// registro-de-acesso.test.ts.
//
// O que merece teste aqui:
//
// 1. Nenhuma export deste módulo grava a trilha sem sessão — export de
//    `"use server"` é RPC pública.
// 2. A visão cruzada não vaza credencial de integração, igual à aba por
//    tenant (NFR-1.7).
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  accessCreate: vi.fn(),
  accessFindMany: vi.fn(),
  integrationFindMany: vi.fn(),
  integrationCount: vi.fn(),
  auditFindMany: vi.fn(),
  tenantCount: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
  assertCanWrite: mocks.assertCanWrite,
  SYSTEM_TENANT_ID: "system",
  StaffAuthError: class extends Error {},
}));
// Nenhuma export lê headers() hoje; o mock fica para que uma action que volte
// a gravar sem sessão falhe abaixo por gravar, e não por falta de requisição.
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/database", () => ({
  database: {
    accessLog: { create: mocks.accessCreate, findMany: mocks.accessFindMany },
    integration: {
      findMany: mocks.integrationFindMany,
      count: mocks.integrationCount,
    },
    auditLog: { findMany: mocks.auditFindMany },
    tenant: { count: mocks.tenantCount },
  },
}));

import { listPlatformHealth } from "../app/actions/access";

function resetar() {
  for (const m of Object.values(mocks)) {
    m.mockReset();
  }
  mocks.requirePlatformStaff.mockResolvedValue({
    userId: "u-1",
    name: "V",
    email: "v@n.com",
    canWrite: false,
  });
  mocks.accessCreate.mockResolvedValue({ id: "al-1" });
  mocks.accessFindMany.mockResolvedValue([]);
  mocks.integrationFindMany.mockResolvedValue([]);
  mocks.integrationCount.mockResolvedValue(0);
  mocks.auditFindMany.mockResolvedValue([]);
  mocks.tenantCount.mockResolvedValue(0);
  mocks.headers.mockResolvedValue(new Map());
}

describe("trilha de acesso sem sessão", () => {
  beforeEach(resetar);

  // A falha de 2026-09-22: `registrarAcesso` era export deste módulo — RPC
  // pública — sem sessão nem teto, e qualquer um gravava "LOGIN de fulano"
  // com um POST. Quem grava a trilha agora é o servidor, no fluxo de login
  // (lib/registro-de-acesso.ts).
  it("nenhuma action deste módulo grava AccessLog, nem com payload forjado", async () => {
    mocks.requirePlatformStaff.mockRejectedValue(new Error("Sessão ausente."));
    const forjado = {
      email: "ceo@nebuloz.ai",
      evento: "LOGIN",
      userId: "u-ceo",
    };

    const actions: Record<string, unknown> = await import(
      "../app/actions/access"
    );
    for (const action of Object.values(actions)) {
      if (typeof action === "function") {
        await Promise.resolve(action(forjado)).catch(() => null);
      }
    }

    expect(mocks.accessCreate).not.toHaveBeenCalled();
  });
});

describe("listPlatformHealth", () => {
  beforeEach(resetar);

  it("é leitura de todo staff", async () => {
    const res = await listPlatformHealth();

    expect(res.ok).toBe(true);
    expect(mocks.assertCanWrite).not.toHaveBeenCalled();
  });

  it("NUNCA devolve a credencial da integração", async () => {
    mocks.integrationFindMany.mockResolvedValue([
      {
        id: "i-1",
        source: "github",
        name: "GitHub",
        status: "ERROR",
        lastSyncAt: new Date("2026-08-01T00:00:00.000Z"),
        tenant: { slug: "vanta", name: "Vanta" },
        syncLogs: [],
      },
    ]);

    const res = await listPlatformHealth();

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    const serializado = JSON.stringify(res.data);
    expect(serializado).not.toContain("config");
    expect(serializado).not.toContain("token");
    // O select precisa enumerar campos — findMany solto devolve `config`.
    expect(mocks.integrationFindMany.mock.calls[0][0].select).toBeDefined();
    expect(
      mocks.integrationFindMany.mock.calls[0][0].select.config
    ).toBeUndefined();
  });

  it("só traz integração que exige atenção", async () => {
    await listPlatformHealth();

    // A tela existe para mostrar o que está quebrado. Listar tudo faria o
    // operador procurar o problema no meio do que está funcionando.
    const where = mocks.integrationFindMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ["ERROR"] });
  });

  // A lista para em 50; o KPI "Integrações com erro" dizia 50 com 73
  // quebradas. A contagem é do banco, com o mesmo filtro da lista.
  it("conta as integrações com erro no banco, não na lista", async () => {
    mocks.integrationCount.mockResolvedValue(73);

    const res = await listPlatformHealth();

    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.data.integracoesComErro).toBe(73);
    expect(mocks.integrationCount).toHaveBeenCalledWith({
      where: mocks.integrationFindMany.mock.calls[0][0].where,
    });
  });

  // "Nome, fonte e erro de cada integração" — e a action nem selecionava o
  // erro. Vem do último SyncLog com erro, sem segredo.
  it("traz a última mensagem de erro, sem credencial", async () => {
    mocks.integrationFindMany.mockResolvedValue([
      {
        id: "i-1",
        source: "github",
        name: "GitHub",
        status: "ERROR",
        lastSyncAt: null,
        tenant: { slug: "vanta", name: "Vanta" },
        syncLogs: [
          {
            errors: {
              message:
                "401 Bad credentials for ghp_abcdefghijklmnopqrstuvwxyz0123456789",
            },
          },
        ],
      },
      {
        id: "i-2",
        source: "linear",
        name: "Linear",
        status: "ERROR",
        lastSyncAt: null,
        tenant: { slug: "atlas", name: "Atlas" },
        syncLogs: [],
      },
    ]);

    const res = await listPlatformHealth();

    if (!res.ok) {
      throw new Error(res.error);
    }
    const [comLog, semLog] = res.data.integracoes;
    expect(comLog.mensagem).toContain("401 Bad credentials");
    expect(comLog.mensagem).not.toContain("ghp_");
    // Sem log, admite que não há detalhe — nunca uma causa plausível.
    expect(semLog.mensagem).toMatch(/sem detalhe/);
    expect(mocks.integrationFindMany.mock.calls[0][0].select.syncLogs).toEqual({
      where: { status: "error" },
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { errors: true },
    });
  });
});
