// scaffold.test.ts — ADR-0014: a ligação entre a promoção do Meridian e o
// Engagement que a entrega.
//
// Três invariantes carregam esta suíte:
//
// 1. A fila só mostra o que ainda não aterrissou: `targetEntityId: null` e
//    `revokedAt: null`. Materializada ou revogada não aparece de novo.
// 2. Um engajamento tem um cliente só — promoções de clientes diferentes na
//    mesma chamada são recusadas antes de qualquer escrita.
// 3. O vínculo de volta (`targetEntityId`) é gravado via `withTenantDb`, no
//    tenant do cliente — nunca via `platformDb`, que é só leitura aqui.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  logPlatformAudit: vi.fn(),
  promotionFindMany: vi.fn(),
  serviceFindFirst: vi.fn(),
  engagementCreate: vi.fn(),
  engagementDelete: vi.fn(),
  withTenantDb: vi.fn(),
  updateMany: vi.fn(),
  revalidatePath: vi.fn(),
  logError: vi.fn(),
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
vi.mock("@repo/provisioning", () => ({
  platformDb: {
    meridianGapPromotion: { findMany: mocks.promotionFindMany },
  },
  logPlatformAudit: mocks.logPlatformAudit,
  ProvisioningError: class extends Error {},
}));
vi.mock("@repo/database", () => ({
  database: {
    service: { findFirst: mocks.serviceFindFirst },
    engagement: {
      create: mocks.engagementCreate,
      delete: mocks.engagementDelete,
    },
  },
  withTenantDb: mocks.withTenantDb,
}));
vi.mock("@repo/observability/log", () => ({
  log: { error: mocks.logError },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  listarPromocoesPendentes,
  materializarEngajamento,
} from "../app/actions/scaffold";

const staff = {
  userId: "u-1",
  name: "Vinícius",
  email: "v@nebuloz.ai",
  canWrite: true,
};

const P1 = {
  id: "p-1",
  tenantId: "t-cliente-a",
  targetProduct: "SCAFFOLD",
  targetEntityId: null,
  revokedAt: null,
  promotedAt: new Date("2026-08-01"),
  gap: { code: "G-01" },
  tenant: { id: "t-cliente-a", isSystem: false, name: "Cliente A" },
};

const P2 = {
  ...P1,
  id: "p-2",
  gap: { code: "G-02" },
};

function resetar() {
  for (const m of Object.values(mocks)) {
    m.mockReset();
  }
  mocks.requirePlatformStaff.mockResolvedValue(staff);
  mocks.withTenantDb.mockImplementation(
    async (_tenantId: string, fn: (db: unknown) => Promise<unknown>) =>
      await fn({ meridianGapPromotion: { updateMany: mocks.updateMany } })
  );
}

describe("listarPromocoesPendentes", () => {
  beforeEach(resetar);

  it("é leitura de todo staff", async () => {
    mocks.promotionFindMany.mockResolvedValue([]);

    const res = await listarPromocoesPendentes();

    expect(res.ok).toBe(true);
    expect(mocks.assertCanWrite).not.toHaveBeenCalled();
  });

  it("consulta só o que está pendente — nulo em targetEntityId e revokedAt, cliente de verdade", async () => {
    mocks.promotionFindMany.mockResolvedValue([]);

    await listarPromocoesPendentes();

    const args = mocks.promotionFindMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(args.where).toMatchObject({
      targetProduct: "SCAFFOLD",
      targetEntityId: null,
      revokedAt: null,
      tenant: { isSystem: false },
    });
  });

  it("agrupa por cliente", async () => {
    mocks.promotionFindMany.mockResolvedValue([
      {
        ...P1,
        gap: {
          code: "G-01",
          statement: "s",
          severity: "HIGH",
          effort: "S",
          costOfDelay: 10,
        },
        tenant: { id: "t-cliente-a", name: "Cliente A", slug: "cliente-a" },
      },
      {
        ...P2,
        gap: {
          code: "G-02",
          statement: "s",
          severity: "LOW",
          effort: "M",
          costOfDelay: 5,
        },
        tenant: { id: "t-cliente-a", name: "Cliente A", slug: "cliente-a" },
      },
    ]);

    const res = await listarPromocoesPendentes();

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toHaveLength(1);
      expect(res.data[0].promocoes).toHaveLength(2);
    }
  });
});

const INPUT_BASE = {
  promotionIds: ["p-1", "p-2"],
  nome: "Programa de correção",
  valorCentavos: 500_000,
};

describe("materializarEngajamento", () => {
  beforeEach(resetar);

  it("MEMBER não materializa", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });

    const res = await materializarEngajamento(INPUT_BASE);

    expect(res.ok).toBe(false);
    expect(mocks.engagementCreate).not.toHaveBeenCalled();
  });

  it("recusa promoções de clientes diferentes, sem escrever nada", async () => {
    mocks.promotionFindMany.mockResolvedValue([
      P1,
      {
        ...P2,
        tenantId: "t-cliente-b",
        tenant: { ...P1.tenant, id: "t-cliente-b", isSystem: false },
      },
    ]);

    const res = await materializarEngajamento(INPUT_BASE);

    expect(res.ok).toBe(false);
    expect(mocks.engagementCreate).not.toHaveBeenCalled();
    expect(mocks.withTenantDb).not.toHaveBeenCalled();
  });

  it("recusa quando uma promoção não está mais pendente", async () => {
    mocks.promotionFindMany.mockResolvedValue([P1]); // só achou 1 das 2 pedidas

    const res = await materializarEngajamento(INPUT_BASE);

    expect(res.ok).toBe(false);
    expect(mocks.engagementCreate).not.toHaveBeenCalled();
  });

  it("cria o engajamento e grava targetEntityId em todas as promoções selecionadas, via withTenantDb do cliente", async () => {
    mocks.promotionFindMany.mockResolvedValue([P1, P2]);
    mocks.engagementCreate.mockResolvedValue({ id: "e-1", codigo: "ENG-X" });
    mocks.updateMany.mockResolvedValue({ count: 2 });

    const res = await materializarEngajamento(INPUT_BASE);

    expect(res.ok).toBe(true);
    expect(mocks.engagementCreate.mock.calls[0][0].data).toMatchObject({
      tenantId: "system",
      clienteTenantId: "t-cliente-a",
      status: "PROPOSTO",
      valorCentavos: 500_000,
    });
    expect(mocks.withTenantDb.mock.calls[0][0]).toBe("t-cliente-a");
    expect(mocks.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: { in: ["p-1", "p-2"] } },
      data: { targetEntityId: "e-1" },
    });
    expect(mocks.engagementDelete).not.toHaveBeenCalled();
  });

  it("compensa apagando o engajamento quando o vínculo falha, e propaga o erro original", async () => {
    mocks.promotionFindMany.mockResolvedValue([P1, P2]);
    mocks.engagementCreate.mockResolvedValue({ id: "e-1", codigo: "ENG-X" });
    mocks.updateMany.mockRejectedValue(new Error("conexão caiu"));
    mocks.engagementDelete.mockResolvedValue({});

    const res = await materializarEngajamento(INPUT_BASE);

    expect(res.ok).toBe(false);
    expect(mocks.engagementDelete).toHaveBeenCalledWith({
      where: { id: "e-1" },
    });
  });

  it("recusa serviço fora do catálogo ativo", async () => {
    mocks.promotionFindMany.mockResolvedValue([P1, P2]);
    mocks.serviceFindFirst.mockResolvedValue(null);

    const res = await materializarEngajamento({
      ...INPUT_BASE,
      serviceId: "s-inexistente",
    });

    expect(res.ok).toBe(false);
    expect(mocks.engagementCreate).not.toHaveBeenCalled();
  });
});
