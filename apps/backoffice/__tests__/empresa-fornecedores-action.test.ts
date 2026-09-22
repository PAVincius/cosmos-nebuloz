// empresa-fornecedores-action.test.ts — a exportação é a única escrita fora
// do tenant system: muda quatro colunas do CharterVendor e recomputa maxClass,
// e não toca notes, tier, score, subprocessors.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  logPlatformAudit: vi.fn(),
  revalidatePath: vi.fn(),
  findMany: vi.fn(),
  groupBy: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  tenantFindUnique: vi.fn(),
  vendorFindUnique: vi.fn(),
  vendorUpdate: vi.fn(),
  auditCreate: vi.fn(),
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
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const tx = {
  charterVendor: {
    findUnique: mocks.vendorFindUnique,
    update: mocks.vendorUpdate,
  },
  auditLog: { create: mocks.auditCreate },
};
vi.mock("@repo/database", () => ({
  database: {
    fornecedorDpa: {
      findMany: mocks.findMany,
      groupBy: mocks.groupBy,
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
    auditLog: { create: mocks.auditCreate },
  },
  withTenantDb: (_tenantId: string, fn: (db: typeof tx) => Promise<unknown>) =>
    fn(tx),
}));
vi.mock("@repo/provisioning", async () => {
  const rules = await vi.importActual<
    typeof import("@repo/provisioning/src/charter-rules")
  >("@repo/provisioning/src/charter-rules");
  return {
    logPlatformAudit: mocks.logPlatformAudit,
    ProvisioningError: class extends Error {},
    platformDb: { tenant: { findUnique: mocks.tenantFindUnique } },
    deriveVendorMaxClass: rules.deriveVendorMaxClass,
  };
});

import {
  aplicarAcaoDpa,
  atualizarFornecedorDpa,
  exportarAoCharter,
  listarFornecedoresDpa,
} from "../app/actions/empresa/fornecedores";

const staff = {
  userId: "u-1",
  name: "Vinícius",
  email: "v@nebuloz.com",
  canWrite: true,
};

const LINHA = {
  codigo: "V-08",
  nome: "Sentry",
  estado: "A_ASSINAR",
  classificacaoProvisoria: false,
  regiao: "US ou EU",
  retencao: null,
  transferencia: "SCCs + DPF",
  dpaUrl: "https://sentry.io/legal/dpa/",
  subprocessadoresUrl: null,
  evidenciaUrl: null,
  verificadoEm: new Date("2026-09-05T00:00:00Z"),
  acaoPendente: "Aceitar o DPA no portal",
  donoPapel: "Dono do SLA",
  bloqueiaVenda: false,
  pedidoEm: null,
  assinadoEm: null,
  exportadoAoCharterEm: null,
  notas: null,
};

function resetar() {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.requirePlatformStaff.mockResolvedValue(staff);
  mocks.findMany.mockResolvedValue([LINHA]);
  // Os contadores saem do `groupBy` (inventário inteiro), não da página.
  mocks.groupBy.mockResolvedValue([
    {
      estado: LINHA.estado,
      bloqueiaVenda: LINHA.bloqueiaVenda,
      _count: { _all: 1 },
    },
  ]);
  mocks.findUnique.mockResolvedValue(LINHA);
  mocks.update.mockImplementation(
    async (args: { data: Record<string, unknown> }) => ({
      ...LINHA,
      ...args.data,
    })
  );
  mocks.tenantFindUnique.mockResolvedValue({
    id: "t-nebuloz",
    slug: "nebuloz",
  });
  mocks.vendorFindUnique.mockResolvedValue({
    id: "cv-1",
    code: "V-08",
    tier: "REVIEW",
    dpa: false,
    region: null,
    retention: null,
    renewalAt: null,
    maxClass: "PUBLIC",
    clauses: [{ clause: { code: "CL-01" } }],
  });
  mocks.vendorUpdate.mockResolvedValue({ id: "cv-1" });
}

describe("listarFornecedoresDpa", () => {
  beforeEach(resetar);

  it("é leitura de todo staff, filtra o tenant system e devolve contadores e ações", async () => {
    const res = await listarFornecedoresDpa();
    expect(res.ok && res.data.linhas[0].acoes).toEqual(["MARCAR_ACEITO"]);
    expect(res.ok && res.data.contadores.aAssinar).toBe(1);
    expect(mocks.findMany.mock.calls[0][0].where).toMatchObject({
      tenantId: "system",
    });
    expect(mocks.assertCanWrite).not.toHaveBeenCalled();
  });
});

describe("aplicarAcaoDpa", () => {
  beforeEach(resetar);

  it("MEMBER não age", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });
    const res = await aplicarAcaoDpa({
      codigo: "V-08",
      acao: "MARCAR_ACEITO",
      evidenciaUrl: "https://x",
    });
    expect(res.ok).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("marcar aceito sem evidência é recusado antes do banco", async () => {
    const res = await aplicarAcaoDpa({ codigo: "V-08", acao: "MARCAR_ACEITO" });
    expect(res.ok).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("marcar aceito grava ASSINADO, evidência e assinadoEm, e audita o diff", async () => {
    const res = await aplicarAcaoDpa({
      codigo: "V-08",
      acao: "MARCAR_ACEITO",
      evidenciaUrl: "https://x/ok.pdf",
    });
    expect(res.ok).toBe(true);
    const data = mocks.update.mock.calls[0][0].data;
    expect(data.estado).toBe("ASSINADO");
    expect(data.evidenciaUrl).toBe("https://x/ok.pdf");
    expect(data.assinadoEm).toBeInstanceOf(Date);
    expect(mocks.update.mock.calls[0][0].where).toEqual({
      tenantId_codigo: { tenantId: "system", codigo: "V-08" },
    });
    expect(mocks.logPlatformAudit.mock.calls[0][1]).toMatchObject({
      tenantId: "system",
      entityType: "FornecedorDpa",
      diff: [["estado", "A_ASSINAR", "ASSINADO"]],
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/empresa/fornecedores");
  });

  it("fornecedor inexistente", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const res = await aplicarAcaoDpa({
      codigo: "V-99",
      acao: "REGISTRAR_PEDIDO",
    });
    expect(res.ok).toBe(false);
  });
});

describe("atualizarFornecedorDpa", () => {
  beforeEach(resetar);

  it("só grava os campos enviados", async () => {
    await atualizarFornecedorDpa({
      codigo: "V-08",
      bloqueiaVenda: true,
      notas: "confirmado com o SLA",
    });
    expect(mocks.update.mock.calls[0][0].data).toEqual({
      bloqueiaVenda: true,
      notas: "confirmado com o SLA",
    });
  });

  it("verificadoEm inválido é recusado", async () => {
    const res = await atualizarFornecedorDpa({
      codigo: "V-08",
      verificadoEm: "ontem",
    });
    expect(res.ok).toBe(false);
  });
});

describe("exportarAoCharter", () => {
  beforeEach(resetar);

  it("escreve dpa, region, retention, renewalAt e maxClass recomputado — e nada mais", async () => {
    mocks.findUnique.mockResolvedValue({
      ...LINHA,
      estado: "ASSINADO",
      assinadoEm: new Date("2026-09-06T00:00:00Z"),
      retencao: "90 dias",
    });
    const res = await exportarAoCharter({ codigos: ["V-08"] });
    expect(res.ok && res.data.exportados).toEqual(["V-08"]);
    const data = mocks.vendorUpdate.mock.calls[0][0].data;
    expect(data).toEqual({
      dpa: true,
      region: "US ou EU",
      retention: "90 dias",
      renewalAt: new Date("2027-09-06T00:00:00Z"),
      maxClass: "INTERNAL", // dpa + CL-01, sem CL-02..04
    });
    expect(Object.keys(data)).not.toContain("notes");
    expect(Object.keys(data)).not.toContain("tier");
  });

  it("coluna nula no FornecedorDpa não apaga region/retention já confirmados no Charter", async () => {
    mocks.findUnique.mockResolvedValue({ ...LINHA, regiao: null });
    mocks.vendorFindUnique.mockResolvedValue({
      id: "cv-1",
      code: "V-08",
      tier: "REVIEW",
      dpa: false,
      region: "EU",
      retention: null,
      renewalAt: null,
      maxClass: "PUBLIC",
      clauses: [{ clause: { code: "CL-01" } }],
    });
    await exportarAoCharter({ codigos: ["V-08"] });
    const data = mocks.vendorUpdate.mock.calls[0][0].data;
    expect(data.region).toBe("EU");
  });

  it("A_ASSINAR exporta dpa=false e mantém o teto Público", async () => {
    await exportarAoCharter({ codigos: ["V-08"] });
    const data = mocks.vendorUpdate.mock.calls[0][0].data;
    expect(data.dpa).toBe(false);
    expect(data.maxClass).toBe("PUBLIC");
    expect(data.renewalAt).toBeNull();
  });

  it("carimba exportadoAoCharterEm no system e audita nos dois tenants", async () => {
    await exportarAoCharter({ codigos: ["V-08"] });
    expect(
      mocks.update.mock.calls[0][0].data.exportadoAoCharterEm
    ).toBeInstanceOf(Date);
    const tenants = mocks.logPlatformAudit.mock.calls
      .map((c) => c[1].tenantId)
      .sort();
    expect(tenants).toEqual(["system", "t-nebuloz"]);
  });

  it("código sem CharterVendor correspondente é devolvido, não erro", async () => {
    mocks.vendorFindUnique.mockResolvedValue(null);
    const res = await exportarAoCharter({ codigos: ["V-08"] });
    expect(res.ok && res.data.semCorrespondente).toEqual(["V-08"]);
    expect(mocks.vendorUpdate).not.toHaveBeenCalled();
  });

  it("sem tenant nebuloz, recusa", async () => {
    mocks.tenantFindUnique.mockResolvedValue(null);
    const res = await exportarAoCharter({ codigos: ["V-08"] });
    expect(res.ok).toBe(false);
  });
});
