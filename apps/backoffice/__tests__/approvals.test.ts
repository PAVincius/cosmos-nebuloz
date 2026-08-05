// approvals.test.ts — SRD FR-8. A fila de aprovação é o que sustenta a decisão
// de produto de que operação sensível não executa no clique (PRD §6.3).
//
// O que se prova aqui: staff lê, só ADMIN decide, pedido já decidido não muda
// de decisão, e a trilha (quem, quando) fica gravada.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  revalidatePath: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
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
vi.mock("@repo/database", () => ({
  database: {
    platformApproval: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
      update: mocks.update,
      create: mocks.create,
    },
    auditLog: { create: mocks.auditCreate },
  },
}));

import {
  decidePlatformApprovalAction,
  listPlatformApprovals,
  requestPlatformApproval,
} from "../app/actions/approvals";

const admin = {
  userId: "u-admin",
  name: "Vinícius",
  email: "v@nebuloz.com",
  canWrite: true,
};
const member = { ...admin, userId: "u-member", canWrite: false };

const pendente = {
  id: "ap-1",
  status: "PENDING_APPROVAL",
  acao: "tenant.delete",
  alvoTipo: "tenant",
  alvoLabel: "vanta-saude",
  motivo: "Encerramento de contrato.",
  impacto: "42 usuários.",
  solicitanteNome: "Vinícius",
  criadoEm: new Date("2026-08-05T00:00:00.000Z"),
  decisorNome: null,
  decididoEm: null,
  nota: null,
};

/** clearAllMocks zera chamadas mas NÃO implementações: um mockImplementation
 *  que lança vaza para todo teste seguinte, inclusive de outro describe. */
function resetarMocks() {
  for (const m of Object.values(mocks)) {
    m.mockReset();
  }
}

describe("listPlatformApprovals", () => {
  beforeEach(() => {
    resetarMocks();
    mocks.requirePlatformStaff.mockResolvedValue(member);
    mocks.findMany.mockResolvedValue([pendente]);
  });

  it("MEMBER lê a fila — leitura é de todo staff", async () => {
    const res = await listPlatformApprovals();

    expect(res.ok).toBe(true);
    expect(mocks.assertCanWrite).not.toHaveBeenCalled();
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "system" } })
    );
  });

  it("filtra por status quando pedido", async () => {
    await listPlatformApprovals("PENDING_APPROVAL");

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "system", status: "PENDING_APPROVAL" },
      })
    );
  });
});

describe("decidePlatformApprovalAction", () => {
  beforeEach(() => {
    resetarMocks();
    mocks.requirePlatformStaff.mockResolvedValue(admin);
    mocks.findFirst.mockResolvedValue(pendente);
    mocks.update.mockResolvedValue({ ...pendente, status: "APPROVED" });
  });

  it("grava a trilha de decisão: quem, quando e o desfecho", async () => {
    const res = await decidePlatformApprovalAction({
      id: "ap-1",
      outcome: "APPROVED",
    });

    expect(res.ok).toBe(true);
    const data = mocks.update.mock.calls[0][0].data;
    expect(data.status).toBe("APPROVED");
    expect(data.decisorId).toBe(admin.userId);
    expect(data.decididoEm).toBeInstanceOf(Date);
  });

  it("recusa MEMBER — decidir é escrita", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Seu papel no back-office permite apenas leitura.");
    });

    const res = await decidePlatformApprovalAction({
      id: "ap-1",
      outcome: "APPROVED",
    });

    expect(res.ok).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("não redecide pedido já decidido (FR-8.5)", async () => {
    mocks.findFirst.mockResolvedValue({ ...pendente, status: "REJECTED" });

    const res = await decidePlatformApprovalAction({
      id: "ap-1",
      outcome: "APPROVED",
    });

    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error).toContain("já foi decidido");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("recusa pedido de outro escopo sem vazar existência", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const res = await decidePlatformApprovalAction({
      id: "ap-999",
      outcome: "APPROVED",
    });

    expect(res.ok).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("aceita nota na rejeição", async () => {
    mocks.update.mockResolvedValue({ ...pendente, status: "REJECTED" });

    await decidePlatformApprovalAction({
      id: "ap-1",
      outcome: "REJECTED",
      nota: "Cliente ainda em contrato até dezembro.",
    });

    expect(mocks.update.mock.calls[0][0].data.nota).toBe(
      "Cliente ainda em contrato até dezembro."
    );
  });
});

describe("requestPlatformApproval", () => {
  beforeEach(() => {
    resetarMocks();
    mocks.requirePlatformStaff.mockResolvedValue(admin);
    mocks.create.mockResolvedValue({ id: "ap-9" });
  });

  it("nasce PENDING_APPROVAL com solicitante registrado", async () => {
    const res = await requestPlatformApproval({
      acao: "tenant.delete",
      alvoTipo: "tenant",
      alvoId: "t-1",
      alvoLabel: "vanta-saude",
      motivo: "Encerramento de contrato solicitado pelo cliente.",
      impacto: "42 usuários, 8,3 GB de storage.",
    });

    expect(res.ok).toBe(true);
    const data = mocks.create.mock.calls[0][0].data;
    expect(data.status).toBe("PENDING_APPROVAL");
    expect(data.solicitanteId).toBe(admin.userId);
    expect(data.tenantId).toBe("system");
  });

  it("exige motivo e impacto — FR-8.2, aprovador não decide sem contexto", async () => {
    const res = await requestPlatformApproval({
      acao: "tenant.delete",
      alvoTipo: "tenant",
      alvoId: "t-1",
      alvoLabel: "vanta-saude",
      motivo: "curto",
      impacto: "",
    });

    expect(res.ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
