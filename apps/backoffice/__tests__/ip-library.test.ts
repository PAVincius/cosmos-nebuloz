// ip-library.test.ts — acervo de ativos reutilizáveis entre engajamentos.
//
// Versionado como os diagramas, e pelo mesmo motivo: o valor de um ativo
// reusado num cliente novo está em saber o que mudou entre a v3 e a v4.
//
// Os dois invariantes são os mesmos do StaffDiagram, e estão aqui porque um
// teste que vale para duas entidades precisa rodar nas duas — confiar que "é
// igual" é como a segunda cópia diverge sem ninguém ver.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  logPlatformAudit: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  versionCreate: vi.fn(),
  versionAggregate: vi.fn(),
  serviceCreateMany: vi.fn(),
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
    ipAsset: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
      create: mocks.create,
      update: mocks.update,
      findUniqueOrThrow: mocks.findUniqueOrThrow,
    },
    ipAssetVersion: {
      create: mocks.versionCreate,
      aggregate: mocks.versionAggregate,
    },
    ipAssetService: {
      createMany: mocks.serviceCreateMany,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  createIpAssetAction,
  listIpAssets,
  updateIpAssetAction,
} from "../app/actions/ip-library";

const staff = {
  userId: "u-1",
  name: "Vinícius",
  email: "v@nebuloz.com",
  canWrite: true,
};

// 77 caracteres — acima do mínimo de 40 que o schema e a régua (IP-R2) exigem.
const DESCRICAO_VALIDA =
  "Descrição do ativo, com detalhe suficiente para a régua aceitar sem reservas.";

/** Entrada que passa no schema E nos seis critérios da régua, com valores
 * default (procedência interna, licença nenhuma) — o caso comum de quem só
 * quer cadastrar um ativo próprio. */
function entradaValida(overrides: Record<string, unknown> = {}) {
  return {
    nome: "Playbook de intake",
    descricao: DESCRICAO_VALIDA,
    conteudo: "conteúdo inicial",
    viveAqui: true,
    servicoIds: ["srv-1"],
    ...overrides,
  };
}

/** Linha bruta que `tx.ipAsset.findUniqueOrThrow` devolveria ao final da
 * transação — mesma forma de `CAMPOS_LINHA` em ip-library.ts. */
function linhaBrutaPadrao(overrides: Record<string, unknown> = {}) {
  return {
    id: "i-1",
    nome: "Playbook de intake",
    slug: "playbook-de-intake",
    tipo: "DOCUMENTO",
    descricao: DESCRICAO_VALIDA,
    link: null,
    procedencia: "INTERNO",
    licenca: "NENHUMA",
    atualizadoEm: new Date("2026-09-01T00:00:00Z"),
    origem: null,
    dono: null,
    servicos: [{ service: { id: "srv-1", codigo: "SRV1", nome: "Serviço 1" } }],
    reusos: [],
    _count: { versions: 1 },
    ...overrides,
  };
}

function resetar() {
  for (const m of Object.values(mocks)) {
    m.mockReset();
  }
  mocks.requirePlatformStaff.mockResolvedValue(staff);
  mocks.findMany.mockResolvedValue([]);
  mocks.findFirst.mockResolvedValue(null);
  mocks.create.mockResolvedValue({ id: "i-1" });
  mocks.findUniqueOrThrow.mockResolvedValue(linhaBrutaPadrao());
  mocks.transaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) =>
      await fn({
        ipAsset: {
          create: mocks.create,
          update: mocks.update,
          findUniqueOrThrow: mocks.findUniqueOrThrow,
        },
        ipAssetVersion: {
          create: mocks.versionCreate,
          aggregate: mocks.versionAggregate,
        },
        ipAssetService: { createMany: mocks.serviceCreateMany },
      })
  );
}

describe("listIpAssets", () => {
  beforeEach(resetar);

  it("é leitura de todo staff", async () => {
    const res = await listIpAssets();

    expect(res.ok).toBe(true);
    expect(mocks.assertCanWrite).not.toHaveBeenCalled();
  });

  it("não traz o conteúdo na listagem", async () => {
    await listIpAssets();

    // Um playbook tem dezenas de KB e a lista não renderiza nenhum deles.
    const args = mocks.findMany.mock.calls[0][0];
    expect(args.select).toBeDefined();
    expect(args.select.conteudo).toBeUndefined();
  });
});

describe("createIpAssetAction", () => {
  beforeEach(resetar);

  it("MEMBER não cria", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });

    const res = await createIpAssetAction(entradaValida());

    expect(res.ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("nasce na versão 1, com o mesmo texto nos dois lugares", async () => {
    await createIpAssetAction(entradaValida());

    const versao = mocks.versionCreate.mock.calls[0][0].data;
    expect(versao.versao).toBe(1);
    expect(versao.conteudo).toBe("conteúdo inicial");
    expect(mocks.create.mock.calls[0][0].data.conteudo).toBe(
      "conteúdo inicial"
    );
  });

  it("recusa slug repetido", async () => {
    mocks.findFirst.mockResolvedValue({ id: "ja-existe" });

    const res = await createIpAssetAction(entradaValida());

    expect(res.ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("recusa tipo fora da lista", async () => {
    const res = await createIpAssetAction(
      entradaValida({ tipo: "PDF" as "DOCUMENTO" })
    );

    expect(res.ok).toBe(false);
  });

  it("recusa descrição abaixo do mínimo de 40 caracteres", async () => {
    const res = await createIpAssetAction(
      entradaValida({ descricao: "Curta demais." })
    );

    expect(res.ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("recusa entrada sem nenhum serviço vinculado", async () => {
    const res = await createIpAssetAction(entradaValida({ servicoIds: [] }));

    expect(res.ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("a régua recusa procedência ENGAJAMENTO sem reuso confirmado (IP-R5)", async () => {
    const res = await createIpAssetAction(
      entradaValida({
        procedencia: "ENGAJAMENTO",
        origemEngagementId: "eng-1",
        reusoConfirmado: false,
      })
    );

    expect(res.ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("a régua recusa licença COPYLEFT sem referência (IP-R6)", async () => {
    const res = await createIpAssetAction(
      entradaValida({ licenca: "COPYLEFT", licencaRef: "" })
    );

    expect(res.ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("devolve a IpAssetRow completa, não só id e slug", async () => {
    mocks.findUniqueOrThrow.mockResolvedValue(
      linhaBrutaPadrao({
        reusos: [{ horasPoupadas: 3 }, { horasPoupadas: 2 }],
      })
    );

    const res = await createIpAssetAction(entradaValida());

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.id).toBe("i-1");
    expect(res.data.slug).toBe("playbook-de-intake");
    expect(res.data.procedencia).toBe("INTERNO");
    expect(res.data.licenca).toBe("NENHUMA");
    expect(res.data.servicos).toEqual([
      { id: "srv-1", codigo: "SRV1", nome: "Serviço 1" },
    ]);
    // Soma dos eventos de reuso, não uma média armazenada em outro lugar.
    expect(res.data.horasPoupadas).toBe(5);
    expect(res.data.reusos).toBe(2);
    expect(res.data.maturidade).toBe("COMPROVADO");
  });

  it("grava o vínculo de serviço na mesma transação que o ativo", async () => {
    await createIpAssetAction(
      entradaValida({ servicoIds: ["srv-1", "srv-2"] })
    );

    expect(mocks.serviceCreateMany).toHaveBeenCalledTimes(1);
    expect(mocks.serviceCreateMany.mock.calls[0][0].data).toEqual([
      { assetId: "i-1", serviceId: "srv-1" },
      { assetId: "i-1", serviceId: "srv-2" },
    ]);
    // O vínculo só existe porque rodou dentro do callback que o
    // `$transaction` mockado executa — fora dela, o mock nunca seria chamado.
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });
});

describe("updateIpAssetAction", () => {
  beforeEach(resetar);

  it("texto novo cria a revisão seguinte", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "i-1",
      nome: "Playbook",
      slug: "playbook",
      conteudo: "v1",
    });
    mocks.versionAggregate.mockResolvedValue({ _max: { versao: 2 } });

    const res = await updateIpAssetAction({
      id: "i-1",
      conteudo: "v2",
      nota: "revisa checklist",
    });

    expect(res.ok).toBe(true);
    expect(mocks.versionCreate.mock.calls[0][0].data.versao).toBe(3);
  });

  it("texto igual NÃO cria revisão", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "i-1",
      nome: "Playbook",
      slug: "playbook",
      conteudo: "igual",
    });

    const res = await updateIpAssetAction({ id: "i-1", conteudo: "igual" });

    expect(res.ok).toBe(true);
    expect(mocks.versionCreate).not.toHaveBeenCalled();
  });

  it("recusa ativo de outro tenant", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const res = await updateIpAssetAction({ id: "de-outro", conteudo: "x" });

    expect(res.ok).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
