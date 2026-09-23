// access.test.ts — registro de acesso ao painel (FR-30) e observabilidade
// cruzada.
//
// O que merece teste aqui:
//
// 1. Tentativa RECUSADA é registrada. Uma trilha que só guarda quem entrou
//    responde "quem usou o painel" e não responde "quem tentou" — que é a
//    pergunta de segurança.
// 2. O registro NÃO derruba o login. Se gravar a trilha falhar, a pessoa
//    ainda entra: auditoria que bloqueia autenticação transforma um problema
//    de log num incidente de acesso.
// 3. A visão cruzada não vaza credencial de integração, igual à aba por
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

import { listPlatformHealth, registrarAcesso } from "../app/actions/access";

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

describe("registrarAcesso", () => {
  beforeEach(resetar);

  it("grava o login", async () => {
    await registrarAcesso({ email: "ana@nebuloz.com", evento: "LOGIN" });

    expect(mocks.accessCreate).toHaveBeenCalled();
    expect(mocks.accessCreate.mock.calls[0][0].data.evento).toBe("LOGIN");
  });

  it("grava a tentativa recusada com o motivo", async () => {
    await registrarAcesso({
      email: "estranho@fora.com",
      evento: "RECUSADO",
      motivo: "não é membro do tenant system",
    });

    const d = mocks.accessCreate.mock.calls[0][0].data;
    // Sem a recusa, a trilha responde "quem usou" e não "quem tentou" — que é
    // a pergunta de segurança.
    expect(d.evento).toBe("RECUSADO");
    expect(d.motivo).toContain("membro");
  });

  it("normaliza o e-mail — trilha com maiúscula e minúscula separa a mesma pessoa", async () => {
    await registrarAcesso({ email: "  Ana@Nebuloz.COM ", evento: "LOGIN" });

    expect(mocks.accessCreate.mock.calls[0][0].data.email).toBe(
      "ana@nebuloz.com"
    );
  });

  it("NÃO derruba o login quando gravar falha", async () => {
    mocks.accessCreate.mockRejectedValue(new Error("banco fora"));

    // Auditoria que bloqueia autenticação transforma problema de log em
    // incidente de acesso.
    await expect(
      registrarAcesso({ email: "ana@nebuloz.com", evento: "LOGIN" })
    ).resolves.toBeUndefined();
  });

  it("não exige sessão — o login ainda não aconteceu quando isso roda", async () => {
    await registrarAcesso({ email: "ana@nebuloz.com", evento: "RECUSADO" });

    expect(mocks.requirePlatformStaff).not.toHaveBeenCalled();
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
