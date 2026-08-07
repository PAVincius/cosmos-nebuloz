// accounts.test.ts — saúde de conta e renovação.
//
// Saúde é DERIVADA, não um campo marcado à mão. O que merece teste é o que a
// derivação decide, porque é isso que faz alguém pegar o telefone:
//
// 1. "Sem sinal" não é "OK". Cliente sobre o qual não há dado nenhum não é
//    saudável — é um cliente que ninguém está olhando. Colapsar os dois
//    esconderia exatamente a conta que mais precisa de atenção.
// 2. Todo veredito carrega o motivo. Badge vermelho sem razão não diz a
//    ninguém o que fazer em seguida.
// 3. Renovação vencida pesa mais que renovação próxima — uma já quebrou.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  tenantFindMany: vi.fn(),
  integrationFindMany: vi.fn(),
  auditFindMany: vi.fn(),
  auditGroupBy: vi.fn(),
}));

vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
  assertCanWrite: mocks.assertCanWrite,
  SYSTEM_TENANT_ID: "system",
  StaffAuthError: class extends Error {},
}));
vi.mock("@repo/database", () => ({
  database: {
    tenant: { findMany: mocks.tenantFindMany },
    integration: { findMany: mocks.integrationFindMany },
    auditLog: { findMany: mocks.auditFindMany, groupBy: mocks.auditGroupBy },
  },
}));

import { listAccountHealth } from "../app/actions/accounts";

/** Data fixa para os testes não dependerem do relógio de quem roda. */
const HOJE = new Date("2026-08-06T12:00:00.000Z");

function dias(n: number): Date {
  return new Date(HOJE.getTime() + n * 86_400_000);
}

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
  mocks.tenantFindMany.mockResolvedValue([]);
  mocks.integrationFindMany.mockResolvedValue([]);
  mocks.auditFindMany.mockResolvedValue([]);
  mocks.auditGroupBy.mockResolvedValue([]);
}

function tenant(over: Record<string, unknown> = {}) {
  return {
    id: "t-1",
    slug: "vanta",
    name: "Vanta",
    plan: "SCALE",
    modules: [],
    ...over,
  };
}

describe("listAccountHealth", () => {
  beforeEach(resetar);

  it("é leitura de todo staff", async () => {
    const res = await listAccountHealth(HOJE);

    expect(res.ok).toBe(true);
    expect(mocks.assertCanWrite).not.toHaveBeenCalled();
  });

  it("exclui o tenant interno", async () => {
    await listAccountHealth(HOJE);

    expect(mocks.tenantFindMany.mock.calls[0][0].where.isSystem).toBe(false);
  });

  it("cliente sem módulo nenhum é SEM_SINAL, não OK", async () => {
    mocks.tenantFindMany.mockResolvedValue([tenant()]);

    const res = await listAccountHealth(HOJE);

    if (!res.ok) {
      return;
    }
    // Não há dado sobre este cliente. Dizer "OK" daria confiança onde não há
    // informação.
    expect(res.data[0].saude).toBe("SEM_SINAL");
  });

  it("módulo ativo e nada errado é OK", async () => {
    mocks.tenantFindMany.mockResolvedValue([
      tenant({
        modules: [{ module: "COSMOS", status: "ACTIVE", expiresAt: dias(300) }],
      }),
    ]);
    mocks.auditGroupBy.mockResolvedValue([
      { tenantId: "t-1", _max: { createdAt: dias(-2) } },
    ]);

    const res = await listAccountHealth(HOJE);

    if (!res.ok) {
      return;
    }
    expect(res.data[0].saude).toBe("OK");
    expect(res.data[0].sinais).toHaveLength(0);
  });

  it("módulo suspenso é RISCO, com o motivo escrito", async () => {
    mocks.tenantFindMany.mockResolvedValue([
      tenant({
        modules: [
          { module: "COSMOS", status: "SUSPENDED", expiresAt: dias(300) },
        ],
      }),
    ]);
    mocks.auditGroupBy.mockResolvedValue([
      { tenantId: "t-1", _max: { createdAt: dias(-2) } },
    ]);

    const res = await listAccountHealth(HOJE);

    if (!res.ok) {
      return;
    }
    expect(res.data[0].saude).toBe("RISCO");
    // Badge vermelho sem razão não diz a ninguém o que fazer em seguida.
    expect(res.data[0].sinais[0].texto).toContain("COSMOS");
  });

  it("renovação vencida é RISCO; renovação próxima é ATENCAO", async () => {
    mocks.tenantFindMany.mockResolvedValue([
      tenant({
        id: "t-1",
        slug: "vencida",
        modules: [{ module: "COSMOS", status: "ACTIVE", expiresAt: dias(-5) }],
      }),
      tenant({
        id: "t-2",
        slug: "proxima",
        modules: [{ module: "COSMOS", status: "ACTIVE", expiresAt: dias(20) }],
      }),
    ]);
    mocks.auditGroupBy.mockResolvedValue([
      { tenantId: "t-1", _max: { createdAt: dias(-1) } },
      { tenantId: "t-2", _max: { createdAt: dias(-1) } },
    ]);

    const res = await listAccountHealth(HOJE);

    if (!res.ok) {
      return;
    }
    const vencida = res.data.find((c) => c.slug === "vencida");
    const proxima = res.data.find((c) => c.slug === "proxima");
    // Uma já quebrou, a outra ainda dá para resolver.
    expect(vencida?.saude).toBe("RISCO");
    expect(proxima?.saude).toBe("ATENCAO");
  });

  it("integração com erro entra como sinal", async () => {
    mocks.tenantFindMany.mockResolvedValue([
      tenant({
        modules: [{ module: "COSMOS", status: "ACTIVE", expiresAt: dias(300) }],
      }),
    ]);
    mocks.auditGroupBy.mockResolvedValue([
      { tenantId: "t-1", _max: { createdAt: dias(-1) } },
    ]);
    mocks.integrationFindMany.mockResolvedValue([
      { tenantId: "t-1", name: "GitHub", status: "ERROR" },
    ]);

    const res = await listAccountHealth(HOJE);

    if (!res.ok) {
      return;
    }
    expect(res.data[0].sinais.some((s) => s.texto.includes("GitHub"))).toBe(
      true
    );
  });

  it("silêncio prolongado vira sinal", async () => {
    mocks.tenantFindMany.mockResolvedValue([
      tenant({
        modules: [{ module: "COSMOS", status: "ACTIVE", expiresAt: dias(300) }],
      }),
    ]);
    // Última atividade há 90 dias.
    mocks.auditGroupBy.mockResolvedValue([
      { tenantId: "t-1", _max: { createdAt: dias(-90) } },
    ]);

    const res = await listAccountHealth(HOJE);

    if (!res.ok) {
      return;
    }
    expect(res.data[0].sinais.some((s) => s.texto.includes("90"))).toBe(true);
  });

  it("pior primeiro — a tela existe para achar quem precisa de telefonema", async () => {
    mocks.tenantFindMany.mockResolvedValue([
      tenant({
        id: "t-1",
        slug: "ok",
        modules: [{ module: "COSMOS", status: "ACTIVE", expiresAt: dias(300) }],
      }),
      tenant({
        id: "t-2",
        slug: "risco",
        modules: [
          { module: "COSMOS", status: "CANCELED", expiresAt: dias(300) },
        ],
      }),
    ]);
    mocks.auditGroupBy.mockResolvedValue([
      { tenantId: "t-1", _max: { createdAt: dias(-1) } },
      { tenantId: "t-2", _max: { createdAt: dias(-1) } },
    ]);

    const res = await listAccountHealth(HOJE);

    if (!res.ok) {
      return;
    }
    expect(res.data[0].slug).toBe("risco");
  });
});

describe("listAccountHealth — a leitura de atividade não pode depender de amostra", () => {
  beforeEach(resetar);

  it("agrega no banco, uma linha por cliente", async () => {
    // A versão anterior trazia os 2000 eventos mais recentes e reduzia em
    // memória. Com base pequena funcionava; passando de ~2000 eventos, os
    // clientes menos ativos sumiam da amostra, `ultimaPorTenant` devolvia
    // undefined, e o health afirmava SEM_SINAL sobre cliente ativo.
    //
    // O erro não era lentidão — era resposta errada, e silenciosa.
    await listAccountHealth(HOJE);

    expect(mocks.auditGroupBy).toHaveBeenCalled();
    const args = mocks.auditGroupBy.mock.calls[0][0];
    expect(args.by).toEqual(["tenantId"]);
    expect(args._max.createdAt).toBe(true);
  });

  it("não varre o AuditLog com take", async () => {
    // Aumentar o take só adiaria o dia em que a tela volta a mentir, e adiaria
    // sem aviso nenhum.
    await listAccountHealth(HOJE);

    expect(mocks.auditFindMany).not.toHaveBeenCalled();
  });

  it("cliente ausente da agregação é cliente sem atividade nenhuma", async () => {
    // Agora "não veio na resposta" e "nunca teve atividade" são a mesma coisa,
    // e isso é verdade — antes, "não coube na amostra" também caía aqui.
    mocks.tenantFindMany.mockResolvedValue([
      tenant({
        modules: [{ module: "COSMOS", status: "ACTIVE", expiresAt: dias(300) }],
      }),
    ]);
    mocks.auditGroupBy.mockResolvedValue([]);

    const res = await listAccountHealth(HOJE);

    if (!res.ok) {
      return;
    }
    expect(res.data[0].ultimaAtividade).toBeNull();
  });

  it("usa a data agregada de cada cliente", async () => {
    mocks.tenantFindMany.mockResolvedValue([
      tenant({
        modules: [{ module: "COSMOS", status: "ACTIVE", expiresAt: dias(300) }],
      }),
    ]);
    mocks.auditGroupBy.mockResolvedValue([
      { tenantId: "t-1", _max: { createdAt: dias(-3) } },
    ]);

    const res = await listAccountHealth(HOJE);

    if (!res.ok) {
      return;
    }
    expect(res.data[0].ultimaAtividade).toBe(dias(-3).toISOString());
  });
});
