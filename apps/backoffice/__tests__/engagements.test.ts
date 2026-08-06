// engagements.test.ts — contratos de escopo fechado.
//
// Dois invariantes carregam esta action:
//
// 1. O ciclo de vida é dirigido, não livre. CONCLUIDO não volta para PROPOSTO:
//    um engajamento que retrocede de estado apaga a leitura de "já entregamos
//    isso" que a operação inteira usa para se orientar.
// 2. O cliente precisa existir e não pode ser o tenant interno. `system` não é
//    cliente; engajamento apontado para ele contamina toda a agregação do
//    Benchmark com um contrato que a Nebuloz teria feito consigo mesma.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  logPlatformAudit: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  tenantFindFirst: vi.fn(),
  tenantFindMany: vi.fn(),
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
    engagement: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
      create: mocks.create,
      update: mocks.update,
    },
    tenant: {
      findFirst: mocks.tenantFindFirst,
      findMany: mocks.tenantFindMany,
    },
  },
}));

import {
  createEngagementAction,
  listEngagements,
  setEngagementStatusAction,
} from "../app/actions/engagements";

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
  mocks.tenantFindMany.mockResolvedValue([]);
  mocks.tenantFindFirst.mockResolvedValue({
    id: "t-1",
    slug: "vanta",
    name: "Vanta",
  });
}

const BASE = {
  nome: "Piloto SLM",
  codigo: "ENG-01",
  clienteTenantId: "t-1",
  valorCentavos: 500_000,
};

describe("listEngagements", () => {
  beforeEach(resetar);

  it("é leitura de todo staff", async () => {
    const res = await listEngagements();

    expect(res.ok).toBe(true);
    expect(mocks.assertCanWrite).not.toHaveBeenCalled();
  });
});

describe("createEngagementAction", () => {
  beforeEach(resetar);

  it("MEMBER não cria", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });

    const res = await createEngagementAction(BASE);

    expect(res.ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("recusa cliente inexistente", async () => {
    mocks.tenantFindFirst.mockResolvedValue(null);

    const res = await createEngagementAction(BASE);

    expect(res.ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("recusa o tenant interno como cliente", async () => {
    const res = await createEngagementAction({
      ...BASE,
      clienteTenantId: "system",
    });

    // `system` não é cliente. Deixar passar contaminaria o Benchmark com um
    // contrato que a Nebuloz teria feito consigo mesma.
    expect(res.ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("recusa código repetido", async () => {
    mocks.findFirst.mockResolvedValue({ id: "ja-existe" });

    const res = await createEngagementAction(BASE);

    expect(res.ok).toBe(false);
  });

  it("recusa valor fracionado", async () => {
    const res = await createEngagementAction({
      ...BASE,
      valorCentavos: 500.5,
    });

    expect(res.ok).toBe(false);
  });

  it("nasce em PROPOSTO", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "e-1", codigo: "ENG-01" });

    await createEngagementAction(BASE);

    expect(mocks.create.mock.calls[0][0].data.status).toBe("PROPOSTO");
  });

  it("recusa fim antes do início", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const res = await createEngagementAction({
      ...BASE,
      inicioEm: "2026-09-01",
      fimEm: "2026-08-01",
    });

    expect(res.ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("setEngagementStatusAction — o ciclo de vida", () => {
  beforeEach(resetar);

  function engajamentoEm(status: string) {
    mocks.findFirst.mockResolvedValue({
      id: "e-1",
      codigo: "ENG-01",
      nome: "Piloto",
      status,
    });
    mocks.update.mockResolvedValue({ id: "e-1" });
  }

  it("PROPOSTO vira ATIVO", async () => {
    engajamentoEm("PROPOSTO");

    const res = await setEngagementStatusAction({
      id: "e-1",
      status: "ATIVO",
    });

    expect(res.ok).toBe(true);
    expect(mocks.update.mock.calls[0][0].data.status).toBe("ATIVO");
  });

  it("ATIVO vira PAUSADO e volta", async () => {
    engajamentoEm("PAUSADO");

    const res = await setEngagementStatusAction({
      id: "e-1",
      status: "ATIVO",
    });

    expect(res.ok).toBe(true);
  });

  it("CONCLUIDO não retrocede", async () => {
    engajamentoEm("CONCLUIDO");

    const res = await setEngagementStatusAction({
      id: "e-1",
      status: "PROPOSTO",
    });

    // Retroceder apaga a leitura de "já entregamos isso", que é como a
    // operação inteira se orienta.
    expect(res.ok).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("CANCELADO é terminal", async () => {
    engajamentoEm("CANCELADO");

    const res = await setEngagementStatusAction({
      id: "e-1",
      status: "ATIVO",
    });

    expect(res.ok).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("guarda antes e depois no diff", async () => {
    engajamentoEm("PROPOSTO");

    await setEngagementStatusAction({ id: "e-1", status: "ATIVO" });

    expect(mocks.logPlatformAudit.mock.calls[0][1].diff).toEqual([
      ["status", "PROPOSTO", "ATIVO"],
    ]);
  });

  it("recusa engajamento de outro tenant", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const res = await setEngagementStatusAction({
      id: "de-outro",
      status: "ATIVO",
    });

    expect(res.ok).toBe(false);
  });
});
