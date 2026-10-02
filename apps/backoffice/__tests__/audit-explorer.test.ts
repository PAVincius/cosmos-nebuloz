// audit-explorer.test.ts — busca cross-tenant sobre o AuditLog (FR-10.3).
//
// A diferença desta tela para a aba Auditoria de um cliente é o escopo: lá o
// `tenantId` é fixo, aqui ele é FILTRO. Isso muda o que precisa de teste:
//
// 1. Sem filtro de tenant, a consulta atravessa todos — é o ponto da tela, e
//    também o que a torna a única do painel que lê dado de vários clientes de
//    uma vez. Um `where` mal montado aqui vaza para quem não devia ver.
// 2. Paginação com teto: o AuditLog cresce sem parar e uma tela sem limite
//    fica lenta silenciosamente, primeiro em produção.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  tenantFindMany: vi.fn(),
}));

vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
  assertCanWrite: mocks.assertCanWrite,
  SYSTEM_TENANT_ID: "system",
  StaffAuthError: class extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));
vi.mock("@repo/database", () => ({
  database: {
    auditLog: { findMany: mocks.findMany, count: mocks.count },
    tenant: { findMany: mocks.tenantFindMany },
  },
}));

import { listAuditEvents, listAuditTenants } from "../app/actions/audit";

const staff = {
  userId: "u-1",
  name: "Vinícius",
  email: "v@nebuloz.ai",
  canWrite: false,
};

function resetar() {
  for (const m of Object.values(mocks)) {
    m.mockReset();
  }
  mocks.requirePlatformStaff.mockResolvedValue(staff);
  mocks.findMany.mockResolvedValue([]);
  mocks.count.mockResolvedValue(0);
  mocks.tenantFindMany.mockResolvedValue([]);
}

describe("listAuditEvents", () => {
  beforeEach(resetar);

  it("é leitura de todo staff — não chama assertCanWrite", async () => {
    const res = await listAuditEvents({});

    expect(res.ok).toBe(true);
    expect(mocks.assertCanWrite).not.toHaveBeenCalled();
  });

  it("sem filtro de tenant, não restringe tenantId — é uma busca cross-tenant", async () => {
    await listAuditEvents({});

    const args = mocks.findMany.mock.calls[0][0];
    expect(args.where.tenantId).toBeUndefined();
  });

  it("com tenant escolhido, restringe a ele", async () => {
    await listAuditEvents({ tenantId: "t-1" });

    expect(mocks.findMany.mock.calls[0][0].where.tenantId).toBe("t-1");
  });

  it("filtra por ação e por tipo de entidade", async () => {
    await listAuditEvents({ action: "updated", entityType: "tenant_member" });

    const { where } = mocks.findMany.mock.calls[0][0];
    expect(where.action).toBe("updated");
    expect(where.entityType).toBe("tenant_member");
  });

  it("período vira intervalo em createdAt", async () => {
    await listAuditEvents({ de: "2026-08-01", ate: "2026-08-05" });

    const { where } = mocks.findMany.mock.calls[0][0];
    expect(where.createdAt.gte).toBeInstanceOf(Date);
    expect(where.createdAt.lte).toBeInstanceOf(Date);
    // O fim do período inclui o dia inteiro: filtrar "até 05/08" e perder o que
    // aconteceu às 14h do dia 5 é o tipo de corte que ninguém percebe.
    expect(where.createdAt.lte.getHours()).toBe(23);
  });

  it("respeita o teto de página mesmo quando pedem mais", async () => {
    await listAuditEvents({ porPagina: 5000 });

    expect(mocks.findMany.mock.calls[0][0].take).toBeLessThanOrEqual(200);
  });

  it("devolve o total para a paginação saber quantas páginas existem", async () => {
    mocks.count.mockResolvedValue(742);

    const res = await listAuditEvents({});

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.total).toBe(742);
  });

  it("página 3 pula as duas anteriores", async () => {
    await listAuditEvents({ pagina: 3, porPagina: 50 });

    expect(mocks.findMany.mock.calls[0][0].skip).toBe(100);
  });

  it("mais recentes primeiro", async () => {
    await listAuditEvents({});

    expect(mocks.findMany.mock.calls[0][0].orderBy).toEqual({
      createdAt: "desc",
    });
  });

  it("marca explicitamente o evento sem diff", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "a-1",
        action: "created",
        entityType: "tenant",
        entityId: "t-1",
        diff: null,
        metadata: {},
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        tenant: { slug: "vanta-saude", name: "Vanta" },
      },
    ]);

    const res = await listAuditEvents({});

    if (!res.ok) {
      return;
    }
    expect(res.data.eventos[0].semDiff).toBe(true);
  });
});

describe("listAuditTenants", () => {
  beforeEach(resetar);

  it("exclui o tenant interno da lista de filtro", async () => {
    await listAuditTenants();

    // O tenant `system` não é cliente; deixá-lo no seletor faria o operador
    // filtrar por algo que não é uma empresa.
    expect(mocks.tenantFindMany.mock.calls[0][0].where.isSystem).toBe(false);
  });
});
