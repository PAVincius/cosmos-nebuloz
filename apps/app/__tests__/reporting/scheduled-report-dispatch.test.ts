import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();
const updateMock = vi.fn();
const createExecutionMock = vi.fn();
const sendMock = vi.fn();
const logErrorMock = vi.fn();

vi.mock("@repo/database", () => ({
  database: {
    scheduledReport: {
      findMany: (...a: unknown[]) => findManyMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
    },
    scheduledReportExecution: {
      create: (...a: unknown[]) => createExecutionMock(...a),
    },
  },
}));

vi.mock("@repo/observability/log", () => ({
  log: {
    error: (...a: unknown[]) => logErrorMock(...a),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    createFunction: (_cfg: unknown, handler: unknown) => handler,
    send: (...a: unknown[]) => sendMock(...a),
  },
}));

import { dispatchScheduledReports } from "@/lib/inngest/scheduled-report-dispatch";

/** `step.run` do Inngest, reduzido ao que o handler usa. */
const step = {
  run: <T>(_id: string, fn: () => T | Promise<T>): Promise<T> =>
    Promise.resolve(fn()),
};

const AS_8H_DIARIO = "0 8 * * *";
const AGORA = new Date("2026-03-10T12:00:00Z");

function relatorio(over: Record<string, unknown> = {}) {
  return {
    id: "rpt_1",
    tenantId: "tn_1",
    cronExpression: AS_8H_DIARIO,
    timezone: "UTC",
    lastRunAt: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  createExecutionMock.mockResolvedValue({ id: "exec_1" });
  updateMock.mockResolvedValue({});
  sendMock.mockResolvedValue({});
});

describe("dispatchScheduledReports", () => {
  it("consulta apenas relatórios habilitados", async () => {
    findManyMock.mockResolvedValue([]);

    await dispatchScheduledReports({ step, now: AGORA });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { enabled: true } })
    );
  });

  it("cria execução e emite o evento para um relatório vencido", async () => {
    findManyMock.mockResolvedValue([relatorio()]);

    const out = await dispatchScheduledReports({ step, now: AGORA });

    expect(createExecutionMock).toHaveBeenCalledWith({
      data: { tenantId: "tn_1", reportId: "rpt_1", status: "PENDING" },
    });
    expect(sendMock).toHaveBeenCalledWith({
      name: "reporting/scheduled-report.run",
      data: { reportId: "rpt_1", executionId: "exec_1", triggeredBy: "cron" },
    });
    expect(out).toEqual({ examinados: 1, disparados: 1 });
  });

  it("grava lastRunAt ANTES de emitir o evento", async () => {
    findManyMock.mockResolvedValue([relatorio()]);
    const ordem: string[] = [];
    updateMock.mockImplementation(() => {
      ordem.push("update");
      return Promise.resolve({});
    });
    sendMock.mockImplementation(() => {
      ordem.push("send");
      return Promise.resolve({});
    });

    await dispatchScheduledReports({ step, now: AGORA });

    expect(ordem).toEqual(["update", "send"]);
  });

  it("não dispara relatório que já rodou depois do disparo mais recente", async () => {
    findManyMock.mockResolvedValue([
      relatorio({ lastRunAt: new Date("2026-03-10T08:30:00Z") }),
    ]);

    const out = await dispatchScheduledReports({ step, now: AGORA });

    expect(sendMock).not.toHaveBeenCalled();
    expect(out).toEqual({ examinados: 1, disparados: 0 });
  });

  it("pula expressão inválida sem derrubar os demais, e loga o motivo", async () => {
    findManyMock.mockResolvedValue([
      relatorio({
        id: "rpt_ruim",
        tenantId: "tn_ruim",
        cronExpression: "quebrado",
      }),
      relatorio({ id: "rpt_bom" }),
    ]);

    const out = await dispatchScheduledReports({ step, now: AGORA });

    expect(out).toEqual({ examinados: 2, disparados: 1 });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reportId: "rpt_bom" }),
      })
    );
    expect(logErrorMock).toHaveBeenCalledWith(
      expect.stringContaining("cron ou timezone inválidos"),
      expect.objectContaining({
        reportId: "rpt_ruim",
        tenantId: "tn_ruim",
        cronExpression: "quebrado",
        timezone: "UTC",
      })
    );
  });

  it("loga timezone inválido do mesmo jeito que cron inválido", async () => {
    findManyMock.mockResolvedValue([
      relatorio({ id: "rpt_tz_ruim", timezone: "Marte/Olympus" }),
    ]);

    const out = await dispatchScheduledReports({ step, now: AGORA });

    expect(out).toEqual({ examinados: 1, disparados: 0 });
    expect(sendMock).not.toHaveBeenCalled();
    expect(logErrorMock).toHaveBeenCalledWith(
      expect.stringContaining("cron ou timezone inválidos"),
      expect.objectContaining({ reportId: "rpt_tz_ruim" })
    );
  });

  it("falha de um relatório não impede o próximo", async () => {
    findManyMock.mockResolvedValue([
      relatorio({ id: "rpt_1" }),
      relatorio({ id: "rpt_2" }),
    ]);
    createExecutionMock
      .mockRejectedValueOnce(new Error("banco fora"))
      .mockResolvedValueOnce({ id: "exec_2" });

    const out = await dispatchScheduledReports({ step, now: AGORA });

    expect(out).toEqual({ examinados: 2, disparados: 1 });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("reidrata lastRunAt vindo como string do step.run", async () => {
    // O step.run real serializa em JSON: lastRunAt chega como string ISO.
    findManyMock.mockResolvedValue([
      relatorio({ lastRunAt: "2026-03-10T08:30:00.000Z" as unknown as Date }),
    ]);

    const out = await dispatchScheduledReports({ step, now: AGORA });

    // Já rodou às 08:30, depois do disparo das 08:00 — não deve disparar.
    expect(sendMock).not.toHaveBeenCalled();
    expect(out).toEqual({ examinados: 1, disparados: 0 });
  });
});
