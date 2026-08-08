import { beforeEach, describe, expect, it, vi } from "vitest";

const sendEmailMock = vi.fn();

// scheduled-report-runner.ts importa `database` de @repo/database no topo do
// módulo. O client real do Prisma só carrega em contexto de servidor (guarda
// do @t3-oss/env-core barra acesso a env server-side no ambiente jsdom dos
// testes) — mockar aqui segue o padrão já usado em
// scheduled-report-dispatch.test.ts para o mesmo import.
vi.mock("@repo/database", () => ({ database: {} }));

vi.mock("@repo/email", () => ({
  resend: { emails: { send: (...a: unknown[]) => sendEmailMock(...a) } },
}));

vi.mock("@repo/email/keys", () => ({
  keys: () => ({ RESEND_FROM: "relatorios@nebuloz.com" }),
}));

import { entregarRelatorio } from "@/lib/inngest/scheduled-report-runner";

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
      expect.objectContaining({ from: "relatorios@nebuloz.com" })
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
