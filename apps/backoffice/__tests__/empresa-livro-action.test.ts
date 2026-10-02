// empresa-livro-action.test.ts — livro-razão (spec 2026-09-06 §3): cada linha
// é um lançamento; listar filtra por competências do intervalo (e conta,
// opcional); criar/atualizar recusam conta desativada; excluir recusa linha
// que veio de um título — apagá-la deixaria o título BAIXADO sem o fato.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  logPlatformAudit: vi.fn(),
  revalidatePath: vi.fn(),
  lancFindMany: vi.fn(),
  lancFindFirst: vi.fn(),
  lancCreate: vi.fn(),
  lancUpdateMany: vi.fn(),
  lancDeleteMany: vi.fn(),
  contaFindMany: vi.fn(),
  contaFindUnique: vi.fn(),
}));

vi.mock("@/lib/guard", () => {
  class StaffAuthError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return {
    requirePlatformStaff: mocks.requirePlatformStaff,
    assertCanWrite: mocks.assertCanWrite,
    SYSTEM_TENANT_ID: "system",
    StaffAuthError,
    semTeto: (fn: () => unknown) => fn(),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/provisioning", () => ({
  logPlatformAudit: mocks.logPlatformAudit,
  ProvisioningError: class extends Error {},
}));
vi.mock("@repo/database", () => ({
  database: {
    lancamento: {
      findMany: mocks.lancFindMany,
      findFirst: mocks.lancFindFirst,
      create: mocks.lancCreate,
      updateMany: mocks.lancUpdateMany,
      deleteMany: mocks.lancDeleteMany,
    },
    contaDoPlano: {
      findMany: mocks.contaFindMany,
      findUnique: mocks.contaFindUnique,
    },
  },
}));

import {
  atualizarLancamento,
  criarLancamento,
  excluirLancamento,
  listarLancamentos,
} from "../app/actions/empresa/livro";

const staff = {
  userId: "u-1",
  name: "V",
  email: "v@nebuloz.ai",
  canWrite: true,
};

const CONTAS = [
  {
    conta: "1.1",
    nome: "Assinatura",
    grupo: 1,
    centroDeCusto: null,
    ativa: true,
    ordem: 0,
  },
];

const LANCAMENTO_VALIDO = {
  competencia: "2026-09",
  data: "2026-09-05",
  conta: "1.1",
  descricao: "Assinatura mensal",
  valorCentavos: 5000,
  contraparte: "Cliente X",
  documento: null,
  nota: null,
};

function resetar() {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.requirePlatformStaff.mockResolvedValue(staff);
  mocks.lancFindMany.mockResolvedValue([]);
  mocks.contaFindMany.mockResolvedValue(CONTAS);
  mocks.contaFindUnique.mockResolvedValue({ ativa: true });
  mocks.lancCreate.mockResolvedValue({ id: "l-1" });
  mocks.lancUpdateMany.mockResolvedValue({ count: 1 });
  mocks.lancDeleteMany.mockResolvedValue({ count: 1 });
  mocks.lancFindFirst.mockResolvedValue({
    conta: "1.1",
    competencia: "2026-09",
    tituloId: null,
  });
}

describe("listarLancamentos", () => {
  beforeEach(resetar);

  it("filtra por tenant e pelas competências do intervalo", async () => {
    const res = await listarLancamentos({
      de: "2026-08-15",
      ate: "2026-09-10",
    });
    expect(res.ok).toBe(true);
    expect(mocks.lancFindMany.mock.calls[0][0].where).toMatchObject({
      tenantId: "system",
      competencia: { in: ["2026-08", "2026-09"] },
    });
    expect(mocks.lancFindMany.mock.calls[0][0].where.conta).toBeUndefined();
  });

  it("com conta, também filtra por conta", async () => {
    await listarLancamentos({
      de: "2026-09-01",
      ate: "2026-09-30",
      conta: "1.1",
    });
    expect(mocks.lancFindMany.mock.calls[0][0].where).toMatchObject({
      tenantId: "system",
      conta: "1.1",
    });
  });

  it("converte a data para ISO AAAA-MM-DD na saída", async () => {
    mocks.lancFindMany.mockResolvedValue([
      {
        id: "l-1",
        competencia: "2026-09",
        data: new Date("2026-09-05T00:00:00Z"),
        conta: "1.1",
        descricao: "x",
        valorCentavos: 100,
        contraparte: null,
        documento: null,
        nota: null,
        tituloId: null,
      },
    ]);
    const res = await listarLancamentos({
      de: "2026-09-01",
      ate: "2026-09-30",
    });
    expect(res.ok && res.data.linhas[0]?.data).toBe("2026-09-05");
    expect(res.ok && res.data.contas).toEqual(CONTAS);
  });
});

describe("criarLancamento", () => {
  beforeEach(resetar);

  it("recusa conta desativada ou fora do plano, sem create", async () => {
    mocks.contaFindUnique.mockResolvedValue({ ativa: false });
    expect((await criarLancamento(LANCAMENTO_VALIDO)).ok).toBe(false);
    mocks.contaFindUnique.mockResolvedValue(null);
    expect(
      (await criarLancamento({ ...LANCAMENTO_VALIDO, conta: "9.9" })).ok
    ).toBe(false);
    expect(mocks.lancCreate).not.toHaveBeenCalled();
  });

  it("recusa valorCentavos <= 0, competência inválida e data inválida", async () => {
    expect(
      (await criarLancamento({ ...LANCAMENTO_VALIDO, valorCentavos: 0 })).ok
    ).toBe(false);
    expect(
      (
        await criarLancamento({
          ...LANCAMENTO_VALIDO,
          competencia: "2026-9",
        })
      ).ok
    ).toBe(false);
    expect(
      (await criarLancamento({ ...LANCAMENTO_VALIDO, data: "05-09-2026" })).ok
    ).toBe(false);
    expect(mocks.lancCreate).not.toHaveBeenCalled();
  });

  it("grava com tenantId e data como Date UTC do ISO, audita e revalida", async () => {
    const res = await criarLancamento(LANCAMENTO_VALIDO);
    expect(res.ok).toBe(true);
    expect(mocks.lancCreate.mock.calls[0][0].data).toMatchObject({
      tenantId: "system",
      competencia: "2026-09",
      conta: "1.1",
      valorCentavos: 5000,
    });
    expect(mocks.lancCreate.mock.calls[0][0].data.data).toEqual(
      new Date("2026-09-05T00:00:00Z")
    );
    expect(mocks.logPlatformAudit).toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/empresa/financeiro");
  });

  it("MEMBER não lança, nada chega ao banco", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });
    const res = await criarLancamento(LANCAMENTO_VALIDO);
    expect(res.ok).toBe(false);
    expect(mocks.lancCreate).not.toHaveBeenCalled();
  });
});

describe("atualizarLancamento", () => {
  beforeEach(resetar);

  it("usa updateMany com {id, tenantId}", async () => {
    const res = await atualizarLancamento({ ...LANCAMENTO_VALIDO, id: "l-1" });
    expect(res.ok).toBe(true);
    expect(mocks.lancUpdateMany.mock.calls[0][0].where).toEqual({
      id: "l-1",
      tenantId: "system",
    });
  });

  it("count === 0 devolve ok:false", async () => {
    mocks.lancUpdateMany.mockResolvedValue({ count: 0 });
    const res = await atualizarLancamento({ ...LANCAMENTO_VALIDO, id: "l-1" });
    expect(res.ok).toBe(false);
  });

  it("MEMBER não atualiza, nada chega ao banco", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });
    const res = await atualizarLancamento({ ...LANCAMENTO_VALIDO, id: "l-1" });
    expect(res.ok).toBe(false);
    expect(mocks.lancUpdateMany).not.toHaveBeenCalled();
  });

  it("recusa linha que veio de um título, mesma mensagem do excluir", async () => {
    mocks.lancFindFirst.mockResolvedValue({
      conta: "1.1",
      competencia: "2026-09",
      tituloId: "t-1",
    });
    const res = await atualizarLancamento({ ...LANCAMENTO_VALIDO, id: "l-1" });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toBe(
      "Lançamento veio de um título; cancele o título."
    );
    expect(mocks.lancUpdateMany).not.toHaveBeenCalled();
  });
});

describe("excluirLancamento", () => {
  beforeEach(resetar);

  it("recusa linha que veio de um título", async () => {
    mocks.lancFindFirst.mockResolvedValue({
      conta: "1.1",
      competencia: "2026-09",
      tituloId: "t-1",
    });
    const res = await excluirLancamento({ id: "l-1" });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toBe(
      "Lançamento veio de um título; cancele o título."
    );
    expect(mocks.lancDeleteMany).not.toHaveBeenCalled();
  });

  it("exclui linha sem título", async () => {
    const res = await excluirLancamento({ id: "l-1" });
    expect(res.ok).toBe(true);
    expect(mocks.lancDeleteMany.mock.calls[0][0].where).toEqual({
      id: "l-1",
      tenantId: "system",
    });
  });

  it("MEMBER não exclui, nada chega ao banco", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });
    const res = await excluirLancamento({ id: "l-1" });
    expect(res.ok).toBe(false);
    expect(mocks.lancDeleteMany).not.toHaveBeenCalled();
  });
});
