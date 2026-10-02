import { beforeEach, describe, expect, it, vi } from "vitest";

const sendEmailMock = vi.fn();
const updateExecutionMock = vi.fn();

// scheduled-report-runner.ts importa `database` de @repo/database no topo do
// módulo. O client real do Prisma só carrega em contexto de servidor (guarda
// do @t3-oss/env-core barra acesso a env server-side no ambiente jsdom dos
// testes) — mockar aqui segue o padrão já usado em
// scheduled-report-dispatch.test.ts para o mesmo import.
vi.mock("@repo/database", () => ({
  database: {
    scheduledReportExecution: {
      update: (...a: unknown[]) => updateExecutionMock(...a),
    },
  },
}));

vi.mock("@repo/email", () => ({
  resend: { emails: { send: (...a: unknown[]) => sendEmailMock(...a) } },
}));

vi.mock("@repo/email/keys", () => ({
  keys: () => ({ RESEND_FROM: "relatorios@nebuloz.ai" }),
}));

import {
  entregarRelatorio,
  marcarExecucaoFalha,
} from "@/lib/inngest/scheduled-report-runner";

beforeEach(() => {
  vi.clearAllMocks();
});

const RELATORIO = {
  name: "Resumo Executivo",
  type: "EXECUTIVE_SUMMARY",
  recipients: ["ana@cliente.com"],
};

describe("entregarRelatorio", () => {
  it("usa RESEND_FROM como remetente, não um literal", async () => {
    sendEmailMock.mockResolvedValue({ data: { id: "msg_1" }, error: null });

    await entregarRelatorio(RELATORIO, "<h1>ok</h1>");

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: "relatorios@nebuloz.ai" })
    );
  });

  it("lança quando o Resend devolve erro, em vez de marcar entregue", async () => {
    sendEmailMock.mockResolvedValue({
      data: null,
      error: { message: "domain not verified" },
    });

    await expect(entregarRelatorio(RELATORIO, "<h1>ok</h1>")).rejects.toThrow(
      /domain not verified/
    );
  });

  it("não envia quando não há destinatário", async () => {
    await entregarRelatorio({ ...RELATORIO, recipients: [] }, "<h1>ok</h1>");

    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("não envia para tipo que não é EXECUTIVE_SUMMARY", async () => {
    await entregarRelatorio({ ...RELATORIO, type: "VELOCITY" }, "csv");

    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("marcarExecucaoFalha", () => {
  it("marca a execução como FAILED com a mensagem do erro", async () => {
    updateExecutionMock.mockResolvedValue({});

    await marcarExecucaoFalha("exec_1", new Error("domain not verified"));

    expect(updateExecutionMock).toHaveBeenCalledWith({
      where: { id: "exec_1" },
      data: { status: "FAILED", error: "domain not verified" },
    });
  });

  it("converte erro que não é Error em string", async () => {
    updateExecutionMock.mockResolvedValue({});

    await marcarExecucaoFalha("exec_2", "banco fora");

    expect(updateExecutionMock).toHaveBeenCalledWith({
      where: { id: "exec_2" },
      data: { status: "FAILED", error: "banco fora" },
    });
  });

  it("trunca a mensagem de erro em 1000 caracteres", async () => {
    updateExecutionMock.mockResolvedValue({});
    const mensagemLonga = "x".repeat(2000);

    await marcarExecucaoFalha("exec_3", new Error(mensagemLonga));

    expect(updateExecutionMock).toHaveBeenCalledWith({
      where: { id: "exec_3" },
      data: { status: "FAILED", error: "x".repeat(1000) },
    });
  });
});
