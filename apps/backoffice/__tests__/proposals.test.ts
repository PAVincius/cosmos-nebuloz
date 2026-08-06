// proposals.test.ts — propostas comerciais e o gate de desconto.
//
// A regra que carrega esta action é o gate de 15%: acima disso a proposta NÃO
// é enviada no clique, ela entra na fila de PlatformApproval. Um gate que o
// código contorna é pior que gate nenhum, porque cria a sensação de controle
// sem o controle.
//
// O segundo invariante é o total: ele é congelado no envio, não recalculado na
// leitura. Preço de catálogo muda, e uma proposta que muda de valor sozinha
// depois de enviada é problema contratual, não detalhe de exibição.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  logPlatformAudit: vi.fn(),
  requestPlatformApproval: vi.fn(),
  proposalFindMany: vi.fn(),
  proposalFindFirst: vi.fn(),
  proposalCreate: vi.fn(),
  proposalUpdate: vi.fn(),
  serviceFindMany: vi.fn(),
  itemCreateMany: vi.fn(),
  transaction: vi.fn(),
  revalidatePath: vi.fn(),
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
  logPlatformAudit: mocks.logPlatformAudit,
  ProvisioningError: class extends Error {},
}));
vi.mock("@/app/actions/approvals", () => ({
  requestPlatformApproval: mocks.requestPlatformApproval,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/database", () => ({
  database: {
    proposal: {
      findMany: mocks.proposalFindMany,
      findFirst: mocks.proposalFindFirst,
      create: mocks.proposalCreate,
      update: mocks.proposalUpdate,
    },
    service: { findMany: mocks.serviceFindMany },
    proposalItem: { createMany: mocks.itemCreateMany },
    $transaction: mocks.transaction,
  },
}));

import {
  createProposalAction,
  submitProposalAction,
} from "../app/actions/proposals";
import { LIMITE_DESCONTO_SEM_APROVACAO } from "../lib/comercial";

const staff = {
  userId: "u-1",
  name: "Vinícius",
  email: "v@nebuloz.com",
  canWrite: true,
};

function resetar() {
  for (const m of Object.values(mocks)) {
    m.mockReset();
  }
  mocks.requirePlatformStaff.mockResolvedValue(staff);
  mocks.proposalFindMany.mockResolvedValue([]);
  mocks.requestPlatformApproval.mockResolvedValue({
    ok: true,
    data: { id: "ap-1" },
  });
  mocks.transaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) =>
      await fn({
        proposal: { create: mocks.proposalCreate },
        proposalItem: { createMany: mocks.itemCreateMany },
      })
  );
}

describe("createProposalAction", () => {
  beforeEach(resetar);

  it("MEMBER não cria", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });

    const res = await createProposalAction({
      titulo: "Piloto",
      itens: [{ serviceId: "s-1", quantidade: 1 }],
    });

    expect(res.ok).toBe(false);
  });

  it("soma o total a partir dos itens, com quantidade", async () => {
    mocks.serviceFindMany.mockResolvedValue([
      { id: "s-1", nome: "Fine-tune", precoBaseCentavos: 125_000, ativo: true },
      { id: "s-2", nome: "Suporte", precoBaseCentavos: 30_000, ativo: true },
    ]);
    mocks.proposalCreate.mockResolvedValue({ id: "p-1", numero: "P-0001" });

    await createProposalAction({
      titulo: "Piloto",
      itens: [
        { serviceId: "s-1", quantidade: 1 },
        { serviceId: "s-2", quantidade: 3 },
      ],
    });

    // 125000 + 3×30000 = 215000
    expect(mocks.proposalCreate.mock.calls[0][0].data.totalCentavos).toBe(
      215_000
    );
  });

  it("aplica o desconto sobre a soma", async () => {
    mocks.serviceFindMany.mockResolvedValue([
      { id: "s-1", nome: "X", precoBaseCentavos: 100_000, ativo: true },
    ]);
    mocks.proposalCreate.mockResolvedValue({ id: "p-1", numero: "P-0001" });

    await createProposalAction({
      titulo: "Piloto",
      descontoPercent: 10,
      itens: [{ serviceId: "s-1", quantidade: 1 }],
    });

    expect(mocks.proposalCreate.mock.calls[0][0].data.totalCentavos).toBe(
      90_000
    );
  });

  it("copia descrição e preço do serviço para o item", async () => {
    mocks.serviceFindMany.mockResolvedValue([
      { id: "s-1", nome: "Fine-tune", precoBaseCentavos: 125_000, ativo: true },
    ]);
    mocks.proposalCreate.mockResolvedValue({ id: "p-1", numero: "P-0001" });

    await createProposalAction({
      titulo: "Piloto",
      itens: [{ serviceId: "s-1", quantidade: 2 }],
    });

    // Cópia, não referência: o preço do catálogo muda, e reler dali faria uma
    // proposta assinada mudar de valor retroativamente.
    const [linha] = mocks.itemCreateMany.mock.calls[0][0].data;
    expect(linha.descricao).toBe("Fine-tune");
    expect(linha.precoUnitCentavos).toBe(125_000);
  });

  it("recusa item de serviço fora do catálogo", async () => {
    mocks.serviceFindMany.mockResolvedValue([]);

    const res = await createProposalAction({
      titulo: "Piloto",
      itens: [{ serviceId: "inexistente", quantidade: 1 }],
    });

    expect(res.ok).toBe(false);
    expect(mocks.proposalCreate).not.toHaveBeenCalled();
  });

  it("recusa proposta sem item — proposta vazia não tem o que aprovar", async () => {
    const res = await createProposalAction({ titulo: "Piloto", itens: [] });

    expect(res.ok).toBe(false);
  });
});

describe("submitProposalAction — o gate de desconto", () => {
  beforeEach(resetar);

  function propostaCom(descontoPercent: number) {
    mocks.proposalFindFirst.mockResolvedValue({
      id: "p-1",
      numero: "P-0001",
      titulo: "Piloto",
      status: "RASCUNHO",
      descontoPercent,
      totalCentavos: 100_000,
      clienteNome: "Vanta",
      clienteTenantId: null,
    });
    mocks.proposalUpdate.mockResolvedValue({ id: "p-1" });
  }

  it(`desconto até ${LIMITE_DESCONTO_SEM_APROVACAO}% envia direto`, async () => {
    propostaCom(LIMITE_DESCONTO_SEM_APROVACAO);

    const res = await submitProposalAction({ id: "p-1" });

    expect(res.ok).toBe(true);
    expect(mocks.proposalUpdate.mock.calls[0][0].data.status).toBe("ENVIADA");
    expect(mocks.requestPlatformApproval).not.toHaveBeenCalled();
  });

  it("acima do limite NÃO envia — entra na fila de aprovação", async () => {
    propostaCom(LIMITE_DESCONTO_SEM_APROVACAO + 1);

    const res = await submitProposalAction({ id: "p-1" });

    expect(res.ok).toBe(true);
    // O ponto do gate: o status vai para espera, não para enviada.
    expect(mocks.proposalUpdate.mock.calls[0][0].data.status).toBe(
      "AGUARDANDO_APROVACAO"
    );
    expect(mocks.requestPlatformApproval).toHaveBeenCalled();
  });

  it("o pedido de aprovação carrega motivo e impacto, não só o id", async () => {
    propostaCom(40);

    await submitProposalAction({ id: "p-1" });

    const pedido = mocks.requestPlatformApproval.mock.calls[0][0];
    expect(pedido.alvoTipo).toBe("proposal");
    // FR-8.2: quem aprova precisa do contexto na própria linha da fila.
    expect(pedido.motivo.length).toBeGreaterThan(10);
    expect(pedido.impacto).toContain("40");
  });

  it("proposta já enviada não é enviada de novo", async () => {
    mocks.proposalFindFirst.mockResolvedValue({
      id: "p-1",
      numero: "P-0001",
      titulo: "Piloto",
      status: "ENVIADA",
      descontoPercent: 0,
      totalCentavos: 100_000,
      clienteNome: "Vanta",
      clienteTenantId: null,
    });

    const res = await submitProposalAction({ id: "p-1" });

    expect(res.ok).toBe(false);
    expect(mocks.proposalUpdate).not.toHaveBeenCalled();
  });

  it("recusa proposta de outro tenant", async () => {
    mocks.proposalFindFirst.mockResolvedValue(null);

    const res = await submitProposalAction({ id: "de-outro" });

    expect(res.ok).toBe(false);
    expect(mocks.proposalUpdate).not.toHaveBeenCalled();
  });

  it("MEMBER não envia", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });

    const res = await submitProposalAction({ id: "p-1" });

    expect(res.ok).toBe(false);
    expect(mocks.proposalUpdate).not.toHaveBeenCalled();
  });
});
