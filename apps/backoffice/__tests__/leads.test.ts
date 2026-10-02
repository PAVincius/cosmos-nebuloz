// leads.test.ts — funil comercial v2 (LEAD | DISCOVERY | EVALUATION | PROPOSAL).
//
// O invariante que carrega este módulo: lead convertido (`propostaId`
// gravado) ou perdido (`perdidoEm` gravado) não volta a mover de estágio pelo
// board. `marcarPerdido` é a exceção: um lead em PROPOSAL ainda pode ser
// perdido pelo funil, sem mexer na proposta em si.
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
  leadUpdateMany: vi.fn(),
  canalDeLeadFindFirst: vi.fn(),
  canalDeLeadFindMany: vi.fn(),
  estagioDoFunilFindMany: vi.fn(),
  historicoDeEstagioFindMany: vi.fn(),
  historicoDeEstagioCreate: vi.fn(),
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
// leads.ts reaproveita a numeração de `lib/comercial` em vez de duplicá-la.
vi.mock("@/lib/comercial", () => ({
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
    canalDeLead: {
      findFirst: mocks.canalDeLeadFindFirst,
      findMany: mocks.canalDeLeadFindMany,
    },
    estagioDoFunil: { findMany: mocks.estagioDoFunilFindMany },
    historicoDeEstagio: {
      findMany: mocks.historicoDeEstagioFindMany,
      create: mocks.historicoDeEstagioCreate,
    },
    proposal: { create: mocks.proposalCreate },
    $transaction: mocks.transaction,
  },
  ProductModule: {
    MERIDIAN: "MERIDIAN",
    SCAFFOLD: "SCAFFOLD",
    SIGNAL: "SIGNAL",
    CHARTER: "CHARTER",
    COSMOS: "COSMOS",
  },
}));

import {
  converterEmProposta,
  criarLead,
  listarFunil,
  marcarPerdido,
  moverEstagio,
  registrarProximaAcao,
} from "../app/actions/leads";

const staff = {
  userId: "u-1",
  name: "Vinícius",
  email: "v@nebuloz.ai",
  canWrite: true,
};

/** `$transaction` como o vizinho testa: callback recebe o mesmo objeto de
 *  mocks, seja ele chamado `tx` (produção) ou `database` (aqui). */
const tx = {
  lead: { create: mocks.leadCreate, updateMany: mocks.leadUpdateMany },
  historicoDeEstagio: { create: mocks.historicoDeEstagioCreate },
  proposal: { create: mocks.proposalCreate },
};

function resetar() {
  for (const m of Object.values(mocks)) {
    m.mockReset();
  }
  mocks.requirePlatformStaff.mockResolvedValue(staff);
  mocks.leadFindMany.mockResolvedValue([]);
  mocks.estagioDoFunilFindMany.mockResolvedValue([]);
  mocks.canalDeLeadFindMany.mockResolvedValue([]);
  mocks.historicoDeEstagioFindMany.mockResolvedValue([]);
  mocks.gerarNumeroProposta.mockReturnValue("P-TESTE");
  // `updateMany` real devolve `{ count }` — `count: 1` é o caminho feliz
  // (nenhuma concorrência); os testes de corrida sobrescrevem para `0`.
  mocks.leadUpdateMany.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(
    async (fn: (t: unknown) => Promise<unknown>) => await fn(tx)
  );
}

function leadAberto(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "l-1",
    nome: "Vanta Saúde",
    estagio: "LEAD",
    estagioDesde: new Date("2026-08-20"),
    contatoEmail: "ana@vanta.exemplo",
    propostaId: null,
    perdidoEm: null,
    ...over,
  };
}

describe("listarFunil", () => {
  beforeEach(resetar);

  it("lê escopado ao tenant interno e devolve hoje", async () => {
    const res = await listarFunil();

    expect(res.ok).toBe(true);
    expect(mocks.leadFindMany.mock.calls[0][0].where).toMatchObject({
      tenantId: "system",
    });
    if (res.ok) {
      expect(typeof res.data.hoje).toBe("string");
    }
  });

  it("filtra o histórico aos últimos 90 dias", async () => {
    await listarFunil();

    const where = mocks.historicoDeEstagioFindMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe("system");
    expect(where.em.gte).toBeInstanceOf(Date);
  });

  it("deriva situacao de perdidoEm e do status da proposta", async () => {
    mocks.leadFindMany.mockResolvedValue([
      {
        id: "l-ativo",
        nome: "Ativo",
        contatoNome: null,
        contatoEmail: null,
        estagio: "LEAD",
        estagioDesde: new Date("2026-08-20"),
        entrada: null,
        origem: null,
        acvEstimadoCentavos: null,
        donoNome: null,
        proximaAcao: null,
        proximaAcaoEm: null,
        perdidoEm: null,
        perdidoNoEstagio: null,
        motivoPerda: null,
        notaPerda: null,
        criadoEm: new Date("2026-08-01"),
        canal: null,
        proposta: null,
      },
      {
        id: "l-perdido",
        nome: "Perdido",
        contatoNome: null,
        contatoEmail: null,
        estagio: "DISCOVERY",
        estagioDesde: new Date("2026-08-20"),
        entrada: null,
        origem: null,
        acvEstimadoCentavos: null,
        donoNome: null,
        proximaAcao: null,
        proximaAcaoEm: null,
        perdidoEm: new Date("2026-09-01"),
        perdidoNoEstagio: "DISCOVERY",
        motivoPerda: "PRECO",
        notaPerda: "Preço acima do orçamento do trimestre",
        criadoEm: new Date("2026-08-01"),
        canal: null,
        proposta: null,
      },
      {
        id: "l-ganho",
        nome: "Ganho",
        contatoNome: null,
        contatoEmail: null,
        estagio: "PROPOSAL",
        estagioDesde: new Date("2026-08-20"),
        entrada: null,
        origem: null,
        acvEstimadoCentavos: null,
        donoNome: null,
        proximaAcao: null,
        proximaAcaoEm: null,
        perdidoEm: null,
        perdidoNoEstagio: null,
        motivoPerda: null,
        notaPerda: null,
        criadoEm: new Date("2026-08-01"),
        canal: null,
        proposta: {
          id: "p-1",
          numero: "P-1",
          status: "ACEITA",
          acvCentavos: 50_000,
          tenantProvisionadoSlug: "vanta",
        },
      },
    ]);

    const res = await listarFunil();

    expect(res.ok).toBe(true);
    if (res.ok) {
      const porId = Object.fromEntries(
        res.data.leads.map((l) => [l.id, l.situacao])
      );
      expect(porId["l-ativo"]).toBe("ATIVO");
      expect(porId["l-perdido"]).toBe("PERDIDO");
      expect(porId["l-ganho"]).toBe("GANHO");
    }
  });
});

describe("criarLead", () => {
  beforeEach(resetar);

  function entrada(
    over: Partial<Parameters<typeof criarLead>[0]> = {}
  ): Parameters<typeof criarLead>[0] {
    return {
      nome: "Vanta Saúde",
      entrada: "MERIDIAN",
      canalSlug: "indicacao",
      proximaAcao: "Ligar para o contato",
      proximaAcaoEm: "2026-09-10",
      ...over,
    };
  }

  it("MEMBER não cria", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });

    const res = await criarLead(entrada());

    expect(res.ok).toBe(false);
    expect(mocks.leadCreate).not.toHaveBeenCalled();
  });

  it("exige entrada, próximo passo e canal existente e ativo", async () => {
    mocks.canalDeLeadFindFirst.mockResolvedValue(null);

    const res = await criarLead(entrada());

    expect(res.ok).toBe(false);
    expect(mocks.leadCreate).not.toHaveBeenCalled();
  });

  it("recusa payload sem próximo passo", async () => {
    // @ts-expect-error — omitindo campo obrigatório de propósito.
    const res = await criarLead({
      nome: "Vanta Saúde",
      entrada: "MERIDIAN",
      canalSlug: "indicacao",
    });

    expect(res.ok).toBe(false);
    expect(mocks.leadCreate).not.toHaveBeenCalled();
  });

  it("cria o lead e grava histórico null→LEAD na mesma transação", async () => {
    mocks.canalDeLeadFindFirst.mockResolvedValue({ id: "c-1" });
    mocks.leadCreate.mockResolvedValue({ id: "l-1" });

    const res = await criarLead(entrada());

    expect(res.ok).toBe(true);
    expect(mocks.canalDeLeadFindFirst.mock.calls[0][0].where).toMatchObject({
      tenantId: "system",
      slug: "indicacao",
      ativo: true,
    });
    expect(mocks.leadCreate.mock.calls[0][0].data).toMatchObject({
      nome: "Vanta Saúde",
      entrada: "MERIDIAN",
      canalId: "c-1",
      proximaAcao: "Ligar para o contato",
      donoId: staff.userId,
      donoNome: staff.name,
    });
    expect(mocks.historicoDeEstagioCreate.mock.calls[0][0].data).toMatchObject({
      leadId: "l-1",
      de: null,
      para: "LEAD",
    });
  });
});

describe("moverEstagio", () => {
  beforeEach(resetar);

  it("move um lead aberto de um estágio para o outro e zera estagioDesde", async () => {
    mocks.leadFindFirst.mockResolvedValue(leadAberto({ estagio: "LEAD" }));

    const res = await moverEstagio({ id: "l-1", estagio: "DISCOVERY" });

    expect(res.ok).toBe(true);
    expect(mocks.leadUpdateMany.mock.calls[0][0].data.estagio).toBe(
      "DISCOVERY"
    );
    expect(
      mocks.leadUpdateMany.mock.calls[0][0].data.estagioDesde
    ).toBeInstanceOf(Date);
    expect(mocks.historicoDeEstagioCreate.mock.calls[0][0].data).toMatchObject({
      leadId: "l-1",
      de: "LEAD",
      para: "DISCOVERY",
    });
  });

  it("recusa PROPOSAL como destino — só a conversão grava esse estágio", async () => {
    mocks.leadFindFirst.mockResolvedValue(
      leadAberto({ estagio: "EVALUATION" })
    );

    const res = await moverEstagio({
      id: "l-1",
      estagio: "PROPOSAL" as any,
    });

    expect(res.ok).toBe(false);
    expect(mocks.leadUpdateMany).not.toHaveBeenCalled();
  });

  it("recusa mover para o mesmo estágio", async () => {
    mocks.leadFindFirst.mockResolvedValue(leadAberto({ estagio: "DISCOVERY" }));

    const res = await moverEstagio({ id: "l-1", estagio: "DISCOVERY" });

    expect(res.ok).toBe(false);
    expect(mocks.leadUpdateMany).not.toHaveBeenCalled();
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
    expect(mocks.leadUpdateMany).not.toHaveBeenCalled();
  });

  it("bloqueia lead perdido — reabrir esconderia por que ele saiu", async () => {
    mocks.leadFindFirst.mockResolvedValue(
      leadAberto({ perdidoEm: new Date("2026-08-01") })
    );

    const res = await moverEstagio({ id: "l-1", estagio: "DISCOVERY" });

    expect(res.ok).toBe(false);
    expect(mocks.leadUpdateMany).not.toHaveBeenCalled();
  });

  it("recusa lead de outro tenant / inexistente", async () => {
    mocks.leadFindFirst.mockResolvedValue(null);

    const res = await moverEstagio({ id: "de-outro", estagio: "LEAD" });

    expect(res.ok).toBe(false);
    expect(mocks.leadUpdateMany).not.toHaveBeenCalled();
  });

  it("MEMBER não move", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });

    const res = await moverEstagio({ id: "l-1", estagio: "DISCOVERY" });

    expect(res.ok).toBe(false);
    expect(mocks.leadUpdateMany).not.toHaveBeenCalled();
  });

  it("lead mudou de estágio entre a leitura e a escrita: recusa sem duplicar histórico", async () => {
    mocks.leadFindFirst.mockResolvedValue(leadAberto({ estagio: "LEAD" }));
    mocks.leadUpdateMany.mockResolvedValue({ count: 0 });

    const res = await moverEstagio({ id: "l-1", estagio: "DISCOVERY" });

    expect(res.ok).toBe(false);
    expect(mocks.historicoDeEstagioCreate).not.toHaveBeenCalled();
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

  it("exige motivo do enum", async () => {
    mocks.leadFindFirst.mockResolvedValue(leadAberto());

    const res = await marcarPerdido({
      id: "l-1",
      motivo: "QUALQUER_COISA" as any,
      nota: "Preço acima do orçamento",
    });

    expect(res.ok).toBe(false);
    expect(mocks.leadUpdateMany).not.toHaveBeenCalled();
  });

  it("exige nota com pelo menos 12 caracteres", async () => {
    mocks.leadFindFirst.mockResolvedValue(leadAberto());

    const res = await marcarPerdido({
      id: "l-1",
      motivo: "PRECO",
      nota: "curta",
    });

    expect(res.ok).toBe(false);
    expect(mocks.leadUpdateMany).not.toHaveBeenCalled();
  });

  it("marca perdido, grava o estágio da perda e o histórico", async () => {
    mocks.leadFindFirst.mockResolvedValue(leadAberto({ estagio: "DISCOVERY" }));

    const res = await marcarPerdido({
      id: "l-1",
      motivo: "PRECO",
      nota: "Preço acima do orçamento do trimestre",
    });

    expect(res.ok).toBe(true);
    expect(mocks.leadUpdateMany.mock.calls[0][0].data).toMatchObject({
      motivoPerda: "PRECO",
      notaPerda: "Preço acima do orçamento do trimestre",
      perdidoNoEstagio: "DISCOVERY",
    });
    expect(mocks.leadUpdateMany.mock.calls[0][0].data.perdidoEm).toBeInstanceOf(
      Date
    );
    expect(mocks.historicoDeEstagioCreate.mock.calls[0][0].data).toMatchObject({
      leadId: "l-1",
      de: "DISCOVERY",
      para: "PERDIDO",
    });
  });

  it("permite marcar perdido em PROPOSAL sem mexer na proposta", async () => {
    mocks.leadFindFirst.mockResolvedValue(
      leadAberto({ estagio: "PROPOSAL", propostaId: "p-0" })
    );

    const res = await marcarPerdido({
      id: "l-1",
      motivo: "TIMING",
      nota: "Orçamento adiado para o próximo trimestre",
    });

    expect(res.ok).toBe(true);
    expect(mocks.leadUpdateMany.mock.calls[0][0].data.perdidoNoEstagio).toBe(
      "PROPOSAL"
    );
    expect(mocks.proposalCreate).not.toHaveBeenCalled();
  });

  it("recusa nota acima de 500 caracteres", async () => {
    mocks.leadFindFirst.mockResolvedValue(leadAberto());

    const res = await marcarPerdido({
      id: "l-1",
      motivo: "PRECO",
      nota: "a".repeat(501),
    });

    expect(res.ok).toBe(false);
    expect(mocks.leadUpdateMany).not.toHaveBeenCalled();
  });

  it("recusa marcar perdido um lead já GANHO — proposta ACEITA", async () => {
    mocks.leadFindFirst.mockResolvedValue(
      leadAberto({
        estagio: "PROPOSAL",
        propostaId: "p-0",
        proposta: { status: "ACEITA" },
      })
    );

    const res = await marcarPerdido({
      id: "l-1",
      motivo: "PRECO",
      nota: "Preço acima do orçamento do trimestre",
    });

    expect(res.ok).toBe(false);
    expect(mocks.leadUpdateMany).not.toHaveBeenCalled();
    expect(mocks.historicoDeEstagioCreate).not.toHaveBeenCalled();
  });

  it("recusa marcar perdido um lead já perdido", async () => {
    mocks.leadFindFirst.mockResolvedValue(
      leadAberto({ perdidoEm: new Date("2026-08-01") })
    );

    const res = await marcarPerdido({
      id: "l-1",
      motivo: "PRECO",
      nota: "Preço acima do orçamento do trimestre",
    });

    expect(res.ok).toBe(false);
    expect(mocks.leadUpdateMany).not.toHaveBeenCalled();
  });

  it("MEMBER não marca perdido", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });

    const res = await marcarPerdido({
      id: "l-1",
      motivo: "PRECO",
      nota: "Preço acima do orçamento do trimestre",
    });

    expect(res.ok).toBe(false);
    expect(mocks.leadUpdateMany).not.toHaveBeenCalled();
  });

  it("lead mudou de estado entre a leitura e a escrita: recusa sem duplicar histórico", async () => {
    mocks.leadFindFirst.mockResolvedValue(leadAberto({ estagio: "DISCOVERY" }));
    mocks.leadUpdateMany.mockResolvedValue({ count: 0 });

    const res = await marcarPerdido({
      id: "l-1",
      motivo: "PRECO",
      nota: "Preço acima do orçamento do trimestre",
    });

    expect(res.ok).toBe(false);
    expect(mocks.historicoDeEstagioCreate).not.toHaveBeenCalled();
  });
});

describe("converterEmProposta", () => {
  beforeEach(resetar);

  it("cria a proposta, seta PROPOSAL e grava o histórico EVALUATION→PROPOSAL", async () => {
    mocks.leadFindFirst.mockResolvedValue(
      leadAberto({ estagio: "EVALUATION" })
    );
    mocks.proposalCreate.mockResolvedValue({ id: "p-1", numero: "P-TESTE" });

    const res = await converterEmProposta({ id: "l-1" });

    expect(res.ok).toBe(true);
    expect(mocks.gerarNumeroProposta).toHaveBeenCalled();
    expect(mocks.proposalCreate.mock.calls[0][0].data).toMatchObject({
      numero: "P-TESTE",
      titulo: "Vanta Saúde",
      clienteNome: "Vanta Saúde",
      contatoEmail: "ana@vanta.exemplo",
    });
    expect(mocks.leadUpdateMany.mock.calls[0][0].data).toMatchObject({
      propostaId: "p-1",
      estagio: "PROPOSAL",
    });
    expect(
      mocks.leadUpdateMany.mock.calls[0][0].data.estagioDesde
    ).toBeInstanceOf(Date);
    expect(mocks.historicoDeEstagioCreate.mock.calls[0][0].data).toMatchObject({
      leadId: "l-1",
      de: "EVALUATION",
      para: "PROPOSAL",
    });
    if (res.ok) {
      expect(res.data.id).toBe("p-1");
    }
  });

  it("recusa converter fora de EVALUATION", async () => {
    mocks.leadFindFirst.mockResolvedValue(leadAberto({ estagio: "DISCOVERY" }));

    const res = await converterEmProposta({ id: "l-1" });

    expect(res.ok).toBe(false);
    expect(mocks.proposalCreate).not.toHaveBeenCalled();
  });

  it("recusa converter lead já convertido — a proposta já existe", async () => {
    mocks.leadFindFirst.mockResolvedValue(
      leadAberto({ estagio: "EVALUATION", propostaId: "p-0" })
    );

    const res = await converterEmProposta({ id: "l-1" });

    expect(res.ok).toBe(false);
    expect(mocks.proposalCreate).not.toHaveBeenCalled();
    expect(mocks.leadUpdateMany).not.toHaveBeenCalled();
  });

  it("recusa converter lead perdido", async () => {
    mocks.leadFindFirst.mockResolvedValue(
      leadAberto({ estagio: "EVALUATION", perdidoEm: new Date("2026-08-01") })
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

  it("lead mudou de estado entre a leitura e a escrita: recusa sem duplicar histórico", async () => {
    mocks.leadFindFirst.mockResolvedValue(
      leadAberto({ estagio: "EVALUATION" })
    );
    mocks.proposalCreate.mockResolvedValue({ id: "p-1", numero: "P-TESTE" });
    mocks.leadUpdateMany.mockResolvedValue({ count: 0 });

    const res = await converterEmProposta({ id: "l-1" });

    expect(res.ok).toBe(false);
    expect(mocks.historicoDeEstagioCreate).not.toHaveBeenCalled();
  });
});
