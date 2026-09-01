// leads.test.ts — funil comercial (LEAD | DISCOVERY | EVALUATION).
//
// O invariante que carrega este módulo: lead convertido (`propostaId`
// gravado) ou perdido (`perdidoEm` gravado) não volta a mover de estágio.
// Sem isso, reabrir um funil que já fechou contaria a mesma venda duas
// vezes, ou faria o pipeline "aberto" incluir o que já morreu.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  logPlatformAudit: vi.fn(),
  gerarNumeroProposta: vi.fn(),
  leadFindMany: vi.fn(),
  leadFindFirst: vi.fn(),
  leadCreate: vi.fn(),
  leadUpdate: vi.fn(),
  proposalCreate: vi.fn(),
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
// leads.ts reaproveita a numeração de proposals.ts em vez de duplicá-la —
// mockar o módulo inteiro evita puxar `approvals.ts` e `lib/comercial`
// (dependências transitivas de proposals.ts que nada têm a ver com este
// arquivo) para dentro do teste.
vi.mock("@/app/actions/proposals", () => ({
  gerarNumeroProposta: mocks.gerarNumeroProposta,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/database", () => ({
  database: {
    lead: {
      findMany: mocks.leadFindMany,
      findFirst: mocks.leadFindFirst,
      create: mocks.leadCreate,
      update: mocks.leadUpdate,
    },
    proposal: { create: mocks.proposalCreate },
    $transaction: mocks.transaction,
  },
}));

import {
  converterEmProposta,
  criarLead,
  listarLeads,
  marcarPerdido,
  moverEstagio,
  registrarProximaAcao,
} from "../app/actions/leads";

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
  mocks.leadFindMany.mockResolvedValue([]);
  mocks.gerarNumeroProposta.mockReturnValue("P-TESTE");
  mocks.transaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) =>
      await fn({
        proposal: { create: mocks.proposalCreate },
        lead: { update: mocks.leadUpdate },
      })
  );
}

function leadAberto(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "l-1",
    nome: "Vanta Saúde",
    estagio: "LEAD",
    contatoEmail: "ana@vanta.exemplo",
    propostaId: null,
    perdidoEm: null,
    ...over,
  };
}

describe("listarLeads", () => {
  beforeEach(resetar);

  it("lê escopado ao tenant interno", async () => {
    mocks.leadFindMany.mockResolvedValue([]);

    const res = await listarLeads();

    expect(res.ok).toBe(true);
    expect(mocks.leadFindMany.mock.calls[0][0].where).toMatchObject({
      tenantId: "system",
    });
  });
});

describe("criarLead", () => {
  beforeEach(resetar);

  it("MEMBER não cria", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });

    const res = await criarLead({ nome: "Vanta Saúde" });

    expect(res.ok).toBe(false);
    expect(mocks.leadCreate).not.toHaveBeenCalled();
  });

  it("grava o dono como quem criou, igual a criadoPorId em Proposal", async () => {
    mocks.leadCreate.mockResolvedValue({ id: "l-1" });

    await criarLead({ nome: "Vanta Saúde" });

    expect(mocks.leadCreate.mock.calls[0][0].data).toMatchObject({
      donoId: staff.userId,
      donoNome: staff.name,
    });
    // `estagio` não é setado pela action — o lead nasce em LEAD pelo default
    // do schema, não por um valor escrito aqui.
    expect(mocks.leadCreate.mock.calls[0][0].data).not.toHaveProperty(
      "estagio"
    );
  });
});

describe("moverEstagio", () => {
  beforeEach(resetar);

  it("move um lead aberto de um estágio para o outro", async () => {
    mocks.leadFindFirst.mockResolvedValue(leadAberto({ estagio: "LEAD" }));
    mocks.leadUpdate.mockResolvedValue({ id: "l-1" });

    const res = await moverEstagio({ id: "l-1", estagio: "DISCOVERY" });

    expect(res.ok).toBe(true);
    expect(mocks.leadUpdate.mock.calls[0][0].data.estagio).toBe("DISCOVERY");
  });

  it("bloqueia lead já convertido — não reabre um funil que já fechou", async () => {
    mocks.leadFindFirst.mockResolvedValue(
      leadAberto({ estagio: "EVALUATION", propostaId: "p-0" })
    );

    const res = await moverEstagio({ id: "l-1", estagio: "LEAD" });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("FORBIDDEN");
    }
    expect(mocks.leadUpdate).not.toHaveBeenCalled();
  });

  it("bloqueia lead perdido — reabrir esconderia por que ele saiu", async () => {
    mocks.leadFindFirst.mockResolvedValue(
      leadAberto({ perdidoEm: new Date("2026-08-01") })
    );

    const res = await moverEstagio({ id: "l-1", estagio: "DISCOVERY" });

    expect(res.ok).toBe(false);
    expect(mocks.leadUpdate).not.toHaveBeenCalled();
  });

  it("recusa lead de outro tenant / inexistente", async () => {
    mocks.leadFindFirst.mockResolvedValue(null);

    const res = await moverEstagio({ id: "de-outro", estagio: "LEAD" });

    expect(res.ok).toBe(false);
    expect(mocks.leadUpdate).not.toHaveBeenCalled();
  });

  it("MEMBER não move", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });

    const res = await moverEstagio({ id: "l-1", estagio: "DISCOVERY" });

    expect(res.ok).toBe(false);
    expect(mocks.leadUpdate).not.toHaveBeenCalled();
  });
});

describe("registrarProximaAcao", () => {
  beforeEach(resetar);

  it("grava texto e data", async () => {
    mocks.leadFindFirst.mockResolvedValue(leadAberto());
    mocks.leadUpdate.mockResolvedValue({ id: "l-1" });

    const res = await registrarProximaAcao({
      id: "l-1",
      proximaAcao: "Ligar para o contato",
      proximaAcaoEm: "2026-09-10",
    });

    expect(res.ok).toBe(true);
    expect(mocks.leadUpdate.mock.calls[0][0].data.proximaAcao).toBe(
      "Ligar para o contato"
    );
  });

  it("bloqueia em lead convertido", async () => {
    mocks.leadFindFirst.mockResolvedValue(leadAberto({ propostaId: "p-0" }));

    const res = await registrarProximaAcao({
      id: "l-1",
      proximaAcao: "Ligar",
      proximaAcaoEm: "2026-09-10",
    });

    expect(res.ok).toBe(false);
    expect(mocks.leadUpdate).not.toHaveBeenCalled();
  });
});

describe("marcarPerdido", () => {
  beforeEach(resetar);

  it("exige motivo não vazio", async () => {
    mocks.leadFindFirst.mockResolvedValue(leadAberto());

    const res = await marcarPerdido({ id: "l-1", motivoPerda: "" });

    expect(res.ok).toBe(false);
    expect(mocks.leadUpdate).not.toHaveBeenCalled();
  });

  it("recusa motivo só com espaço — mesmo bug que 'proposta sem item'", async () => {
    mocks.leadFindFirst.mockResolvedValue(leadAberto());

    const res = await marcarPerdido({ id: "l-1", motivoPerda: "   " });

    expect(res.ok).toBe(false);
    expect(mocks.leadUpdate).not.toHaveBeenCalled();
  });

  it("marca perdido com o motivo informado", async () => {
    mocks.leadFindFirst.mockResolvedValue(leadAberto());
    mocks.leadUpdate.mockResolvedValue({ id: "l-1" });

    const res = await marcarPerdido({
      id: "l-1",
      motivoPerda: "Preço acima do orçamento do trimestre",
    });

    expect(res.ok).toBe(true);
    expect(mocks.leadUpdate.mock.calls[0][0].data).toMatchObject({
      motivoPerda: "Preço acima do orçamento do trimestre",
    });
    expect(mocks.leadUpdate.mock.calls[0][0].data.perdidoEm).toBeInstanceOf(
      Date
    );
  });

  it("recusa marcar perdido um lead já convertido", async () => {
    mocks.leadFindFirst.mockResolvedValue(leadAberto({ propostaId: "p-0" }));

    const res = await marcarPerdido({ id: "l-1", motivoPerda: "Preço" });

    expect(res.ok).toBe(false);
    expect(mocks.leadUpdate).not.toHaveBeenCalled();
  });

  it("MEMBER não marca perdido", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });

    const res = await marcarPerdido({ id: "l-1", motivoPerda: "Preço" });

    expect(res.ok).toBe(false);
    expect(mocks.leadUpdate).not.toHaveBeenCalled();
  });
});

describe("converterEmProposta", () => {
  beforeEach(resetar);

  it("cria a proposta com o número reaproveitado de proposals.ts e grava propostaId no lead", async () => {
    mocks.leadFindFirst.mockResolvedValue(leadAberto());
    mocks.proposalCreate.mockResolvedValue({ id: "p-1", numero: "P-TESTE" });
    mocks.leadUpdate.mockResolvedValue({ id: "l-1" });

    const res = await converterEmProposta({ id: "l-1" });

    expect(res.ok).toBe(true);
    expect(mocks.gerarNumeroProposta).toHaveBeenCalled();
    expect(mocks.proposalCreate.mock.calls[0][0].data).toMatchObject({
      numero: "P-TESTE",
      titulo: "Vanta Saúde",
      clienteNome: "Vanta Saúde",
      contatoEmail: "ana@vanta.exemplo",
    });
    expect(mocks.leadUpdate.mock.calls[0][0].data.propostaId).toBe("p-1");
    if (res.ok) {
      expect(res.data.id).toBe("p-1");
    }
  });

  it("recusa converter lead já convertido — a proposta já existe", async () => {
    mocks.leadFindFirst.mockResolvedValue(leadAberto({ propostaId: "p-0" }));

    const res = await converterEmProposta({ id: "l-1" });

    expect(res.ok).toBe(false);
    expect(mocks.proposalCreate).not.toHaveBeenCalled();
    expect(mocks.leadUpdate).not.toHaveBeenCalled();
  });

  it("recusa converter lead perdido", async () => {
    mocks.leadFindFirst.mockResolvedValue(
      leadAberto({ perdidoEm: new Date("2026-08-01") })
    );

    const res = await converterEmProposta({ id: "l-1" });

    expect(res.ok).toBe(false);
    expect(mocks.proposalCreate).not.toHaveBeenCalled();
  });

  it("MEMBER não converte", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });

    const res = await converterEmProposta({ id: "l-1" });

    expect(res.ok).toBe(false);
    expect(mocks.proposalCreate).not.toHaveBeenCalled();
  });
});
