// capacity.test.ts — capacidade da equipe, por pessoa.
//
// Por pessoa e não por papel: a equipe é multidisciplinar e a maioria é
// fullstack. Modelar por papel obrigaria a eleger um papel principal para cada
// um e perderia exatamente a flexibilidade que existe.
//
// O invariante que carrega a action é a soma no PERÍODO. Duas alocações de 60%
// só se somam se os períodos se cruzam — tratar toda alocação como concorrente
// diria que ninguém cabe em lugar nenhum, e a tela viraria ruído.
//
// Passar de 100% é permitido, mas nunca em silêncio: exige motivo, igual ao
// override de WIP do Cosmos. Recusar sempre impediria registrar a realidade
// quando a realidade é de sobrecarga; aceitar sem marcar faria a tela mentir.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  logPlatformAudit: vi.fn(),
  personFindMany: vi.fn(),
  personFindFirst: vi.fn(),
  personCreate: vi.fn(),
  engagementFindFirst: vi.fn(),
  allocFindMany: vi.fn(),
  allocCreate: vi.fn(),
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
    staffPerson: {
      findMany: mocks.personFindMany,
      findFirst: mocks.personFindFirst,
      create: mocks.personCreate,
    },
    engagement: { findFirst: mocks.engagementFindFirst },
    staffAllocation: {
      findMany: mocks.allocFindMany,
      create: mocks.allocCreate,
    },
  },
}));

import {
  allocatePersonAction,
  createPersonAction,
  listCapacity,
} from "../app/actions/capacity";

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
  mocks.personFindMany.mockResolvedValue([]);
  mocks.allocFindMany.mockResolvedValue([]);
  mocks.personFindFirst.mockResolvedValue({
    id: "p-1",
    nome: "Ana",
    email: "ana@nebuloz.com",
    horasSemana: 40,
  });
  mocks.engagementFindFirst.mockResolvedValue({
    id: "e-1",
    codigo: "ENG-01",
    nome: "Piloto",
  });
  mocks.allocCreate.mockResolvedValue({ id: "a-1" });
}

const BASE = {
  personId: "p-1",
  engagementId: "e-1",
  percentual: 50,
  inicioEm: "2026-09-01",
};

describe("createPersonAction", () => {
  beforeEach(resetar);

  it("MEMBER não cadastra pessoa", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });

    const res = await createPersonAction({
      nome: "Ana",
      email: "ana@nebuloz.com",
    });

    expect(res.ok).toBe(false);
    expect(mocks.personCreate).not.toHaveBeenCalled();
  });

  it("guarda habilidades como lista", async () => {
    mocks.personFindFirst.mockResolvedValue(null);
    mocks.personCreate.mockResolvedValue({ id: "p-9", nome: "Ana" });

    await createPersonAction({
      nome: "Ana",
      email: "ana@nebuloz.com",
      habilidades: ["frontend", "backend"],
    });

    // Lista porque quase todo mundo aqui faz mais de uma coisa.
    expect(mocks.personCreate.mock.calls[0][0].data.habilidades).toEqual([
      "frontend",
      "backend",
    ]);
  });

  it("recusa e-mail repetido", async () => {
    mocks.personFindFirst.mockResolvedValue({ id: "ja-existe" });

    const res = await createPersonAction({
      nome: "Ana",
      email: "ana@nebuloz.com",
    });

    expect(res.ok).toBe(false);
    expect(mocks.personCreate).not.toHaveBeenCalled();
  });
});

describe("allocatePersonAction — a soma no período", () => {
  beforeEach(resetar);

  it("aloca quando cabe", async () => {
    mocks.allocFindMany.mockResolvedValue([
      { percentual: 30, inicioEm: new Date("2026-09-01"), fimEm: null },
    ]);

    const res = await allocatePersonAction({ ...BASE, percentual: 50 });

    expect(res.ok).toBe(true);
    expect(mocks.allocCreate).toHaveBeenCalled();
  });

  it("recusa quando passa de 100% e não veio motivo", async () => {
    mocks.allocFindMany.mockResolvedValue([
      { percentual: 80, inicioEm: new Date("2026-09-01"), fimEm: null },
    ]);

    const res = await allocatePersonAction({ ...BASE, percentual: 50 });

    expect(res.ok).toBe(false);
    expect(mocks.allocCreate).not.toHaveBeenCalled();
  });

  it("aceita passar de 100% com motivo — e registra o motivo", async () => {
    mocks.allocFindMany.mockResolvedValue([
      { percentual: 80, inicioEm: new Date("2026-09-01"), fimEm: null },
    ]);

    const res = await allocatePersonAction({
      ...BASE,
      percentual: 50,
      motivoExcesso: "Cobertura de férias por duas semanas, combinado com Ana.",
    });

    expect(res.ok).toBe(true);
    const entrada = mocks.logPlatformAudit.mock.calls[0][1];
    expect(entrada.note).toContain("férias");
  });

  it("alocação que NÃO cruza o período não conta na soma", async () => {
    mocks.allocFindMany.mockResolvedValue([
      {
        percentual: 90,
        inicioEm: new Date("2026-01-01"),
        fimEm: new Date("2026-02-01"),
      },
    ]);

    const res = await allocatePersonAction({
      ...BASE,
      percentual: 90,
      inicioEm: "2026-09-01",
    });

    // Tratar toda alocação como concorrente diria que ninguém cabe em lugar
    // nenhum, e a tela viraria ruído.
    expect(res.ok).toBe(true);
  });

  it("recusa percentual fora de 1..100", async () => {
    const zero = await allocatePersonAction({ ...BASE, percentual: 0 });
    const demais = await allocatePersonAction({ ...BASE, percentual: 101 });

    expect(zero.ok).toBe(false);
    expect(demais.ok).toBe(false);
  });

  it("recusa pessoa inexistente", async () => {
    mocks.personFindFirst.mockResolvedValue(null);

    const res = await allocatePersonAction(BASE);

    expect(res.ok).toBe(false);
    expect(mocks.allocCreate).not.toHaveBeenCalled();
  });

  it("recusa engajamento inexistente", async () => {
    mocks.engagementFindFirst.mockResolvedValue(null);

    const res = await allocatePersonAction(BASE);

    expect(res.ok).toBe(false);
  });

  it("MEMBER não aloca", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });

    const res = await allocatePersonAction(BASE);

    expect(res.ok).toBe(false);
    expect(mocks.allocCreate).not.toHaveBeenCalled();
  });
});

describe("listCapacity", () => {
  beforeEach(resetar);

  it("é leitura de todo staff", async () => {
    const res = await listCapacity();

    expect(res.ok).toBe(true);
    expect(mocks.assertCanWrite).not.toHaveBeenCalled();
  });

  it("soma só o que está em curso hoje", async () => {
    mocks.personFindMany.mockResolvedValue([
      {
        id: "p-1",
        nome: "Ana",
        email: "ana@nebuloz.com",
        habilidades: ["frontend"],
        horasSemana: 40,
        ativo: true,
        alocacoes: [
          {
            percentual: 60,
            inicioEm: new Date("2020-01-01"),
            fimEm: new Date("2020-02-01"),
            engagement: { codigo: "ENG-00", nome: "Antigo" },
          },
          {
            percentual: 40,
            inicioEm: new Date("2020-01-01"),
            fimEm: null,
            engagement: { codigo: "ENG-01", nome: "Atual" },
          },
        ],
      },
    ]);

    const res = await listCapacity();

    if (!res.ok) {
      return;
    }
    // Alocação encerrada em 2020 não ocupa ninguém hoje.
    expect(res.data[0].ocupacaoAtual).toBe(40);
  });
});
