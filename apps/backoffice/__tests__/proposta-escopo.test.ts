// proposta-escopo.test.ts — o escopo de assinatura da proposta.
//
// O invariante que estes casos carregam: a action NÃO refaz a conta. Ela lê o
// catálogo, chama `precificarProposta` e grava o que a função devolveu. Se um
// dia alguém reimplementar a fórmula aqui "para simplificar", o preview e o
// servidor passam a discordar sobre o preço — e o primeiro a notar é o cliente,
// olhando um documento que não bate com o contrato.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { precificarProposta } from "../lib/comercial/precificar";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  logPlatformAudit: vi.fn(),
  planoFindMany: vi.fn(),
  moduloFindMany: vi.fn(),
  termoFindMany: vi.fn(),
  addOnFindMany: vi.fn(),
  serviceFindMany: vi.fn(),
  proposalFindFirst: vi.fn(),
  proposalCreate: vi.fn(),
  proposalUpdate: vi.fn(),
  itemCreateMany: vi.fn(),
  itemDeleteMany: vi.fn(),
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
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/database", () => ({
  database: {
    planoComercial: { findMany: mocks.planoFindMany },
    precoDeModulo: { findMany: mocks.moduloFindMany },
    termoDeContrato: { findMany: mocks.termoFindMany },
    addOnComercial: { findMany: mocks.addOnFindMany },
    service: { findMany: mocks.serviceFindMany },
    proposal: {
      findFirst: mocks.proposalFindFirst,
      create: mocks.proposalCreate,
      update: mocks.proposalUpdate,
    },
    proposalItem: {
      createMany: mocks.itemCreateMany,
      deleteMany: mocks.itemDeleteMany,
    },
    $transaction: mocks.transaction,
  },
}));

import { salvarEscopoAction } from "../app/actions/proposta-escopo";

const SCALE = {
  slug: "scale",
  nome: "Scale",
  precoAssentoCentavos: 14_900,
  minimoAssentos: 25,
  limiteUsuarios: 100,
  permiteRolesCustom: false,
};

const escopo = {
  titulo: "Atlas Energia — plataforma",
  clienteNome: "Atlas Energia",
  contatoEmail: "diretoria@atlasenergia.com.br",
  planoSlug: "scale",
  assentos: 40,
  modulos: ["COSMOS", "CHARTER"] as ("COSMOS" | "CHARTER" | "SIGNAL")[],
  addOnSlugs: [] as string[],
  termoSlug: "ANUAL",
  descontoPercent: 0,
  servicoIds: [] as string[],
};

describe("salvarEscopoAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertCanWrite.mockImplementation(() => undefined);
    mocks.requirePlatformStaff.mockResolvedValue({
      userId: "u-1",
      name: "Marina",
      canWrite: true,
    });
    mocks.planoFindMany.mockResolvedValue([SCALE]);
    mocks.moduloFindMany.mockResolvedValue([
      { modulo: "COSMOS", precoMensalCentavos: 0 },
      { modulo: "CHARTER", precoMensalCentavos: 180_000 },
      { modulo: "SIGNAL", precoMensalCentavos: 120_000 },
    ]);
    mocks.termoFindMany.mockResolvedValue([
      { slug: "MENSAL", nome: "Mensal", meses: 1, descontoPercent: 0 },
      { slug: "ANUAL", nome: "Anual", meses: 12, descontoPercent: 12 },
    ]);
    mocks.addOnFindMany.mockResolvedValue([
      {
        slug: "sso",
        nome: "SSO / SAML dedicado",
        precoCentavos: 90_000,
        recorrente: true,
        exigeRolesCustom: true,
      },
      {
        slug: "onboarding",
        nome: "Onboarding assistido",
        precoCentavos: 650_000,
        recorrente: false,
        exigeRolesCustom: false,
      },
    ]);
    mocks.serviceFindMany.mockResolvedValue([]);
    mocks.proposalCreate.mockResolvedValue({ id: "prop-1", numero: "P-ABC" });
    mocks.itemCreateMany.mockResolvedValue({ count: 0 });
    mocks.transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn({
        proposal: {
          create: mocks.proposalCreate,
          update: mocks.proposalUpdate,
        },
        proposalItem: {
          createMany: mocks.itemCreateMany,
          deleteMany: mocks.itemDeleteMany,
        },
      })
    );
  });

  it("MEMBER não salva escopo", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });

    const res = await salvarEscopoAction(escopo);

    expect(res.ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  // O caso que dá nome ao arquivo: o total gravado tem de ser exatamente o que
  // a fórmula devolve para o mesmo escopo.
  it("grava o preço que a fórmula calcula, sem refazer a conta", async () => {
    await salvarEscopoAction(escopo);

    const esperado = precificarProposta(
      {
        plano: { precoAssentoCentavos: 14_900, minimoAssentos: 25 },
        modulos: [
          { moduloId: "COSMOS", precoMensalCentavos: 0 },
          { moduloId: "CHARTER", precoMensalCentavos: 180_000 },
        ],
        termo: { meses: 12, descontoPercent: 12 },
        addOns: [],
        servicos: [],
      },
      { assentos: 40, descontoPercent: 0 }
    );

    const gravado = mocks.proposalCreate.mock.calls[0][0].data;
    expect(gravado.totalCentavos).toBe(esperado.liquidoMensalCentavos);
    expect(gravado.acvCentavos).toBe(esperado.acvCentavos);
    expect(gravado.tcvCentavos).toBe(esperado.tcvCentavos);
    expect(gravado.umaVezCentavos).toBe(esperado.umaVezCentavos);
  });

  it("guarda o escopo, não só o total", async () => {
    await salvarEscopoAction(escopo);

    const gravado = mocks.proposalCreate.mock.calls[0][0].data;
    expect(gravado.planoSlug).toBe("scale");
    expect(gravado.assentos).toBe(40);
    expect(gravado.modulos).toEqual(["COSMOS", "CHARTER"]);
    expect(gravado.termoSlug).toBe("ANUAL");
    expect(gravado.contatoEmail).toBe("diretoria@atlasenergia.com.br");
  });

  it("recusa plano que não está no catálogo", async () => {
    const res = await salvarEscopoAction({ ...escopo, planoSlug: "galactico" });

    expect(res.ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("recusa prazo que não está no catálogo", async () => {
    const res = await salvarEscopoAction({ ...escopo, termoSlug: "DECENAL" });

    expect(res.ok).toBe(false);
  });

  // Mesma regra do caminho antigo (proposals.ts): item fora do catálogo ativo
  // não entra, senão a proposta cita um serviço que a Nebuloz não vende mais.
  it("recusa serviço fora do catálogo ativo", async () => {
    mocks.serviceFindMany.mockResolvedValue([]);

    const res = await salvarEscopoAction({
      ...escopo,
      servicoIds: ["svc-fantasma"],
    });

    expect(res.ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("copia nome e preço do serviço para o item, não referencia", async () => {
    mocks.serviceFindMany.mockResolvedValue([
      {
        id: "svc-1",
        codigo: "SV-09",
        nome: "SLM Domain Fine-tune",
        precoBaseCentavos: 16_500_000,
        unidadeDeCobranca: "PROJETO",
        exigeLab: true,
        preRequisitos: [],
      },
    ]);

    await salvarEscopoAction({ ...escopo, servicoIds: ["svc-1"] });

    const itens = mocks.itemCreateMany.mock.calls[0][0].data;
    expect(itens[0].descricao).toBe("SLM Domain Fine-tune");
    expect(itens[0].precoUnitCentavos).toBe(16_500_000);
  });

  // Retainer entra na mensalidade; projeto vai para o setup. É a fórmula que
  // decide isso, e a action tem de repassar a unidade certa para ela.
  it("serviço em retainer entra no recorrente, não no setup", async () => {
    mocks.serviceFindMany.mockResolvedValue([
      {
        id: "svc-6",
        codigo: "SV-06",
        nome: "AI Operations Retainer",
        precoBaseCentavos: 2_600_000,
        unidadeDeCobranca: "RETAINER",
        exigeLab: false,
        preRequisitos: [],
      },
    ]);

    await salvarEscopoAction({ ...escopo, servicoIds: ["svc-6"] });

    const gravado = mocks.proposalCreate.mock.calls[0][0].data;
    expect(gravado.umaVezCentavos).toBe(0);
    // 40 assentos + CHARTER + retainer, com 12% de prazo.
    const bruto = 40 * 14_900 + 180_000 + 2_600_000;
    expect(gravado.totalCentavos).toBe(Math.round(bruto * 0.88));
  });

  it("add-on de setup não entra na mensalidade", async () => {
    await salvarEscopoAction({ ...escopo, addOnSlugs: ["onboarding"] });

    const gravado = mocks.proposalCreate.mock.calls[0][0].data;
    expect(gravado.umaVezCentavos).toBe(650_000);
    expect(gravado.totalCentavos).toBe(
      Math.round((40 * 14_900 + 180_000) * 0.88)
    );
  });

  it("exige ao menos um módulo (FR-13.7)", async () => {
    const res = await salvarEscopoAction({ ...escopo, modulos: [] });

    expect(res.ok).toBe(false);
  });

  it("recusa contato que não é e-mail", async () => {
    const res = await salvarEscopoAction({
      ...escopo,
      contatoEmail: "diretoria arroba atlas",
    });

    expect(res.ok).toBe(false);
  });

  it("registra auditoria da criação", async () => {
    await salvarEscopoAction(escopo);

    expect(mocks.logPlatformAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ entityType: "proposal", action: "created" })
    );
  });

  // Rascunho é editável: salvar de novo troca o escopo em vez de empilhar
  // proposta nova a cada ajuste de assento durante a call.
  it("com id, atualiza o rascunho em vez de criar outro", async () => {
    mocks.proposalFindFirst.mockResolvedValue({
      id: "prop-1",
      status: "RASCUNHO",
      tenantId: "system",
      numero: "P-ABC",
    });
    mocks.proposalUpdate.mockResolvedValue({ id: "prop-1", numero: "P-ABC" });

    const res = await salvarEscopoAction({ ...escopo, id: "prop-1" });

    expect(res.ok).toBe(true);
    expect(mocks.proposalUpdate).toHaveBeenCalled();
    expect(mocks.proposalCreate).not.toHaveBeenCalled();
  });

  it("não deixa mexer no escopo de proposta já enviada", async () => {
    mocks.proposalFindFirst.mockResolvedValue({
      id: "prop-1",
      status: "ENVIADA",
      tenantId: "system",
      numero: "P-ABC",
    });

    const res = await salvarEscopoAction({ ...escopo, id: "prop-1" });

    expect(res.ok).toBe(false);
    expect(mocks.proposalUpdate).not.toHaveBeenCalled();
  });
});
