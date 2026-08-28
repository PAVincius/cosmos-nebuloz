// services.test.ts — catálogo do que a Nebuloz vende.
//
// Dois invariantes carregam esta action:
//
// 1. Preço é inteiro em centavos. A tela digita "1.250,00" e o que entra no
//    banco tem de ser 125000 — não 1250, não 1250.0. Errar a unidade aqui só
//    aparece na soma de uma proposta, longe da causa.
// 2. Serviço fora de catálogo é desativado, nunca apagado. Proposta antiga
//    aponta para o serviço que existia quando foi feita; apagar quebraria o
//    documento comercial retroativamente.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  logPlatformAudit: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
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
    service: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
      create: mocks.create,
      update: mocks.update,
    },
  },
}));

import {
  createServiceAction,
  listServices,
  setServiceAtivoAction,
  updateServiceAction,
} from "../app/actions/services";

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
  mocks.findMany.mockResolvedValue([]);
}

describe("listServices", () => {
  beforeEach(resetar);

  it("é leitura de todo staff", async () => {
    const res = await listServices();

    expect(res.ok).toBe(true);
    expect(mocks.assertCanWrite).not.toHaveBeenCalled();
  });

  it("traz inativos também — a lista de gestão mostra o catálogo inteiro", async () => {
    await listServices();

    // Esconder inativo aqui faria o operador achar que o serviço sumiu e
    // cadastrar um duplicado com o mesmo código.
    expect(mocks.findMany.mock.calls[0][0].where.ativo).toBeUndefined();
  });
});

describe("createServiceAction", () => {
  beforeEach(resetar);

  it("MEMBER não cria", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });

    const res = await createServiceAction({
      codigo: "SV-09",
      nome: "Fine-tune dedicado",
      precoBaseCentavos: 100,
    });

    expect(res.ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("grava o preço como inteiro em centavos", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "s-1", codigo: "SV-09" });

    await createServiceAction({
      codigo: "SV-09",
      nome: "Fine-tune dedicado",
      precoBaseCentavos: 125_000,
    });

    expect(mocks.create.mock.calls[0][0].data.precoBaseCentavos).toBe(125_000);
  });

  it("recusa preço fracionado — centavo não tem metade", async () => {
    const res = await createServiceAction({
      codigo: "SV-10",
      nome: "X",
      precoBaseCentavos: 1250.5,
    });

    expect(res.ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("recusa preço negativo", async () => {
    const res = await createServiceAction({
      codigo: "SV-11",
      nome: "X",
      precoBaseCentavos: -1,
    });

    expect(res.ok).toBe(false);
  });

  it("recusa código repetido antes de bater no unique do banco", async () => {
    mocks.findFirst.mockResolvedValue({ id: "ja-existe" });

    const res = await createServiceAction({
      codigo: "SV-09",
      nome: "Outro",
      precoBaseCentavos: 100,
    });

    expect(res.ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("registra na auditoria", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "s-1", codigo: "SV-09" });

    await createServiceAction({
      codigo: "SV-09",
      nome: "Fine-tune",
      precoBaseCentavos: 100,
    });

    expect(mocks.logPlatformAudit).toHaveBeenCalled();
  });
});

describe("setServiceAtivoAction", () => {
  beforeEach(resetar);

  it("desativa em vez de apagar", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "s-1",
      codigo: "SV-09",
      nome: "Fine-tune",
      ativo: true,
    });
    mocks.update.mockResolvedValue({ id: "s-1" });

    const res = await setServiceAtivoAction({ id: "s-1", ativo: false });

    expect(res.ok).toBe(true);
    expect(mocks.update.mock.calls[0][0].data.ativo).toBe(false);
  });

  it("recusa serviço de outro tenant", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const res = await setServiceAtivoAction({ id: "de-outro", ativo: false });

    expect(res.ok).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("guarda o antes e o depois no diff da auditoria", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "s-1",
      codigo: "SV-09",
      nome: "Fine-tune",
      ativo: true,
    });
    mocks.update.mockResolvedValue({ id: "s-1" });

    await setServiceAtivoAction({ id: "s-1", ativo: false });

    const entrada = mocks.logPlatformAudit.mock.calls[0][1];
    expect(entrada.diff).toEqual([["ativo", "true", "false"]]);
  });
});

// O catálogo só sabia criar e (des)ativar: corrigir um preço digitado errado
// exigia SQL. Estes casos guardam a edição e o que ela não pode alcançar.
describe("updateServiceAction", () => {
  const existente = {
    id: "svc-1",
    codigo: "SV-09",
    nome: "SLM Fine-tune",
    descricao: null,
    modalidade: "PROJETO",
    precoBaseCentavos: 16_500_000,
    unidade: "projeto",
    ativo: true,
    trilha: "custom",
    unidadeDeCobranca: "PROJETO",
    duracao: "10 semanas",
    entregaveis: ["Modelo treinado"],
    papeis: ["Cientista de dados"],
    preRequisitos: ["SV-02"],
    moduloVinculado: null,
    exigeLab: true,
  };

  const edicao = {
    id: "svc-1",
    nome: "SLM Domain Fine-tune",
    precoBaseCentavos: 17_000_000,
    trilha: "custom" as const,
    unidadeDeCobranca: "PROJETO" as const,
    entregaveis: ["Modelo treinado", "Model card"],
    papeis: ["Cientista de dados"],
    preRequisitos: ["SV-02", "SV-05"],
    exigeLab: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // `clearAllMocks` zera chamadas, não implementações: sem esta linha o
    // `throw` do caso de MEMBER vaza para todos os casos seguintes.
    mocks.assertCanWrite.mockImplementation(() => undefined);
    mocks.requirePlatformStaff.mockResolvedValue({
      userId: "u-1",
      name: "Marina",
      canWrite: true,
    });
    mocks.findFirst.mockResolvedValue(existente);
    mocks.update.mockResolvedValue({ id: "svc-1" });
  });

  it("MEMBER não edita", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });

    const res = await updateServiceAction(edicao);

    expect(res.ok).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("recusa serviço de outro tenant", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const res = await updateServiceAction(edicao);

    expect(res.ok).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  // Quando o preço de um serviço muda, a pergunta que a auditoria precisa
  // responder é de quanto para quanto — não "serviço atualizado".
  it("audita o preço campo a campo, com valor antes e depois", async () => {
    await updateServiceAction(edicao);

    const { diff } = mocks.logPlatformAudit.mock.calls[0][1];
    expect(diff).toContainEqual([
      "precoBaseCentavos",
      "16500000",
      "17000000",
    ]);
  });

  it("não anota no diff o campo que não mudou", async () => {
    await updateServiceAction(edicao);

    const { diff } = mocks.logPlatformAudit.mock.calls[0][1];
    expect(diff.map((d: string[]) => d[0])).not.toContain("trilha");
    expect(diff.map((d: string[]) => d[0])).not.toContain("exigeLab");
  });

  it("registra lista que mudou de forma legível", async () => {
    await updateServiceAction(edicao);

    const { diff } = mocks.logPlatformAudit.mock.calls[0][1];
    expect(diff).toContainEqual(["preRequisitos", "SV-02", "SV-02, SV-05"]);
  });

  // O código aparece em proposta e contrato já emitidos: renomeá-lo seria
  // reescrever documento assinado.
  it("não deixa o código ser trocado pela edição", async () => {
    await updateServiceAction({
      ...edicao,
      codigo: "SV-99",
    } as unknown as Parameters<typeof updateServiceAction>[0]);

    expect(mocks.update.mock.calls[0][0].data.codigo).toBeUndefined();
  });

  it("recusa unidade de cobrança fora do vocabulário", async () => {
    const res = await updateServiceAction({
      ...edicao,
      unidadeDeCobranca: "MENSALIDADE",
    } as unknown as Parameters<typeof updateServiceAction>[0]);

    expect(res.ok).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
