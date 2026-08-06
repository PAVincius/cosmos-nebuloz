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
  versionCreate: vi.fn(),
  versionAggregate: vi.fn(),
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
    },
    ipAssetVersion: {
      create: mocks.versionCreate,
      aggregate: mocks.versionAggregate,
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

function resetar() {
  for (const m of Object.values(mocks)) {
    m.mockReset();
  }
  mocks.requirePlatformStaff.mockResolvedValue(staff);
  mocks.findMany.mockResolvedValue([]);
  mocks.transaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) =>
      await fn({
        ipAsset: { create: mocks.create, update: mocks.update },
        ipAssetVersion: {
          create: mocks.versionCreate,
          aggregate: mocks.versionAggregate,
        },
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

    const res = await createIpAssetAction({
      nome: "Playbook de intake",
      conteudo: "x",
    });

    expect(res.ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("nasce na versão 1, com o mesmo texto nos dois lugares", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "i-1", slug: "playbook-de-intake" });

    await createIpAssetAction({
      nome: "Playbook de intake",
      conteudo: "conteúdo inicial",
    });

    const versao = mocks.versionCreate.mock.calls[0][0].data;
    expect(versao.versao).toBe(1);
    expect(versao.conteudo).toBe("conteúdo inicial");
    expect(mocks.create.mock.calls[0][0].data.conteudo).toBe(
      "conteúdo inicial"
    );
  });

  it("recusa slug repetido", async () => {
    mocks.findFirst.mockResolvedValue({ id: "ja-existe" });

    const res = await createIpAssetAction({
      nome: "Playbook de intake",
      conteudo: "x",
    });

    expect(res.ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("recusa tipo fora da lista", async () => {
    const res = await createIpAssetAction({
      nome: "X",
      conteudo: "x",
      tipo: "PDF" as "DOCUMENTO",
    });

    expect(res.ok).toBe(false);
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
