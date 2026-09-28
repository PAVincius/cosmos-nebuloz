// @vitest-environment node
//
// docs/compliance/lgpd-ropa-e-lacunas.md §5: processErasureRequest precisa
// alcançar AccessLog e MeridianRespondent, as duas tabelas que sobraram depois
// de MeetingParticipant/MeetingTranscript (lgpd-erasure-meeting.test.ts). Mesmo
// padrão daquele arquivo: captura o handler real do inngest (mock de
// `inngest.createFunction`), invoca com `step`/`event` fake.

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createFunction: vi.fn(),
  dsrUpdate: vi.fn().mockResolvedValue({}),
  userUpdate: vi.fn().mockResolvedValue({}),
  userFindUnique: vi.fn(),
  standupUpdateMany: vi.fn().mockResolvedValue({ count: 0 }),
  copilotUpdateMany: vi.fn().mockResolvedValue({ count: 0 }),
  accessLogUpdateMany: vi.fn().mockResolvedValue({ count: 0 }),
  meetingParticipantFindMany: vi.fn().mockResolvedValue([]),
  meetingParticipantUpdateMany: vi.fn().mockResolvedValue({ count: 0 }),
  meridianRespondentFindMany: vi.fn().mockResolvedValue([]),
  meridianRespondentUpdateMany: vi.fn().mockResolvedValue({ count: 0 }),
  meridianEvidenceFindMany: vi.fn().mockResolvedValue([]),
  meridianEvidenceUpdateMany: vi.fn().mockResolvedValue({ count: 0 }),
  auditCreate: vi.fn().mockResolvedValue({}),
  transaction: vi.fn(),
  deleteObjects: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: { createFunction: mocks.createFunction },
}));

vi.mock("@repo/observability/log", () => ({
  log: { error: vi.fn() },
}));

vi.mock("@repo/storage", () => ({
  MERIDIAN_EVIDENCE_BUCKET: "meridian-evidence",
  deleteObjects: mocks.deleteObjects,
}));

vi.mock("@repo/database", () => ({
  database: {
    dataSubjectRequest: { update: mocks.dsrUpdate },
    user: { update: mocks.userUpdate, findUnique: mocks.userFindUnique },
    standupEntry: { updateMany: mocks.standupUpdateMany },
    copilotMessage: { updateMany: mocks.copilotUpdateMany },
    accessLog: { updateMany: mocks.accessLogUpdateMany },
    meetingParticipant: {
      findMany: mocks.meetingParticipantFindMany,
      updateMany: mocks.meetingParticipantUpdateMany,
    },
    meridianRespondent: {
      findMany: mocks.meridianRespondentFindMany,
      updateMany: mocks.meridianRespondentUpdateMany,
    },
    meridianEvidence: {
      findMany: mocks.meridianEvidenceFindMany,
      updateMany: mocks.meridianEvidenceUpdateMany,
    },
    auditLog: { create: mocks.auditCreate },
    $transaction: mocks.transaction,
  },
  Prisma: { DbNull: "__DB_NULL__" },
}));

import "@/lib/inngest/lgpd-dsr";

type StepCtx = {
  run: (name: string, fn: () => Promise<unknown>) => Promise<unknown>;
};
type HandlerFn = (ctx: { event: unknown; step: StepCtx }) => Promise<unknown>;

let handler: HandlerFn;

beforeAll(() => {
  const [[, fn]] = mocks.createFunction.mock.calls as [[unknown, HandlerFn]];
  handler = fn;
});

function makeStep(): StepCtx {
  return {
    run: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
  };
}

const baseEvent = {
  data: { subjectId: "user-1", tenantId: "t1", requestId: "dsr-1" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.dsrUpdate.mockResolvedValue({});
  mocks.userUpdate.mockResolvedValue({});
  mocks.standupUpdateMany.mockResolvedValue({ count: 0 });
  mocks.copilotUpdateMany.mockResolvedValue({ count: 0 });
  mocks.accessLogUpdateMany.mockResolvedValue({ count: 0 });
  mocks.meetingParticipantFindMany.mockResolvedValue([]);
  mocks.meetingParticipantUpdateMany.mockResolvedValue({ count: 0 });
  mocks.meridianRespondentFindMany.mockResolvedValue([]);
  mocks.meridianRespondentUpdateMany.mockResolvedValue({ count: 0 });
  mocks.meridianEvidenceFindMany.mockResolvedValue([]);
  mocks.meridianEvidenceUpdateMany.mockResolvedValue({ count: 0 });
  mocks.auditCreate.mockResolvedValue({});
  mocks.deleteObjects.mockResolvedValue(undefined);
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      meetingInsight: { deleteMany: vi.fn(), updateMany: vi.fn() },
      meetingTranscript: { updateMany: vi.fn() },
    })
  );
});

describe("processErasureRequest reaching AccessLog", () => {
  it("titular com e-mail → casa por userId OU email", async () => {
    mocks.userFindUnique.mockResolvedValue({ email: "alice@example.com" });

    await handler({ event: baseEvent, step: makeStep() });

    expect(mocks.accessLogUpdateMany).toHaveBeenCalledWith({
      where: {
        tenantId: "t1",
        OR: [{ userId: "user-1" }, { email: "alice@example.com" }],
      },
      data: {
        email: expect.stringMatching(/@erased\.cosmos$/),
        ip: null,
        userAgent: null,
      },
    });
  });

  it("titular sem e-mail → casa só por userId, sem cláusula OR", async () => {
    mocks.userFindUnique.mockResolvedValue(null);

    await handler({ event: baseEvent, step: makeStep() });

    expect(mocks.accessLogUpdateMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", userId: "user-1" },
      data: {
        email: expect.stringMatching(/@erased\.cosmos$/),
        ip: null,
        userAgent: null,
      },
    });
  });

  it("preserva evento, motivo e criadoEm — só anonimiza o identificador", async () => {
    mocks.userFindUnique.mockResolvedValue({ email: "alice@example.com" });

    await handler({ event: baseEvent, step: makeStep() });

    const [{ data }] = mocks.accessLogUpdateMany.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(data).not.toHaveProperty("evento");
    expect(data).not.toHaveProperty("motivo");
    expect(data).not.toHaveProperty("criadoEm");
    expect(Object.keys(data).sort()).toEqual(["email", "ip", "userAgent"]);
  });
});

describe("processErasureRequest reaching MeridianRespondent", () => {
  it("sem e-mail do titular → nem consulta MeridianRespondent", async () => {
    mocks.userFindUnique.mockResolvedValue(null);

    await handler({ event: baseEvent, step: makeStep() });

    expect(mocks.meridianRespondentFindMany).not.toHaveBeenCalled();
    expect(mocks.meridianRespondentUpdateMany).not.toHaveBeenCalled();
    expect(mocks.meridianEvidenceUpdateMany).not.toHaveBeenCalled();
  });

  it("e-mail sem respondente correspondente → não escreve nada", async () => {
    mocks.userFindUnique.mockResolvedValue({ email: "alice@example.com" });
    mocks.meridianRespondentFindMany.mockResolvedValue([]);

    await handler({ event: baseEvent, step: makeStep() });

    expect(mocks.meridianRespondentFindMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", email: "alice@example.com" },
      select: { id: true },
    });
    expect(mocks.meridianRespondentUpdateMany).not.toHaveBeenCalled();
    expect(mocks.meridianEvidenceUpdateMany).not.toHaveBeenCalled();
  });

  it("respondente encontrado → anonimiza nome/email e invalida o token, sem tocar MeridianResponse", async () => {
    mocks.userFindUnique.mockResolvedValue({ email: "alice@example.com" });
    mocks.meridianRespondentFindMany.mockResolvedValue([
      { id: "resp-1" },
      { id: "resp-2" },
    ]);

    await handler({ event: baseEvent, step: makeStep() });

    expect(mocks.meridianRespondentUpdateMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", id: { in: ["resp-1", "resp-2"] } },
      data: {
        name: expect.any(String),
        email: expect.stringMatching(/@erased\.cosmos$/),
        tokenExpiresAt: expect.any(Date),
      },
    });

    const [{ data }] = mocks.meridianRespondentUpdateMany.mock.calls[0] as [
      { data: { tokenExpiresAt: Date } },
    ];
    // Token invalidado: expira no passado, não um hash embaralhado (que
    // colidiria com @unique se mais de um respondente casar com o titular).
    expect(data.tokenExpiresAt.getTime()).toBeLessThan(Date.now());
    expect(data).not.toHaveProperty("tokenHash");

    // MeridianResponse nunca é referenciado pelo código — as respostas do
    // respondente (e o diagnóstico que elas alimentam via MeridianAxisScore)
    // ficam intactas.
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("respondente encontrado → anonimiza fileName do anexo (MeridianEvidence)", async () => {
    mocks.userFindUnique.mockResolvedValue({ email: "alice@example.com" });
    mocks.meridianRespondentFindMany.mockResolvedValue([{ id: "resp-1" }]);

    await handler({ event: baseEvent, step: makeStep() });

    expect(mocks.meridianEvidenceUpdateMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", uploadedByRespondentId: { in: ["resp-1"] } },
      // Mesmo marcador dos demais campos anonimizados: um substituto por
      // tabela obrigaria quem audita a conhecer cada variação.
      data: { fileName: expect.stringMatching(/^\{subject_anonymized_/) },
    });
  });

  it("respondente encontrado → apaga o objeto do bucket, não só o metadado (parecer cond. 2)", async () => {
    mocks.userFindUnique.mockResolvedValue({ email: "alice@example.com" });
    mocks.meridianRespondentFindMany.mockResolvedValue([{ id: "resp-1" }]);
    mocks.meridianEvidenceFindMany.mockResolvedValue([
      { storagePath: "t1/as-1/uuid-1" },
      { storagePath: "t1/as-1/uuid-2" },
    ]);

    await handler({ event: baseEvent, step: makeStep() });

    expect(mocks.meridianEvidenceFindMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", uploadedByRespondentId: { in: ["resp-1"] } },
      select: { storagePath: true },
    });
    expect(mocks.deleteObjects).toHaveBeenCalledWith("meridian-evidence", [
      "t1/as-1/uuid-1",
      "t1/as-1/uuid-2",
    ]);
  });

  it("respondente sem evidência anexada → não chama deleteObjects", async () => {
    mocks.userFindUnique.mockResolvedValue({ email: "alice@example.com" });
    mocks.meridianRespondentFindMany.mockResolvedValue([{ id: "resp-1" }]);
    mocks.meridianEvidenceFindMany.mockResolvedValue([]);

    await handler({ event: baseEvent, step: makeStep() });

    expect(mocks.deleteObjects).not.toHaveBeenCalled();
  });
});

describe("ordem de leitura do e-mail do titular (AccessLog e MeridianRespondent)", () => {
  // Mesmo risco do arquivo de meeting: um mock de retorno fixo passaria
  // mesmo que a leitura do e-mail acontecesse DEPOIS de
  // anonymize-user-profile sobrescrevê-lo. Aqui o mock simula o banco de
  // verdade — findUnique devolve o valor corrente, update o altera — para a
  // regressão de ordem falhar em vez de passar despercebida.
  it("lê o e-mail antes de anonimizar o perfil, senão AccessLog e MeridianRespondent não acham ninguém", async () => {
    let emailNoBanco: string | null = "alice@example.com";

    mocks.userFindUnique.mockImplementation(async () =>
      emailNoBanco === null ? null : { email: emailNoBanco }
    );
    mocks.userUpdate.mockImplementation(
      async (args: { data: { email: string } }) => {
        emailNoBanco = args.data.email;
        return {};
      }
    );
    mocks.meridianRespondentFindMany.mockResolvedValue([{ id: "resp-1" }]);

    await handler({ event: baseEvent, step: makeStep() });

    expect(mocks.accessLogUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ userId: "user-1" }, { email: "alice@example.com" }],
        }),
      })
    );
    expect(mocks.meridianRespondentFindMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", email: "alice@example.com" },
      select: { id: true },
    });
    expect(emailNoBanco).toMatch(/@erased\.cosmos$/);
  });
});
