// busca-no-servidor-actions.test.ts — a busca que acha quem está na página 2.
//
// A busca da carteira e a de propostas filtravam só o que já estava no
// navegador: com 140 clientes, o 101º não aparecia para busca nenhuma. O
// filtro agora é opcional nas próprias leituras de lista — mesma forma de
// linha, mesma paginação — e a chamada sem ele continua como era.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  tenantFindMany: vi.fn(),
  proposalFindMany: vi.fn(),
}));

vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
  assertCanWrite: vi.fn(),
  SYSTEM_TENANT_ID: "system",
  StaffAuthError: class extends Error {},
}));
vi.mock("@repo/provisioning", () => ({
  logPlatformAudit: vi.fn(),
  ProvisioningError: class extends Error {},
  platformDb: { tenant: { findMany: mocks.tenantFindMany } },
}));
vi.mock("@/lib/comercial", () => ({
  gerarNumeroProposta: vi.fn(),
  LIMITE_DESCONTO_SEM_APROVACAO: 15,
}));
vi.mock("@/app/actions/approvals", () => ({
  requestPlatformApproval: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/database", () => ({
  database: { proposal: { findMany: mocks.proposalFindMany } },
}));

import { listClients } from "../app/actions/clients";
import { listProposals } from "../app/actions/proposals";

beforeEach(() => {
  for (const m of Object.values(mocks)) {
    m.mockReset();
  }
  mocks.requirePlatformStaff.mockResolvedValue({ userId: "u-1" });
  mocks.tenantFindMany.mockResolvedValue([]);
  mocks.proposalFindMany.mockResolvedValue([]);
});

describe("listClients — filtro no servidor", () => {
  it("sem filtro, o where de sempre", async () => {
    const res = await listClients();

    expect(res).toEqual({ ok: true, data: [] });
    expect(mocks.tenantFindMany.mock.calls[0][0].where).toEqual({
      isSystem: false,
    });
  });

  it("com busca, procura por nome (sem caixa) ou slug, fora o tenant interno", async () => {
    const res = await listClients({ busca: "  Zeta ", pagina: 1 });

    expect(res).toEqual({ ok: true, data: { itens: [], temMais: false } });
    expect(mocks.tenantFindMany.mock.calls[0][0].where).toEqual({
      isSystem: false,
      OR: [
        { name: { contains: "Zeta", mode: "insensitive" } },
        { slug: { contains: "zeta" } },
      ],
    });
  });

  it("com atenção, só quem tem módulo suspenso — o mesmo corte do KPI", async () => {
    await listClients({ atencao: true, pagina: 2 });

    const args = mocks.tenantFindMany.mock.calls[0][0];
    expect(args.where).toEqual({
      isSystem: false,
      modules: { some: { status: "SUSPENDED" } },
    });
    expect(args.skip).toBe(100);
  });

  it("busca longa demais é recusada antes do banco", async () => {
    const res = await listClients({ busca: "x".repeat(81) });

    expect(res.ok).toBe(false);
    expect(mocks.tenantFindMany).not.toHaveBeenCalled();
  });
});

describe("listProposals — ?q= no servidor", () => {
  it("sem busca, o where de sempre", async () => {
    await listProposals();

    expect(mocks.proposalFindMany.mock.calls[0][0].where).toEqual({
      tenantId: "system",
    });
  });

  it("com busca, procura por título ou cliente, sem caixa", async () => {
    const res = await listProposals({ busca: "atlas", pagina: 1 });

    expect(res).toEqual({ ok: true, data: { itens: [], temMais: false } });
    expect(mocks.proposalFindMany.mock.calls[0][0].where).toEqual({
      tenantId: "system",
      OR: [
        { titulo: { contains: "atlas", mode: "insensitive" } },
        { clienteNome: { contains: "atlas", mode: "insensitive" } },
      ],
    });
  });

  it("busca só de espaço é busca nenhuma", async () => {
    await listProposals({ busca: "   ", pagina: 1 });

    expect(mocks.proposalFindMany.mock.calls[0][0].where).toEqual({
      tenantId: "system",
    });
  });
});
