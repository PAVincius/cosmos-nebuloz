// diagrams.test.ts — CRUD versionado de diagramas do back-office.
//
// Os dois invariantes que carregam esta action:
//
// 1. Editar cria revisão, nunca sobrescreve. "Versionado" sem histórico é só a
//    data da última gravação, e a pergunta que o operador realmente faz — o que
//    mudou entre a v3 e a v4 — fica sem resposta.
//
// 2. Gravar sem mudar o texto NÃO cria revisão. Sem isso, salvar duas vezes
//    seguidas enche o histórico de versões idênticas e o diff vira ruído — o
//    histórico deixa de ser útil exatamente por excesso de zelo.
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
  ProvisioningError: class extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/database", () => ({
  database: {
    staffDiagram: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
      create: mocks.create,
      update: mocks.update,
    },
    staffDiagramVersion: {
      create: mocks.versionCreate,
      aggregate: mocks.versionAggregate,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  createDiagramAction,
  listDiagrams,
  updateDiagramAction,
} from "../app/actions/diagrams";

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
  // O $transaction recebe um callback e recebe de volta o mesmo `database`.
  mocks.transaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) =>
      await fn({
        staffDiagram: {
          findFirst: mocks.findFirst,
          create: mocks.create,
          update: mocks.update,
        },
        staffDiagramVersion: {
          create: mocks.versionCreate,
          aggregate: mocks.versionAggregate,
        },
      })
  );
}

describe("listDiagrams", () => {
  beforeEach(resetar);

  it("é leitura de todo staff — não chama assertCanWrite", async () => {
    mocks.findMany.mockResolvedValue([]);

    const res = await listDiagrams("BPMN");

    expect(res.ok).toBe(true);
    expect(mocks.assertCanWrite).not.toHaveBeenCalled();
  });

  it("filtra pelo tipo pedido e pelo tenant do painel", async () => {
    mocks.findMany.mockResolvedValue([]);

    await listDiagrams("MERMAID");

    const args = mocks.findMany.mock.calls[0][0];
    expect(args.where.kind).toBe("MERMAID");
    expect(args.where.tenantId).toBe("system");
  });

  it("não devolve o source na listagem — a lista não renderiza diagrama", async () => {
    mocks.findMany.mockResolvedValue([]);

    await listDiagrams("BPMN");

    const args = mocks.findMany.mock.calls[0][0];
    expect(args.select).toBeDefined();
    expect(args.select.source).toBeUndefined();
  });
});

describe("createDiagramAction", () => {
  beforeEach(resetar);

  it("MEMBER não cria", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });

    const res = await createDiagramAction({
      kind: "BPMN",
      name: "Onboarding",
      source: "<xml/>",
    });

    expect(res.ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("nasce na versão 1, com o mesmo texto nos dois lugares", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "d-1", slug: "onboarding" });

    const res = await createDiagramAction({
      kind: "BPMN",
      name: "Onboarding",
      source: "<xml/>",
    });

    expect(res.ok).toBe(true);
    const versao = mocks.versionCreate.mock.calls[0][0].data;
    expect(versao.versao).toBe(1);
    expect(versao.source).toBe("<xml/>");
    expect(mocks.create.mock.calls[0][0].data.source).toBe("<xml/>");
  });

  it("recusa slug já usado — o unique do banco não deve ser a primeira barreira", async () => {
    mocks.findFirst.mockResolvedValue({ id: "ja-existe" });

    const res = await createDiagramAction({
      kind: "BPMN",
      name: "Onboarding",
      source: "<xml/>",
    });

    expect(res.ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("recusa tipo fora da lista", async () => {
    const res = await createDiagramAction({
      kind: "VISIO" as "BPMN",
      name: "X",
      source: "x",
    });

    expect(res.ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("registra na trilha de auditoria", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "d-1", slug: "onboarding" });

    await createDiagramAction({
      kind: "BPMN",
      name: "Onboarding",
      source: "<xml/>",
    });

    expect(mocks.logPlatformAudit).toHaveBeenCalled();
  });
});

describe("updateDiagramAction", () => {
  beforeEach(resetar);

  it("texto novo cria a revisão seguinte", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "d-1",
      slug: "onboarding",
      name: "Onboarding",
      source: "<xml v=1/>",
    });
    mocks.versionAggregate.mockResolvedValue({ _max: { versao: 3 } });

    const res = await updateDiagramAction({
      id: "d-1",
      source: "<xml v=2/>",
      nota: "corrige gateway",
    });

    expect(res.ok).toBe(true);
    const versao = mocks.versionCreate.mock.calls[0][0].data;
    expect(versao.versao).toBe(4);
    expect(versao.source).toBe("<xml v=2/>");
    expect(versao.nota).toBe("corrige gateway");
  });

  it("texto igual NÃO cria revisão — histórico não é log de cliques", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "d-1",
      slug: "onboarding",
      name: "Onboarding",
      source: "<xml v=1/>",
    });

    const res = await updateDiagramAction({ id: "d-1", source: "<xml v=1/>" });

    expect(res.ok).toBe(true);
    expect(mocks.versionCreate).not.toHaveBeenCalled();
  });

  it("recusa id de diagrama que não é deste tenant", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const res = await updateDiagramAction({ id: "de-outro", source: "x" });

    expect(res.ok).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("MEMBER não edita", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });

    const res = await updateDiagramAction({ id: "d-1", source: "x" });

    expect(res.ok).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
