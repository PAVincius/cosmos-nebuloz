import { beforeEach, describe, expect, it, vi } from "vitest";

// Visão do respondente — FR-004 e as regras do link seguro.
//
// A superfície sem sessão do módulo. O que precisa ser verdade: só o eixo dele
// é visível, escrita em pergunta de outro eixo é descartada, e token inválido,
// expirado ou revogado devolvem exatamente o mesmo erro.

const h = vi.hoisted(() => ({
  respondentFindUnique: vi.fn(),
  respondentUpdate: vi.fn(),
  questionFindMany: vi.fn(),
  questionCount: vi.fn(),
  questionFindFirst: vi.fn(),
  responseFindMany: vi.fn(),
  responseCount: vi.fn(),
  responseUpsert: vi.fn(),
  responseFindUnique: vi.fn(),
  evidenceCreate: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/meridian/guards", () => ({
  MeridianRuleError: class extends Error {
    rule: string;
    constructor(rule: string, message: string) {
      super(message);
      this.rule = rule;
    }
  },
  StateConflictError: class extends Error {
    rule: string;
    blockers: string[];
    constructor(rule: string, message: string, blockers: string[] = []) {
      super(message);
      this.rule = rule;
      this.blockers = blockers;
    }
  },
}));
vi.mock("@repo/storage", () => ({
  ensureBucket: vi.fn(),
  MERIDIAN_EVIDENCE_BUCKET: "meridian-evidence",
  storageClient: {
    storage: {
      from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }),
    },
  },
}));
vi.mock("@repo/database", () => ({
  database: {
    meridianRespondent: {
      findUnique: h.respondentFindUnique,
      update: h.respondentUpdate,
    },
    meridianQuestion: {
      findMany: h.questionFindMany,
      count: h.questionCount,
      findFirst: h.questionFindFirst,
    },
    meridianResponse: {
      findMany: h.responseFindMany,
      count: h.responseCount,
      upsert: h.responseUpsert,
      findUnique: h.responseFindUnique,
    },
    meridianEvidence: { create: h.evidenceCreate },
    auditLog: { create: h.auditCreate },
  },
}));

import {
  getBattery,
  resolveRespondentToken,
  saveDraft,
  submitBattery,
} from "@/app/(meridian)/actions/respondent";

const TOKEN = "a".repeat(64);
const FUTURE = new Date(Date.now() + 30 * 86_400_000);
const PAST = new Date(Date.now() - 86_400_000);

const respondent = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  tenantId: "t1",
  name: "Jonas Reis",
  axis: "DATA",
  status: "PENDING",
  tokenExpiresAt: FUTURE,
  assessment: {
    id: "a1",
    code: "AS-104",
    orgName: "Vanta Saúde",
    templateId: "tpl1",
  },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.respondentFindUnique.mockResolvedValue(respondent());
  h.questionFindMany.mockResolvedValue([
    {
      id: "q1",
      code: "Q-D01",
      type: "LIKERT",
      text: "Fontes catalogadas?",
      scaleLabels: [],
      ordinal: 1,
      weight: 1,
      inverted: false,
    },
  ]);
  h.responseFindMany.mockResolvedValue([]);
  h.responseUpsert.mockResolvedValue({});
  h.respondentUpdate.mockResolvedValue({});
  h.auditCreate.mockResolvedValue({});
});

describe("resolveRespondentToken", () => {
  it("resolve token válido e devolve o tenant a partir do respondente", async () => {
    const res = await resolveRespondentToken(TOKEN);
    expect(res.ok).toBe(true);
    expect(res.ok && res.data.tenantId).toBe("t1");
    expect(res.ok && res.data.axisLabel).toBe("Data");
  });

  it("consulta por hash, nunca pelo token em claro", async () => {
    await resolveRespondentToken(TOKEN);
    const args = h.respondentFindUnique.mock.calls[0]?.[0] as {
      where: { tokenHash: string };
    };
    expect(args.where.tokenHash).not.toBe(TOKEN);
    expect(args.where.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("devolve o mesmo erro para token inexistente, expirado e revogado", async () => {
    h.respondentFindUnique.mockResolvedValue(null);
    const inexistente = await resolveRespondentToken(TOKEN);

    h.respondentFindUnique.mockResolvedValue(
      respondent({ tokenExpiresAt: PAST })
    );
    const expirado = await resolveRespondentToken(TOKEN);

    h.respondentFindUnique.mockResolvedValue(respondent({ status: "REVOKED" }));
    const revogado = await resolveRespondentToken(TOKEN);

    expect(inexistente.ok).toBe(false);
    expect(expirado.ok).toBe(false);
    expect(revogado.ok).toBe(false);
    const msg = (r: typeof inexistente) => (r.ok ? "" : r.error);
    expect(msg(expirado)).toBe(msg(inexistente));
    expect(msg(revogado)).toBe(msg(inexistente));
  });
});

describe("getBattery", () => {
  it("pede só as perguntas do eixo daquele respondente", async () => {
    await getBattery(TOKEN);
    const args = h.questionFindMany.mock.calls[0]?.[0] as {
      where: { templateId: string; axis: string };
    };
    expect(args.where.axis).toBe("DATA");
    expect(args.where.templateId).toBe("tpl1");
  });

  it("carrega só as respostas do próprio respondente", async () => {
    await getBattery(TOKEN);
    const args = h.responseFindMany.mock.calls[0]?.[0] as {
      where: { respondentId: string };
    };
    expect(args.where.respondentId).toBe("r1");
  });
});

describe("saveDraft", () => {
  it("descarta silenciosamente resposta a pergunta de outro eixo", async () => {
    // A query já filtra por eixo: a pergunta forasteira não volta, então não há
    // upsert para ela. Um cliente adulterado não escreve fora da própria fatia.
    h.questionFindMany.mockResolvedValue([]);
    const res = await saveDraft({
      token: TOKEN,
      answers: [{ questionId: "clx000000000000000000q999", rawValue: 2 }],
    });
    expect(res.ok).toBe(true);
    expect(h.responseUpsert).not.toHaveBeenCalled();
  });

  it("grava valor normalizado junto do bruto", async () => {
    h.questionFindMany.mockResolvedValue([
      {
        id: "clx000000000000000000q001",
        code: "Q-D01",
        ordinal: 1,
        type: "LIKERT",
        weight: 1,
        inverted: false,
        scaleLabels: [],
      },
    ]);
    await saveDraft({
      token: TOKEN,
      answers: [{ questionId: "clx000000000000000000q001", rawValue: 4 }],
    });
    const call = h.responseUpsert.mock.calls[0]?.[0] as {
      create: { rawValue: number; normalized: number };
    };
    expect(call.create.rawValue).toBe(4);
    expect(call.create.normalized).toBe(1);
  });

  it("move de INVITED para PENDING no primeiro rascunho", async () => {
    h.respondentFindUnique.mockResolvedValue(respondent({ status: "INVITED" }));
    h.questionFindMany.mockResolvedValue([]);
    await saveDraft({ token: TOKEN, answers: [] });
    expect(h.respondentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PENDING" } })
    );
  });
});

describe("submitBattery", () => {
  it("não conclui com pergunta em branco e devolve quantas faltam", async () => {
    h.questionCount.mockResolvedValue(5);
    h.responseCount.mockResolvedValue(3);
    const res = await submitBattery(TOKEN);
    expect(res.ok && res.data.missing).toBe(2);
    expect(h.respondentUpdate).not.toHaveBeenCalled();
  });

  it("conclui quando a bateria está completa e registra a trilha", async () => {
    h.questionCount.mockResolvedValue(5);
    h.responseCount.mockResolvedValue(5);
    const res = await submitBattery(TOKEN);
    expect(res.ok && res.data.missing).toBe(0);
    expect(h.respondentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DONE" }),
      })
    );
    const audit = h.auditCreate.mock.calls[0]?.[0] as {
      data: { actorType: string; actorId: string };
    };
    expect(audit.data.actorType).toBe("respondent");
    expect(audit.data.actorId).toBe("r1");
  });
});
