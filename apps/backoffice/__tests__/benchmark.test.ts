// benchmark.test.ts — comparação entre clientes e entre serviços.
//
// Não tem entidade própria: agrega Engagement, Proposal e Service. O que
// merece teste aqui é o que a agregação DECIDE contar, porque é isso que muda
// a conclusão de quem lê:
//
// 1. Cancelado e recusado não entram na receita. Somar contrato cancelado
//    infla o número e faz a comparação mentir a favor de quem mais cancelou.
// 2. Cliente sem engajamento aparece com zero, não some. Um cliente que não
//    comprou nada é justamente o achado que a tela existe para mostrar.
// 3. Ticket médio não divide por zero.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  tenantFindMany: vi.fn(),
  engagementFindMany: vi.fn(),
  proposalFindMany: vi.fn(),
  serviceFindMany: vi.fn(),
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
    engagement: { findMany: mocks.engagementFindMany },
    proposal: { findMany: mocks.proposalFindMany },
    service: { findMany: mocks.serviceFindMany },
  },
}));

import { listBenchmark } from "../app/actions/benchmark";

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
  mocks.engagementFindMany.mockResolvedValue([]);
  mocks.proposalFindMany.mockResolvedValue([]);
  mocks.serviceFindMany.mockResolvedValue([]);
}

const CLIENTES = [
  { id: "t-1", slug: "vanta", name: "Vanta" },
  { id: "t-2", slug: "orbital", name: "Orbital" },
];

describe("listBenchmark", () => {
  beforeEach(resetar);

  it("é leitura de todo staff", async () => {
    const res = await listBenchmark();

    expect(res.ok).toBe(true);
    expect(mocks.assertCanWrite).not.toHaveBeenCalled();
  });

  it("exclui o tenant interno da comparação", async () => {
    await listBenchmark();

    expect(mocks.tenantFindMany.mock.calls[0][0].where.isSystem).toBe(false);
  });

  it("cliente sem engajamento aparece com zero", async () => {
    mocks.tenantFindMany.mockResolvedValue(CLIENTES);

    const res = await listBenchmark();

    if (!res.ok) {
      return;
    }
    // Sumir com quem não comprou esconderia justamente o achado.
    expect(res.data.clientes).toHaveLength(2);
    expect(res.data.clientes[0].engajamentos).toBe(0);
    expect(res.data.clientes[0].receitaCentavos).toBe(0);
  });

  it("cancelado não entra na receita", async () => {
    mocks.tenantFindMany.mockResolvedValue(CLIENTES);
    mocks.engagementFindMany.mockResolvedValue([
      {
        clienteTenantId: "t-1",
        status: "ATIVO",
        valorCentavos: 100_000,
        serviceId: "s-1",
      },
      {
        clienteTenantId: "t-1",
        status: "CANCELADO",
        valorCentavos: 900_000,
        serviceId: "s-1",
      },
    ]);

    const res = await listBenchmark();

    if (!res.ok) {
      return;
    }
    const vanta = res.data.clientes.find((c) => c.slug === "vanta");
    // Somar cancelado infla o número e faz a comparação mentir a favor de
    // quem mais cancelou.
    expect(vanta?.receitaCentavos).toBe(100_000);
    expect(vanta?.engajamentos).toBe(1);
  });

  it("ticket médio é a receita dividida pelos engajamentos que contaram", async () => {
    mocks.tenantFindMany.mockResolvedValue(CLIENTES);
    mocks.engagementFindMany.mockResolvedValue([
      {
        clienteTenantId: "t-1",
        status: "ATIVO",
        valorCentavos: 100_000,
        serviceId: "s-1",
      },
      {
        clienteTenantId: "t-1",
        status: "CONCLUIDO",
        valorCentavos: 200_000,
        serviceId: "s-1",
      },
    ]);

    const res = await listBenchmark();

    if (!res.ok) {
      return;
    }
    expect(
      res.data.clientes.find((c) => c.slug === "vanta")?.ticketCentavos
    ).toBe(150_000);
  });

  it("ticket médio de quem não tem engajamento é zero, não NaN", async () => {
    mocks.tenantFindMany.mockResolvedValue(CLIENTES);

    const res = await listBenchmark();

    if (!res.ok) {
      return;
    }
    expect(res.data.clientes[0].ticketCentavos).toBe(0);
    expect(Number.isNaN(res.data.clientes[0].ticketCentavos)).toBe(false);
  });

  it("desconto médio ignora proposta recusada", async () => {
    mocks.tenantFindMany.mockResolvedValue(CLIENTES);
    mocks.proposalFindMany.mockResolvedValue([
      { clienteTenantId: "t-1", status: "ACEITA", descontoPercent: 10 },
      { clienteTenantId: "t-1", status: "RECUSADA", descontoPercent: 90 },
    ]);

    const res = await listBenchmark();

    if (!res.ok) {
      return;
    }
    // Proposta recusada não virou negócio; incluí-la descreveria o que a
    // Nebuloz OFERECEU, não o que ela praticou.
    expect(
      res.data.clientes.find((c) => c.slug === "vanta")?.descontoMedio
    ).toBe(10);
  });

  it("conta quantos engajamentos cada serviço gerou", async () => {
    mocks.serviceFindMany.mockResolvedValue([
      { id: "s-1", codigo: "SV-09", nome: "Fine-tune" },
    ]);
    mocks.engagementFindMany.mockResolvedValue([
      {
        clienteTenantId: "t-1",
        status: "ATIVO",
        valorCentavos: 100_000,
        serviceId: "s-1",
      },
      {
        clienteTenantId: "t-2",
        status: "ATIVO",
        valorCentavos: 50_000,
        serviceId: "s-1",
      },
    ]);

    const res = await listBenchmark();

    if (!res.ok) {
      return;
    }
    expect(res.data.servicos[0].engajamentos).toBe(2);
    expect(res.data.servicos[0].receitaCentavos).toBe(150_000);
  });
});
