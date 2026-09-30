// @vitest-environment node
//
// Achado do Vigia (1cbac7dc): o Inngest memoizava os ids entre tentativas; no
// cron, a tentativa 2 refaz o `find` por e-mail. Se o passo anterior já trocou
// o e-mail da linha-chave (participante/respondente), o `find` volta vazio e o
// conteúdo (transcrição, fileName, objeto no bucket) sobrevive com o pedido
// fechado como COMPLETED. Por isso o conteúdo é eliminado ANTES de anonimizar
// a linha-chave. Aqui o banco é um fake com estado, e a 1ª tentativa falha no
// meio.

import { beforeEach, describe, expect, it, vi } from "vitest";

const EMAIL = "alice@example.com";

const state = vi.hoisted(() => ({
  participantEmail: "" as string,
  respondentEmail: "" as string,
  transcriptRaw: "" as string | null,
  evidenceFileName: "" as string,
  bucketObjects: new Set<string>(),
  failTranscript: false,
  failBucket: false,
  failFileName: false,
  calls: [] as string[],
}));

const mocks = vi.hoisted(() => ({
  logError: vi.fn(),
}));

vi.mock("@repo/observability/log", () => ({
  log: { error: mocks.logError, info: vi.fn() },
}));

vi.mock("@repo/storage", () => ({
  MERIDIAN_EVIDENCE_BUCKET: "meridian-evidence",
  deleteObjects: vi.fn(async (_b: string, paths: string[]) => {
    state.calls.push("delete-objects");
    if (state.failBucket) {
      throw new Error("bucket fora");
    }
    for (const p of paths) {
      state.bucketObjects.delete(p);
    }
  }),
}));

vi.mock("@repo/database", () => {
  const none = vi.fn().mockResolvedValue({ count: 0 });
  return {
    database: {
      user: {
        findUnique: vi.fn().mockResolvedValue({ email: "alice@example.com" }),
        update: vi.fn().mockResolvedValue({}),
      },
      standupEntry: { updateMany: none },
      copilotMessage: { updateMany: none },
      accessLog: { updateMany: none },
      dataSubjectRequest: { update: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      meetingParticipant: {
        findMany: vi.fn(async (args: { where: { email: string } }) =>
          state.participantEmail === args.where.email
            ? [{ transcriptId: "tr-1" }]
            : []
        ),
        updateMany: vi.fn(async (args: { data: { email: string } }) => {
          state.calls.push("anonymize-participant");
          state.participantEmail = args.data.email;
          return { count: 1 };
        }),
      },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
        state.calls.push("erase-transcript");
        if (state.failTranscript) {
          throw new Error("transação abortada");
        }
        await fn({
          meetingInsight: { deleteMany: none, updateMany: none },
          meetingTranscript: {
            updateMany: vi.fn(async () => {
              state.transcriptRaw = null;
              return { count: 1 };
            }),
          },
        });
      }),
      meridianRespondent: {
        findMany: vi.fn(async (args: { where: { email: string } }) =>
          state.respondentEmail === args.where.email ? [{ id: "resp-1" }] : []
        ),
        updateMany: vi.fn(async (args: { data: { email: string } }) => {
          state.calls.push("anonymize-respondent");
          state.respondentEmail = args.data.email;
          return { count: 1 };
        }),
      },
      meridianEvidence: {
        findMany: vi.fn(async () => [{ storagePath: "t1/a1/uuid-1" }]),
        updateMany: vi.fn(async (args: { data: { fileName: string } }) => {
          state.calls.push("anonymize-filename");
          if (state.failFileName) {
            throw new Error("db caiu");
          }
          state.evidenceFileName = args.data.fileName;
          return { count: 1 };
        }),
      },
    },
    Prisma: { DbNull: "__DB_NULL__" },
  };
});

import { runErasure } from "@/lib/jobs/lgpd-erasure";

const data = { subjectId: "user-1", tenantId: "t1", requestId: "dsr-1" };

beforeEach(() => {
  state.participantEmail = EMAIL;
  state.respondentEmail = EMAIL;
  state.transcriptRaw = "conteúdo da fala";
  state.evidenceFileName = "alice-rg.pdf";
  state.bucketObjects = new Set(["t1/a1/uuid-1"]);
  state.failTranscript = false;
  state.failBucket = false;
  state.failFileName = false;
  state.calls = [];
});

describe("retry após falha parcial — reunião", () => {
  it("falha ao eliminar a transcrição: participante NÃO é anonimizado; a nova tentativa ainda o acha e elimina o conteúdo", async () => {
    state.failTranscript = true;
    await expect(runErasure(data)).rejects.toThrow(
      /erase-meeting-transcript-content/
    );
    expect(state.participantEmail).toBe(EMAIL);
    expect(state.transcriptRaw).not.toBeNull();

    state.failTranscript = false;
    await runErasure(data);

    expect(state.transcriptRaw).toBeNull();
    expect(state.participantEmail).toMatch(/@erased\.cosmos$/);
  });

  it("ordem: conteúdo da transcrição antes de anonimizar o participante", async () => {
    await runErasure(data);
    expect(state.calls.indexOf("erase-transcript")).toBeLessThan(
      state.calls.indexOf("anonymize-participant")
    );
  });
});

describe("retry após falha parcial — respondente do Meridian", () => {
  it("falha ao apagar o objeto do bucket: respondente NÃO é anonimizado; a nova tentativa apaga o objeto", async () => {
    state.failBucket = true;
    await expect(runErasure(data)).rejects.toThrow(
      /delete-meridian-evidence-objects/
    );
    expect(state.respondentEmail).toBe(EMAIL);
    expect(state.bucketObjects.size).toBe(1);

    state.failBucket = false;
    await runErasure(data);

    expect(state.bucketObjects.size).toBe(0);
    expect(state.evidenceFileName).toMatch(/^\{subject_anonymized_/);
    expect(state.respondentEmail).toMatch(/@erased\.cosmos$/);
  });

  it("falha ao anonimizar o fileName (objeto já apagado): nova tentativa conclui o fileName e o respondente", async () => {
    state.failFileName = true;
    await expect(runErasure(data)).rejects.toThrow(
      /anonymize-meridian-evidence-filename/
    );
    expect(state.respondentEmail).toBe(EMAIL);

    state.failFileName = false;
    await runErasure(data);

    expect(state.evidenceFileName).toMatch(/^\{subject_anonymized_/);
    expect(state.respondentEmail).toMatch(/@erased\.cosmos$/);
  });

  it("ordem: objeto do bucket e fileName antes de anonimizar o respondente", async () => {
    await runErasure(data);
    const respondent = state.calls.indexOf("anonymize-respondent");
    expect(state.calls.indexOf("delete-objects")).toBeLessThan(respondent);
    expect(state.calls.indexOf("anonymize-filename")).toBeLessThan(respondent);
  });
});
