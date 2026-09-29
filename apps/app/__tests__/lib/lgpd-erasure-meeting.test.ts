// @vitest-environment node
//
// Passo 8 de docs/compliance/consentimento-de-gravacao.md §7: a eliminação
// de LGPD (processErasureRequest) precisa alcançar MeetingParticipant e
// MeetingTranscript, não só User/StandupEntry/CopilotMessage. Captures the
// real inngest handler the same way fireflies-transcript-consent.test.ts
// does — mock `inngest.createFunction`, grab the registered handler, invoke
// it with a fake `step`/`event`.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dsrUpdate: vi.fn().mockResolvedValue({}),
  userUpdate: vi.fn().mockResolvedValue({}),
  userFindUnique: vi.fn(),
  standupUpdateMany: vi.fn().mockResolvedValue({ count: 0 }),
  copilotUpdateMany: vi.fn().mockResolvedValue({ count: 0 }),
  accessLogUpdateMany: vi.fn().mockResolvedValue({ count: 0 }),
  meetingParticipantFindMany: vi.fn().mockResolvedValue([]),
  meetingParticipantUpdateMany: vi.fn().mockResolvedValue({ count: 0 }),
  meetingInsightDeleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  meetingInsightUpdateMany: vi.fn().mockResolvedValue({ count: 0 }),
  meetingTranscriptUpdateMany: vi.fn().mockResolvedValue({ count: 0 }),
  meridianRespondentFindMany: vi.fn().mockResolvedValue([]),
  meridianRespondentUpdateMany: vi.fn().mockResolvedValue({ count: 0 }),
  meridianEvidenceUpdateMany: vi.fn().mockResolvedValue({ count: 0 }),
  auditCreate: vi.fn().mockResolvedValue({}),
  transaction: vi.fn(),
}));

vi.mock("@repo/observability/log", () => ({
  log: { error: vi.fn() },
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
    meridianEvidence: { updateMany: mocks.meridianEvidenceUpdateMany },
    auditLog: { create: mocks.auditCreate },
    $transaction: mocks.transaction,
  },
  Prisma: { DbNull: "__DB_NULL__" },
}));

import { runErasure } from "@/lib/jobs/lgpd-erasure";

// Corpo da eliminação, sem a fila (a fila está em lgpd-erasure-queue.test.ts).
const handler = ({
  event,
}: {
  event: { data: Parameters<typeof runErasure>[0] };
  step?: unknown;
}) => runErasure(event.data);

function makeStep() {
  return;
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
  mocks.meridianEvidenceUpdateMany.mockResolvedValue({ count: 0 });
  mocks.auditCreate.mockResolvedValue({});
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      meetingInsight: {
        deleteMany: mocks.meetingInsightDeleteMany,
        updateMany: mocks.meetingInsightUpdateMany,
      },
      meetingTranscript: { updateMany: mocks.meetingTranscriptUpdateMany },
    })
  );
});

describe("processErasureRequest reaching meeting data (passo 8)", () => {
  it("no email found for subject → meeting steps are skipped entirely", async () => {
    mocks.userFindUnique.mockResolvedValue(null);

    await handler({ event: baseEvent, step: makeStep() });

    expect(mocks.meetingParticipantFindMany).not.toHaveBeenCalled();
    expect(mocks.meetingParticipantUpdateMany).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("email found but no participant rows → anonymizes participant email, skips transcript erasure", async () => {
    mocks.userFindUnique.mockResolvedValue({ email: "alice@example.com" });
    mocks.meetingParticipantFindMany.mockResolvedValue([]);

    await handler({ event: baseEvent, step: makeStep() });

    expect(mocks.meetingParticipantUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1", email: "alice@example.com" },
        data: expect.objectContaining({
          email: expect.stringMatching(/@erased\.cosmos$/),
        }),
      })
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("participant rows found → redacts transcript rawSummary and insights", async () => {
    mocks.userFindUnique.mockResolvedValue({ email: "alice@example.com" });
    mocks.meetingParticipantFindMany.mockResolvedValue([
      { transcriptId: "tx-1" },
      { transcriptId: "tx-2" },
      { transcriptId: "tx-1" }, // duplicate transcript, participant appears once per row here regardless
    ]);

    await handler({ event: baseEvent, step: makeStep() });

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.meetingInsightDeleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: "t1",
        transcriptId: { in: ["tx-1", "tx-2"] },
        status: { in: ["PENDING", "DISMISSED"] },
      },
    });
    expect(mocks.meetingInsightUpdateMany).toHaveBeenCalledWith({
      where: {
        tenantId: "t1",
        transcriptId: { in: ["tx-1", "tx-2"] },
        status: "APPLIED",
      },
      data: {
        text: "[conteúdo removido — solicitação de eliminação LGPD]",
      },
    });
    expect(mocks.meetingTranscriptUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1", id: { in: ["tx-1", "tx-2"] } },
      })
    );
  });
});

describe("ordem de leitura do e-mail do titular", () => {
  // Os casos acima mockam `user.findUnique` com retorno fixo, e por isso
  // passariam mesmo que a leitura acontecesse DEPOIS de `anonymize-user-profile`
  // sobrescrever o e-mail — que foi exatamente o defeito encontrado na revisão.
  // Aqui o mock simula o banco: `findUnique` devolve o valor corrente e
  // `update` o altera. Se a ordem regredir, `subjectEmail` vira o e-mail
  // anonimizado, nenhum participante casa, e a eliminação de reunião volta a
  // ser um no-op silencioso — que é o pior modo de falha possível num fluxo
  // de LGPD, porque relata sucesso sem ter apagado nada.
  it("lê o e-mail antes de anonimizar o perfil, senão a eliminação de reunião não acha ninguém", async () => {
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
    mocks.meetingParticipantFindMany.mockResolvedValue([]);

    await handler({ event: baseEvent, step: makeStep() });

    expect(mocks.meetingParticipantUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1", email: "alice@example.com" },
      })
    );
    expect(emailNoBanco).toMatch(/@erased\.cosmos$/);
  });
});
