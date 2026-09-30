// @vitest-environment node
//
// ADR-0021 fase 1: a eliminação LGPD não depende mais de evento Inngest. O
// próprio DataSubjectRequest PENDING é o outbox; o cron `/api/cron/lgpd-erasure`
// reivindica os pedidos com `updateMany` condicional (lock), conta tentativas
// em `metadata` e marca FAILED depois de 3.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dsrFindMany: vi.fn(),
  dsrUpdateMany: vi.fn(),
  dsrUpdate: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  auditCreate: vi.fn(),
  logError: vi.fn(),
  ok: vi.fn(),
}));

vi.mock("@repo/observability/log", () => ({
  log: { error: mocks.logError, info: vi.fn() },
}));

vi.mock("@repo/storage", () => ({
  MERIDIAN_EVIDENCE_BUCKET: "meridian-evidence",
  deleteObjects: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    dataSubjectRequest: {
      findMany: mocks.dsrFindMany,
      updateMany: mocks.dsrUpdateMany,
      update: mocks.dsrUpdate,
    },
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
    standupEntry: { updateMany: mocks.ok },
    copilotMessage: { updateMany: mocks.ok },
    accessLog: { updateMany: mocks.ok },
    meetingParticipant: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: mocks.ok,
    },
    meridianRespondent: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: mocks.ok,
    },
    meridianEvidence: {
      updateMany: mocks.ok,
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: { create: mocks.auditCreate },
    $transaction: vi.fn(),
  },
  Prisma: { DbNull: "__DB_NULL__" },
}));

import { processPendingErasureRequests } from "@/lib/jobs/lgpd-erasure";

const NOW = new Date("2026-09-29T20:00:00.000Z");

const pendingRow = (over: Record<string, unknown> = {}) => ({
  id: "dsr-1",
  tenantId: "t1",
  subjectId: "user-1",
  status: "PENDING",
  metadata: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ok.mockResolvedValue({ count: 0 });
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  mocks.dsrFindMany.mockResolvedValue([pendingRow()]);
  mocks.dsrUpdateMany.mockResolvedValue({ count: 1 });
  mocks.dsrUpdate.mockResolvedValue({});
  mocks.userFindUnique.mockResolvedValue({ email: "a@b.com" });
  mocks.userUpdate.mockResolvedValue({});
  mocks.auditCreate.mockResolvedValue({});
});

describe("processPendingErasureRequests — fila e lock", () => {
  it("busca só ERASURE PENDING/IN_PROGRESS, mais antigo primeiro", async () => {
    await processPendingErasureRequests();
    expect(mocks.dsrFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          type: "ERASURE",
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
        orderBy: { requestedAt: "asc" },
      })
    );
  });

  it("reivindica com updateMany condicional (status PENDING) antes de processar", async () => {
    await processPendingErasureRequests();
    expect(mocks.dsrUpdateMany).toHaveBeenCalledWith({
      where: { id: "dsr-1", status: "PENDING" },
      data: {
        status: "IN_PROGRESS",
        metadata: { attempts: 1, lockedAt: NOW.toISOString() },
      },
    });
  });

  it("processa com tenantId/subjectId da linha do banco e completa o pedido", async () => {
    const res = await processPendingErasureRequests();
    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" } })
    );
    expect(mocks.dsrUpdate).toHaveBeenCalledWith({
      where: { id: "dsr-1" },
      data: { status: "COMPLETED", processedAt: NOW },
    });
    expect(res).toEqual({ claimed: 1, completed: 1, retried: 0, failed: 0 });
  });

  it("lock perdido (count 0, outra execução pegou): não processa nem completa", async () => {
    mocks.dsrUpdateMany.mockResolvedValue({ count: 0 });
    const res = await processPendingErasureRequests();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.dsrUpdate).not.toHaveBeenCalled();
    expect(res.claimed).toBe(0);
  });

  it("duas execuções concorrentes sobre o mesmo pedido: só uma executa a eliminação", async () => {
    mocks.dsrUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    await Promise.all([
      processPendingErasureRequests(),
      processPendingErasureRequests(),
    ]);
    expect(mocks.userUpdate).toHaveBeenCalledTimes(1);
  });

  it("IN_PROGRESS recente (lease vigente) é ignorado", async () => {
    mocks.dsrFindMany.mockResolvedValue([
      pendingRow({
        status: "IN_PROGRESS",
        metadata: {
          attempts: 1,
          lockedAt: new Date(NOW.getTime() - 60_000).toISOString(),
        },
      }),
    ]);
    const res = await processPendingErasureRequests();
    expect(mocks.dsrUpdateMany).not.toHaveBeenCalled();
    expect(res.claimed).toBe(0);
  });

  it("IN_PROGRESS com lease vencido (execução anterior morreu) é retomado, contando tentativa", async () => {
    const lockedAt = new Date(NOW.getTime() - 30 * 60_000).toISOString();
    mocks.dsrFindMany.mockResolvedValue([
      pendingRow({
        status: "IN_PROGRESS",
        metadata: { attempts: 1, lockedAt },
      }),
    ]);
    await processPendingErasureRequests();
    expect(mocks.dsrUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "dsr-1",
        status: "IN_PROGRESS",
        metadata: { path: ["lockedAt"], equals: lockedAt },
      },
      data: {
        status: "IN_PROGRESS",
        metadata: { attempts: 2, lockedAt: NOW.toISOString() },
      },
    });
    expect(mocks.userUpdate).toHaveBeenCalled();
  });

  it("limita o lote por execução", async () => {
    mocks.dsrFindMany.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => pendingRow({ id: `dsr-${i}` }))
    );
    const res = await processPendingErasureRequests();
    expect(res.claimed).toBe(5);
  });
});

describe("processPendingErasureRequests — falha e tentativas", () => {
  it("falha na 1ª tentativa: volta a PENDING com attempts e lastError, sem completar", async () => {
    mocks.userFindUnique.mockRejectedValue(new Error("db indisponível"));
    const res = await processPendingErasureRequests();
    expect(mocks.dsrUpdate).toHaveBeenCalledWith({
      where: { id: "dsr-1" },
      data: {
        status: "PENDING",
        metadata: {
          attempts: 1,
          lastError: "fetch-subject-email: db indisponível",
          lastErrorAt: NOW.toISOString(),
        },
      },
    });
    expect(res).toEqual({ claimed: 1, completed: 0, retried: 1, failed: 0 });
  });

  it("na 3ª tentativa falha de vez: FAILED, log.error e trilha de auditoria", async () => {
    mocks.dsrFindMany.mockResolvedValue([
      pendingRow({ metadata: { attempts: 2, lockedAt: null } }),
    ]);
    mocks.userFindUnique.mockRejectedValue(new Error("db indisponível"));
    const res = await processPendingErasureRequests();
    expect(mocks.dsrUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          processedAt: NOW,
        }),
      })
    );
    expect(mocks.logError).toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "t1",
        action: "compliance.lgpd_erasure.failed",
        actorType: "system",
      }),
    });
    expect(res.failed).toBe(1);
  });

  it("um pedido que falha não impede o seguinte", async () => {
    mocks.dsrFindMany.mockResolvedValue([
      pendingRow({ id: "dsr-a", subjectId: "u-a" }),
      pendingRow({ id: "dsr-b", subjectId: "u-b" }),
    ]);
    mocks.userFindUnique
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ email: "b@b.com" });
    const res = await processPendingErasureRequests();
    expect(res).toEqual({ claimed: 2, completed: 1, retried: 1, failed: 0 });
  });

  it("a mensagem gravada em lastError não carrega o e-mail do titular", async () => {
    mocks.userFindUnique.mockRejectedValue(
      new Error("falha com a@b.com no meio")
    );
    await processPendingErasureRequests();
    const data = mocks.dsrUpdate.mock.calls[0]?.[0].data;
    expect(JSON.stringify(data)).not.toContain("a@b.com");
  });
});

describe("processPendingErasureRequests — teto e robustez do lote", () => {
  it("lease vencido com tentativas esgotadas (timeout na última): grava FAILED + audit e NÃO executa a eliminação", async () => {
    const lockedAt = new Date(NOW.getTime() - 30 * 60_000).toISOString();
    mocks.dsrFindMany.mockResolvedValue([
      pendingRow({
        status: "IN_PROGRESS",
        metadata: { attempts: 3, lockedAt },
      }),
    ]);
    const res = await processPendingErasureRequests();

    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.dsrUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dsr-1" },
        data: expect.objectContaining({ status: "FAILED", processedAt: NOW }),
      })
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "compliance.lgpd_erasure.failed",
      }),
    });
    expect(res).toEqual({ claimed: 1, completed: 0, retried: 0, failed: 1 });
  });

  it("recordFailure lançando não derruba o lote: o pedido seguinte ainda é processado", async () => {
    mocks.dsrFindMany.mockResolvedValue([
      pendingRow({ id: "dsr-a", subjectId: "u-a" }),
      pendingRow({ id: "dsr-b", subjectId: "u-b" }),
    ]);
    mocks.userFindUnique
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ email: "b@b.com" });
    mocks.dsrUpdate
      .mockRejectedValueOnce(new Error("db caiu ao gravar a falha"))
      .mockResolvedValue({});

    const res = await processPendingErasureRequests();

    expect(res.completed).toBe(1);
    expect(res.failed).toBe(1);
    expect(mocks.logError).toHaveBeenCalled();
  });
});

describe("processPendingErasureRequests — auditoria de conclusão", () => {
  it("aguarda a gravação do audit `completed` antes de devolver (a Vercel corta promise solta)", async () => {
    let libera: (v: unknown) => void = () => {};
    mocks.auditCreate.mockReturnValue(
      new Promise((resolve) => {
        libera = resolve;
      })
    );
    let terminou = false;
    const pending = processPendingErasureRequests().then(() => {
      terminou = true;
    });

    await vi.advanceTimersByTimeAsync(10);
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "compliance.lgpd_erasure.completed",
        tenantId: "t1",
      }),
    });
    // Audit ainda pendente: o job não pode ter devolvido.
    expect(terminou).toBe(false);

    libera({});
    await pending;
    expect(terminou).toBe(true);
  });

  it("audit `completed` falhando: pedido segue COMPLETED (dado já eliminado) e o erro vai para log.error", async () => {
    mocks.auditCreate.mockRejectedValue(new Error("audit fora"));
    const res = await processPendingErasureRequests();
    expect(res).toEqual({ claimed: 1, completed: 1, retried: 0, failed: 0 });
    expect(mocks.dsrUpdate).toHaveBeenCalledWith({
      where: { id: "dsr-1" },
      data: { status: "COMPLETED", processedAt: NOW },
    });
    expect(mocks.logError).toHaveBeenCalledWith(
      expect.stringContaining("audit"),
      expect.anything()
    );
  });
});
