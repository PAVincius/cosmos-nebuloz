import { beforeEach, describe, expect, it, vi } from "vitest";

// Retenção de evidência — decisão do CEO, 2026-09-28 (atrito.md:60, parecer
// de compliance condição 3): objeto no bucket some 90 dias após o
// fechamento do assessment (closedAt). O registro em MeridianEvidence fica
// — só storagePath vira o marcador. Idempotente (marcador + audit com id
// estável) e nunca mistura tenant num mesmo lote. Roda pelo Vercel Cron
// (ADR-0021, fase 1), sem Inngest.

const mocks = vi.hoisted(() => ({
  evidenceFindMany: vi.fn(),
  evidenceUpdateMany: vi.fn(),
  auditLogCreateMany: vi.fn(),
  deleteObjects: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@repo/observability/log", () => ({
  log: { info: mocks.logInfo, error: mocks.logError },
}));

vi.mock("@repo/storage", () => ({
  MERIDIAN_EVIDENCE_BUCKET: "meridian-evidence",
  deleteObjects: mocks.deleteObjects,
}));

vi.mock("@repo/database", () => ({
  database: {
    meridianEvidence: {
      findMany: mocks.evidenceFindMany,
      updateMany: mocks.evidenceUpdateMany,
    },
    auditLog: { createMany: mocks.auditLogCreateMany },
  },
}));

import { eliminateExpiredMeridianEvidence } from "@/lib/jobs/meridian-evidence-retention";

const handler = (_ctx?: unknown) => eliminateExpiredMeridianEvidence();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.evidenceFindMany.mockResolvedValue([]);
  mocks.evidenceUpdateMany.mockResolvedValue({ count: 0 });
  mocks.auditLogCreateMany.mockResolvedValue({ count: 0 });
  mocks.deleteObjects.mockResolvedValue(undefined);
});

describe("eliminateExpiredMeridianEvidence — consulta", () => {
  it("filtra por closedAt vencido e storagePath ainda não marcado", async () => {
    await handler();

    const args = mocks.evidenceFindMany.mock.calls[0]?.[0] as {
      where: {
        storagePath: { not: string };
        assessment: { closedAt: { lt: Date } };
      };
    };
    expect(args.where.storagePath.not).toBe("eliminado-por-retencao");
    expect(args.where.assessment.closedAt.lt).toBeInstanceOf(Date);
    // ~90 dias atrás, com folga de 1s pra não quebrar por timing do teste.
    const expected = Date.now() - 90 * 24 * 60 * 60 * 1000;
    expect(
      Math.abs(args.where.assessment.closedAt.lt.getTime() - expected)
    ).toBeLessThan(1000);
  });

  it("limita a 500 por execução, ordenado por id — backlog grande fica pro dia seguinte", async () => {
    await handler();

    const args = mocks.evidenceFindMany.mock.calls[0]?.[0] as {
      take: number;
      orderBy: { id: string };
    };
    expect(args.take).toBe(500);
    expect(args.orderBy).toEqual({ id: "asc" });
  });

  it("sem nada pendente, não chama deleteObjects nem grava nada", async () => {
    const result = await handler();
    expect(mocks.deleteObjects).not.toHaveBeenCalled();
    expect(mocks.evidenceUpdateMany).not.toHaveBeenCalled();
    expect(mocks.auditLogCreateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ eliminated: 0, assessments: 0, failed: 0 });
  });
});

describe("eliminateExpiredMeridianEvidence — elimina em lote por assessment", () => {
  it("agrupa por assessment: um deleteObjects por assessment, com todos os paths daquele assessment", async () => {
    mocks.evidenceFindMany.mockResolvedValue([
      {
        id: "ev-1",
        tenantId: "t1",
        assessmentId: "a1",
        storagePath: "t1/a1/uuid-1",
        fileName: "f1.txt",
      },
      {
        id: "ev-2",
        tenantId: "t1",
        assessmentId: "a1",
        storagePath: "t1/a1/uuid-2",
        fileName: "f2.txt",
      },
    ]);

    const result = await handler();

    expect(mocks.deleteObjects).toHaveBeenCalledTimes(1);
    expect(mocks.deleteObjects).toHaveBeenCalledWith("meridian-evidence", [
      "t1/a1/uuid-1",
      "t1/a1/uuid-2",
    ]);
    expect(result).toEqual({ eliminated: 2, assessments: 1, failed: 0 });
  });

  it("marca storagePath E fileName com o marcador, sem apagar o registro (mesma lógica do DSAR)", async () => {
    mocks.evidenceFindMany.mockResolvedValue([
      {
        id: "ev-1",
        tenantId: "t1",
        assessmentId: "a1",
        storagePath: "t1/a1/uuid-1",
        fileName: "f1.txt",
      },
    ]);

    await handler();

    // fileName pode conter dado pessoal (achado da Morgana sobre o P2 do
    // LGPD que o DSAR já trata em fileName) — sem anonimizar aqui, o dado
    // sobreviveria aos 90 dias de retenção que essa própria rotina promete.
    expect(mocks.evidenceUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["ev-1"] } },
      data: {
        storagePath: "eliminado-por-retencao",
        fileName: "eliminado-por-retencao",
      },
    });
  });

  it("grava auditLog com actorType system, SEM fileName no metadata (dado pessoal não duplica em log de vida longa)", async () => {
    mocks.evidenceFindMany.mockResolvedValue([
      {
        id: "ev-1",
        tenantId: "t1",
        assessmentId: "a1",
        storagePath: "t1/a1/uuid-1",
        fileName: "f1.txt",
      },
    ]);

    await handler();

    expect(mocks.auditLogCreateMany).toHaveBeenCalledWith({
      data: [
        {
          id: "meridian-evidence-retention:ev-1",
          tenantId: "t1",
          actorType: "system",
          action: "meridian.evidence.retention-eliminated",
          entityType: "meridian.evidence",
          entityId: "ev-1",
          metadata: { assessmentId: "a1" },
        },
      ],
      skipDuplicates: true,
    });
    const [{ data }] = mocks.auditLogCreateMany.mock.calls[0] as [
      { data: Array<{ metadata: Record<string, unknown> }> },
    ];
    expect(data[0].metadata).not.toHaveProperty("fileName");
  });

  it("id do audit é determinístico por evidência — retry do step não duplica linha (skipDuplicates + id estável)", async () => {
    const rows = [
      {
        id: "ev-1",
        tenantId: "t1",
        assessmentId: "a1",
        storagePath: "t1/a1/uuid-1",
        fileName: "f1.txt",
      },
    ];
    mocks.evidenceFindMany.mockResolvedValue(rows);

    await handler();
    const firstCall = mocks.auditLogCreateMany.mock.calls[0]?.[0] as {
      data: Array<{ id: string }>;
      skipDuplicates: boolean;
    };

    mocks.auditLogCreateMany.mockClear();
    await handler();
    const secondCall = mocks.auditLogCreateMany.mock.calls[0]?.[0] as {
      data: Array<{ id: string }>;
      skipDuplicates: boolean;
    };

    expect(firstCall.data[0].id).toBe(secondCall.data[0].id);
    expect(firstCall.skipDuplicates).toBe(true);
  });

  it("dois assessments de tenants diferentes viram dois lotes, sem misturar paths entre tenants", async () => {
    mocks.evidenceFindMany.mockResolvedValue([
      {
        id: "ev-1",
        tenantId: "t1",
        assessmentId: "a1",
        storagePath: "t1/a1/uuid-1",
        fileName: "f1.txt",
      },
      {
        id: "ev-2",
        tenantId: "t2",
        assessmentId: "a2",
        storagePath: "t2/a2/uuid-2",
        fileName: "f2.txt",
      },
    ]);

    await handler();

    expect(mocks.deleteObjects).toHaveBeenCalledTimes(2);
    const calledPaths = mocks.deleteObjects.mock.calls.map(
      (c) => c[1] as string[]
    );
    expect(calledPaths).toContainEqual(["t1/a1/uuid-1"]);
    expect(calledPaths).toContainEqual(["t2/a2/uuid-2"]);
  });

  it("falha num assessment não trava os outros: segue, conta a falha e não marca o que falhou", async () => {
    mocks.evidenceFindMany.mockResolvedValue([
      {
        id: "ev-1",
        tenantId: "t1",
        assessmentId: "a1",
        storagePath: "t1/a1/uuid-1",
        fileName: "f1.txt",
      },
      {
        id: "ev-2",
        tenantId: "t2",
        assessmentId: "a2",
        storagePath: "t2/a2/uuid-2",
        fileName: "f2.txt",
      },
    ]);
    mocks.deleteObjects.mockRejectedValueOnce(new Error("storage fora"));

    const result = await handler();

    // a1 falhou no delete: nada gravado pra ele (fica pendente pro próximo
    // dia); a2 seguiu.
    expect(mocks.evidenceUpdateMany).toHaveBeenCalledTimes(1);
    expect(mocks.evidenceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["ev-2"] } } })
    );
    expect(result).toEqual({ eliminated: 1, assessments: 2, failed: 1 });
    expect(mocks.logError).toHaveBeenCalled();
  });

  it("segunda execução sobre o mesmo backlog é no-op (idempotência entre dias)", async () => {
    mocks.evidenceFindMany.mockResolvedValueOnce([
      {
        id: "ev-1",
        tenantId: "t1",
        assessmentId: "a1",
        storagePath: "t1/a1/uuid-1",
        fileName: "f1.txt",
      },
    ]);

    await handler();
    mocks.deleteObjects.mockClear();
    // O filtro por storagePath != marcador devolve vazio na volta seguinte.
    mocks.evidenceFindMany.mockResolvedValueOnce([]);
    const second = await handler();

    expect(mocks.deleteObjects).not.toHaveBeenCalled();
    expect(second).toEqual({ eliminated: 0, assessments: 0, failed: 0 });
  });
});
