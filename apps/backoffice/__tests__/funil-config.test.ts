// funil-config.test.ts — configuração do funil v2 (peso/teto por estágio,
// registro append-only de mudanças, CAC médio por canal).
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  logPlatformAudit: vi.fn(),
  estagioDoFunilFindFirst: vi.fn(),
  estagioDoFunilUpdateMany: vi.fn(),
  mudancaDeEstagioFindMany: vi.fn(),
  mudancaDeEstagioCreate: vi.fn(),
  canalDeLeadFindFirst: vi.fn(),
  canalDeLeadUpdateMany: vi.fn(),
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
    estagioDoFunil: {
      findFirst: mocks.estagioDoFunilFindFirst,
      updateMany: mocks.estagioDoFunilUpdateMany,
    },
    mudancaDeEstagio: {
      findMany: mocks.mudancaDeEstagioFindMany,
      create: mocks.mudancaDeEstagioCreate,
    },
    canalDeLead: {
      findFirst: mocks.canalDeLeadFindFirst,
      updateMany: mocks.canalDeLeadUpdateMany,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  atualizarCanal,
  atualizarEstagio,
  lerEstagio,
} from "../app/actions/funil-config";

const staff = {
  userId: "u-1",
  name: "Vinícius",
  email: "v@nebuloz.com",
  canWrite: true,
};

const tx = {
  estagioDoFunil: { updateMany: mocks.estagioDoFunilUpdateMany },
  mudancaDeEstagio: { create: mocks.mudancaDeEstagioCreate },
};

function resetar() {
  for (const m of Object.values(mocks)) {
    m.mockReset();
  }
  mocks.requirePlatformStaff.mockResolvedValue(staff);
  mocks.mudancaDeEstagioFindMany.mockResolvedValue([]);
  // `updateMany` real devolve `{ count }` — `count: 1` é o caminho feliz
  // (nenhuma concorrência); o teste de corrida sobrescreve para `0`.
  mocks.estagioDoFunilUpdateMany.mockResolvedValue({ count: 1 });
  mocks.canalDeLeadUpdateMany.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(
    async (fn: (t: unknown) => Promise<unknown>) => await fn(tx)
  );
}

function estagioAtual(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "e-1",
    codigo: "DISCOVERY",
    pesoPercent: 30,
    tetoDias: 14,
    criterios: ["Sponsor identificado", "Problema descrito"],
    ...over,
  };
}

describe("lerEstagio", () => {
  beforeEach(resetar);

  it("devolve config e mudanças ordenadas por criadoEm desc", async () => {
    mocks.estagioDoFunilFindFirst.mockResolvedValue(estagioAtual());
    mocks.mudancaDeEstagioFindMany.mockResolvedValue([
      {
        id: "m-1",
        campo: "PESO",
        de: "20%",
        para: "30%",
        motivo: "Recalibrado após revisão trimestral do pipeline",
        autorNome: "Vinícius",
        criadoEm: new Date("2026-09-01"),
      },
    ]);

    const res = await lerEstagio({ codigo: "DISCOVERY" });

    expect(res.ok).toBe(true);
    expect(mocks.mudancaDeEstagioFindMany.mock.calls[0][0].orderBy).toEqual({
      criadoEm: "desc",
    });
    if (res.ok) {
      expect(res.data.config).toMatchObject({
        codigo: "DISCOVERY",
        pesoPercent: 30,
        tetoDias: 14,
      });
      expect(res.data.mudancas[0]).toMatchObject({
        campo: "PESO",
        de: "20%",
        para: "30%",
      });
    }
  });

  it("recusa estágio sem configuração", async () => {
    mocks.estagioDoFunilFindFirst.mockResolvedValue(null);

    const res = await lerEstagio({ codigo: "LEAD" });

    expect(res.ok).toBe(false);
  });
});

describe("atualizarEstagio", () => {
  beforeEach(resetar);

  it("MEMBER não atualiza", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });

    const res = await atualizarEstagio({
      codigo: "DISCOVERY",
      pesoPercent: 40,
      motivo: "Recalibrado após revisão trimestral do pipeline",
    });

    expect(res.ok).toBe(false);
    expect(mocks.estagioDoFunilUpdateMany).not.toHaveBeenCalled();
  });

  it("recusa motivo curto", async () => {
    mocks.estagioDoFunilFindFirst.mockResolvedValue(estagioAtual());

    const res = await atualizarEstagio({
      codigo: "DISCOVERY",
      pesoPercent: 40,
      motivo: "curto demais",
    });

    expect(res.ok).toBe(false);
    expect(mocks.estagioDoFunilUpdateMany).not.toHaveBeenCalled();
  });

  it("recusa quando nada mudou", async () => {
    mocks.estagioDoFunilFindFirst.mockResolvedValue(estagioAtual());

    const res = await atualizarEstagio({
      codigo: "DISCOVERY",
      pesoPercent: 30,
      tetoDias: 14,
      criterios: ["Sponsor identificado", "Problema descrito"],
      motivo: "Recalibrado após revisão trimestral do pipeline",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("Nada mudou.");
    }
    expect(mocks.estagioDoFunilUpdateMany).not.toHaveBeenCalled();
  });

  it("grava uma MudancaDeEstagio por campo alterado", async () => {
    mocks.estagioDoFunilFindFirst.mockResolvedValue(estagioAtual());

    const res = await atualizarEstagio({
      codigo: "DISCOVERY",
      pesoPercent: 40,
      tetoDias: 21,
      criterios: [
        "Sponsor identificado",
        "Problema descrito",
        "Orçamento confirmado",
      ],
      motivo: "Recalibrado após revisão trimestral do pipeline",
    });

    expect(res.ok).toBe(true);
    expect(mocks.estagioDoFunilUpdateMany.mock.calls[0][0].data).toMatchObject({
      pesoPercent: 40,
      tetoDias: 21,
      criterios: [
        "Sponsor identificado",
        "Problema descrito",
        "Orçamento confirmado",
      ],
    });
    expect(mocks.mudancaDeEstagioCreate).toHaveBeenCalledTimes(3);

    const campos = mocks.mudancaDeEstagioCreate.mock.calls.map(
      (c) => c[0].data.campo
    );
    expect(campos.sort()).toEqual(["CRITERIOS", "PESO", "TETO"]);

    const peso = mocks.mudancaDeEstagioCreate.mock.calls.find(
      (c) => c[0].data.campo === "PESO"
    )?.[0].data;
    expect(peso).toMatchObject({ de: "30%", para: "40%" });

    const teto = mocks.mudancaDeEstagioCreate.mock.calls.find(
      (c) => c[0].data.campo === "TETO"
    )?.[0].data;
    expect(teto).toMatchObject({ de: "14 d", para: "21 d" });

    const criterios = mocks.mudancaDeEstagioCreate.mock.calls.find(
      (c) => c[0].data.campo === "CRITERIOS"
    )?.[0].data;
    expect(criterios).toMatchObject({ de: "2 itens", para: "3 itens" });
  });

  it("grava só o campo que mudou quando os outros ficam iguais", async () => {
    mocks.estagioDoFunilFindFirst.mockResolvedValue(estagioAtual());

    const res = await atualizarEstagio({
      codigo: "DISCOVERY",
      pesoPercent: 30,
      tetoDias: 30,
      motivo: "Recalibrado após revisão trimestral do pipeline",
    });

    expect(res.ok).toBe(true);
    expect(mocks.mudancaDeEstagioCreate).toHaveBeenCalledTimes(1);
    expect(mocks.mudancaDeEstagioCreate.mock.calls[0][0].data.campo).toBe(
      "TETO"
    );
  });

  it("recusa estágio sem configuração", async () => {
    mocks.estagioDoFunilFindFirst.mockResolvedValue(null);

    const res = await atualizarEstagio({
      codigo: "LEAD",
      pesoPercent: 20,
      motivo: "Recalibrado após revisão trimestral do pipeline",
    });

    expect(res.ok).toBe(false);
    expect(mocks.estagioDoFunilUpdateMany).not.toHaveBeenCalled();
  });

  it("recusa motivo acima de 1000 caracteres", async () => {
    mocks.estagioDoFunilFindFirst.mockResolvedValue(estagioAtual());

    const res = await atualizarEstagio({
      codigo: "DISCOVERY",
      pesoPercent: 40,
      motivo: "a".repeat(1001),
    });

    expect(res.ok).toBe(false);
    expect(mocks.estagioDoFunilUpdateMany).not.toHaveBeenCalled();
  });

  it("recusa mais de 20 critérios", async () => {
    mocks.estagioDoFunilFindFirst.mockResolvedValue(estagioAtual());

    const res = await atualizarEstagio({
      codigo: "DISCOVERY",
      criterios: Array.from({ length: 21 }, (_, i) => `Critério ${i}`),
      motivo: "Recalibrado após revisão trimestral do pipeline",
    });

    expect(res.ok).toBe(false);
    expect(mocks.estagioDoFunilUpdateMany).not.toHaveBeenCalled();
  });

  it("estágio mudou de configuração entre a leitura e a escrita: recusa sem duplicar a mudança", async () => {
    mocks.estagioDoFunilFindFirst.mockResolvedValue(estagioAtual());
    mocks.estagioDoFunilUpdateMany.mockResolvedValue({ count: 0 });

    const res = await atualizarEstagio({
      codigo: "DISCOVERY",
      pesoPercent: 40,
      motivo: "Recalibrado após revisão trimestral do pipeline",
    });

    expect(res.ok).toBe(false);
    expect(mocks.mudancaDeEstagioCreate).not.toHaveBeenCalled();
  });
});

describe("atualizarCanal", () => {
  beforeEach(resetar);

  it("MEMBER não atualiza", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });

    const res = await atualizarCanal({
      slug: "indicacao",
      cacMedioCentavos: 5000,
    });

    expect(res.ok).toBe(false);
    expect(mocks.canalDeLeadUpdateMany).not.toHaveBeenCalled();
  });

  it("recusa canal inexistente", async () => {
    mocks.canalDeLeadFindFirst.mockResolvedValue(null);

    const res = await atualizarCanal({
      slug: "inexistente",
      cacMedioCentavos: 5000,
    });

    expect(res.ok).toBe(false);
    expect(mocks.canalDeLeadUpdateMany).not.toHaveBeenCalled();
  });

  it("grava o CAC médio informado", async () => {
    mocks.canalDeLeadFindFirst.mockResolvedValue({
      id: "c-1",
      cacMedioCentavos: null,
    });

    const res = await atualizarCanal({
      slug: "indicacao",
      cacMedioCentavos: 5000,
    });

    expect(res.ok).toBe(true);
    expect(mocks.canalDeLeadUpdateMany.mock.calls[0][0].data).toMatchObject({
      cacMedioCentavos: 5000,
    });
  });

  it("grava nulo — canal volta a não ter CAC medido", async () => {
    mocks.canalDeLeadFindFirst.mockResolvedValue({
      id: "c-1",
      cacMedioCentavos: 5000,
    });

    const res = await atualizarCanal({
      slug: "indicacao",
      cacMedioCentavos: null,
    });

    expect(res.ok).toBe(true);
    expect(mocks.canalDeLeadUpdateMany.mock.calls[0][0].data).toMatchObject({
      cacMedioCentavos: null,
    });
  });

  it("canal mudou de configuração entre a leitura e a escrita: recusa", async () => {
    mocks.canalDeLeadFindFirst.mockResolvedValue({
      id: "c-1",
      cacMedioCentavos: null,
    });
    mocks.canalDeLeadUpdateMany.mockResolvedValue({ count: 0 });

    const res = await atualizarCanal({
      slug: "indicacao",
      cacMedioCentavos: 5000,
    });

    expect(res.ok).toBe(false);
  });
});
