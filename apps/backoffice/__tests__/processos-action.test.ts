// processos-action.test.ts — CRUD de processo e ligação do mapa de processos.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  logPlatformAudit: vi.fn(),
  revalidatePath: vi.fn(),
  staffProcessFindMany: vi.fn(),
  staffProcessFindFirst: vi.fn(),
  staffProcessCreate: vi.fn(),
  staffProcessUpdateMany: vi.fn(),
  staffProcessDelete: vi.fn(),
  staffProcessEdgeFindMany: vi.fn(),
  staffProcessEdgeFindFirst: vi.fn(),
  staffProcessEdgeCreate: vi.fn(),
  staffProcessEdgeDelete: vi.fn(),
  staffDiagramFindMany: vi.fn(),
  staffDiagramFindFirst: vi.fn(),
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
    staffProcess: {
      findMany: mocks.staffProcessFindMany,
      findFirst: mocks.staffProcessFindFirst,
      create: mocks.staffProcessCreate,
      updateMany: mocks.staffProcessUpdateMany,
      delete: mocks.staffProcessDelete,
    },
    staffProcessEdge: {
      findMany: mocks.staffProcessEdgeFindMany,
      findFirst: mocks.staffProcessEdgeFindFirst,
      create: mocks.staffProcessEdgeCreate,
      delete: mocks.staffProcessEdgeDelete,
    },
    staffDiagram: {
      findMany: mocks.staffDiagramFindMany,
      findFirst: mocks.staffDiagramFindFirst,
    },
  },
}));

import {
  atualizarProcesso,
  criarLigacao,
  criarProcesso,
  excluirProcesso,
  listarProcessos,
} from "../app/actions/processos";

const staff = {
  userId: "u-1",
  name: "Vinícius",
  email: "v@nebuloz.com",
  canWrite: true,
};

type ProcessoInput = Parameters<typeof criarProcesso>[0];

function processoValido(over: Partial<ProcessoInput> = {}): ProcessoInput {
  return {
    codigo: "PZ-01",
    nome: "Descoberta comercial",
    descricao: "Do primeiro contato até o discovery qualificado.",
    dominio: "COMERCIAL",
    nivel: 1,
    tipo: "CORE",
    donoNome: "Vinícius",
    revisadoEm: null,
    tags: ["vendas"],
    diagramId: null,
    docUrl: null,
    ...over,
  };
}

function refusaLeitura() {
  mocks.assertCanWrite.mockImplementation(() => {
    throw new Error("Somente leitura");
  });
}

function resetar() {
  for (const m of Object.values(mocks)) {
    m.mockReset();
  }
  mocks.requirePlatformStaff.mockResolvedValue(staff);
  mocks.staffProcessFindFirst.mockResolvedValue(null);
  mocks.staffProcessEdgeFindFirst.mockResolvedValue(null);
  mocks.staffProcessUpdateMany.mockResolvedValue({ count: 1 });
  mocks.staffProcessCreate.mockResolvedValue({ id: "p-1", codigo: "PZ-01" });
  mocks.staffProcessEdgeCreate.mockResolvedValue({ id: "e-1" });
  mocks.staffProcessFindMany.mockResolvedValue([]);
  mocks.staffProcessEdgeFindMany.mockResolvedValue([]);
  mocks.staffDiagramFindMany.mockResolvedValue([]);
}

describe("listarProcessos", () => {
  beforeEach(resetar);

  it("filtra por tenantId system nas três consultas (processos, ligações, diagramas BPMN)", async () => {
    const res = await listarProcessos();

    expect(res.ok).toBe(true);
    expect(mocks.staffProcessFindMany.mock.calls[0][0].where).toMatchObject({
      tenantId: "system",
    });
    expect(mocks.staffProcessEdgeFindMany.mock.calls[0][0].where).toMatchObject(
      { tenantId: "system" }
    );
    expect(mocks.staffDiagramFindMany.mock.calls[0][0].where).toMatchObject({
      tenantId: "system",
      kind: "BPMN",
    });
  });
});

describe("criarProcesso", () => {
  beforeEach(resetar);

  it("código já existente devolve ok:false sem chamar create", async () => {
    mocks.staffProcessFindFirst.mockResolvedValue({ id: "p-0" });

    const res = await criarProcesso(processoValido());

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("Já existe PZ-01.");
    }
    expect(mocks.staffProcessCreate).not.toHaveBeenCalled();
  });

  it.each([
    "PZ-1",
    "X-01",
  ])("recusa código fora do formato: %s", async (codigo) => {
    const res = await criarProcesso(processoValido({ codigo }));

    expect(res.ok).toBe(false);
    expect(mocks.staffProcessCreate).not.toHaveBeenCalled();
  });

  it("grava logPlatformAudit e revalida /ferramentas/processos", async () => {
    const res = await criarProcesso(processoValido());

    expect(res.ok).toBe(true);
    expect(mocks.logPlatformAudit).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ferramentas/processos");
  });

  it("diagramId de diagrama que não é BPMN devolve ok:false", async () => {
    mocks.staffDiagramFindFirst.mockResolvedValue({ kind: "MERMAID" });

    const res = await criarProcesso(processoValido({ diagramId: "d-1" }));

    expect(res.ok).toBe(false);
    expect(mocks.staffProcessCreate).not.toHaveBeenCalled();
  });

  it("MEMBER não cria", async () => {
    refusaLeitura();

    const res = await criarProcesso(processoValido());

    expect(res.ok).toBe(false);
    expect(mocks.staffProcessCreate).not.toHaveBeenCalled();
  });
});

describe("atualizarProcesso", () => {
  beforeEach(resetar);

  it("usa updateMany com o tenantId no where", async () => {
    const res = await atualizarProcesso({ id: "p-1", ...processoValido() });

    expect(res.ok).toBe(true);
    expect(mocks.staffProcessUpdateMany.mock.calls[0][0].where).toMatchObject({
      id: "p-1",
      tenantId: "system",
    });
  });

  it("trata count 0 (processo não encontrado nesse tenant) como erro", async () => {
    mocks.staffProcessUpdateMany.mockResolvedValue({ count: 0 });

    const res = await atualizarProcesso({ id: "p-1", ...processoValido() });

    expect(res.ok).toBe(false);
  });

  it("código já usado por outro processo devolve ok:false sem chamar updateMany", async () => {
    mocks.staffProcessFindFirst.mockResolvedValue({ id: "p-outro" });

    const res = await atualizarProcesso({
      id: "p-1",
      ...processoValido({ codigo: "PZ-01" }),
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("Já existe PZ-01.");
    }
    expect(mocks.staffProcessUpdateMany).not.toHaveBeenCalled();
  });

  it("MEMBER não atualiza", async () => {
    refusaLeitura();

    const res = await atualizarProcesso({ id: "p-1", ...processoValido() });

    expect(res.ok).toBe(false);
    expect(mocks.staffProcessUpdateMany).not.toHaveBeenCalled();
  });
});

describe("excluirProcesso", () => {
  beforeEach(resetar);

  it("chama delete e registra código e nome na auditoria", async () => {
    mocks.staffProcessFindFirst.mockResolvedValue({
      id: "p-1",
      codigo: "PZ-01",
      nome: "Descoberta comercial",
    });

    const res = await excluirProcesso({ id: "p-1" });

    expect(res.ok).toBe(true);
    expect(mocks.staffProcessDelete).toHaveBeenCalledWith({
      where: { id: "p-1" },
    });
    const entrada = mocks.logPlatformAudit.mock.calls[0][1];
    expect(entrada.target).toContain("PZ-01");
    expect(entrada.target).toContain("Descoberta comercial");
  });

  it("MEMBER não exclui", async () => {
    refusaLeitura();

    const res = await excluirProcesso({ id: "p-1" });

    expect(res.ok).toBe(false);
    expect(mocks.staffProcessDelete).not.toHaveBeenCalled();
  });
});

describe("criarLigacao", () => {
  beforeEach(resetar);

  it("deId === paraId devolve ok:false sem chamar create", async () => {
    const res = await criarLigacao({
      deId: "p-1",
      paraId: "p-1",
      rotulo: "converte em",
    });

    expect(res.ok).toBe(false);
    expect(mocks.staffProcessEdgeCreate).not.toHaveBeenCalled();
  });

  it("par já existente devolve 'Ligação já existe.'", async () => {
    mocks.staffProcessFindMany.mockResolvedValue([
      { id: "p-1", codigo: "PZ-01" },
      { id: "p-2", codigo: "PZ-02" },
    ]);
    mocks.staffProcessEdgeFindFirst.mockResolvedValue({ id: "e-0" });

    const res = await criarLigacao({
      deId: "p-1",
      paraId: "p-2",
      rotulo: "converte em",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("Ligação já existe.");
    }
    expect(mocks.staffProcessEdgeCreate).not.toHaveBeenCalled();
  });

  it("id de outro tenant (não vem na leitura escopada) devolve ok:false sem chamar create", async () => {
    mocks.staffProcessFindMany.mockResolvedValue([
      { id: "p-1", codigo: "PZ-01" },
    ]);

    const res = await criarLigacao({
      deId: "p-1",
      paraId: "p-de-outro-tenant",
      rotulo: "converte em",
    });

    expect(res.ok).toBe(false);
    expect(mocks.staffProcessEdgeCreate).not.toHaveBeenCalled();
  });

  it("grava a auditoria com os códigos dos dois processos, não os ids", async () => {
    mocks.staffProcessFindMany.mockResolvedValue([
      { id: "p-1", codigo: "PZ-01" },
      { id: "p-2", codigo: "PZ-02" },
    ]);

    const res = await criarLigacao({
      deId: "p-1",
      paraId: "p-2",
      rotulo: "converte em",
    });

    expect(res.ok).toBe(true);
    const entrada = mocks.logPlatformAudit.mock.calls[0][1];
    expect(entrada.target).toBe("PZ-01 → PZ-02");
  });

  it("MEMBER não cria ligação", async () => {
    refusaLeitura();

    const res = await criarLigacao({
      deId: "p-1",
      paraId: "p-2",
      rotulo: "converte em",
    });

    expect(res.ok).toBe(false);
    expect(mocks.staffProcessEdgeCreate).not.toHaveBeenCalled();
  });
});
