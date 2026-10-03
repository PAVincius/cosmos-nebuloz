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
  headersGet: vi.fn(),
  rateLimiterLimit: vi.fn(),
  rateLimiterPeek: vi.fn(),
  ensureBucket: vi.fn(),
  statusRaw: vi.fn(),
  storageRemove: vi.fn(),
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  storageUpload: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({ get: h.headersGet }),
  // O token do respondente vem do cookie httpOnly da sessão curta, não da URL
  // nem de argumento da action (achado 28a do Lacre).
  cookies: vi.fn().mockResolvedValue({ get: h.cookieGet, set: h.cookieSet }),
}));
vi.mock("@repo/rate-limit", () => ({
  createRateLimiter: vi.fn(() => ({
    limit: h.rateLimiterLimit,
    peek: h.rateLimiterPeek,
  })),
  fixedWindow: vi.fn((max: number, window: string) => ({ max, window })),
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
vi.mock("@repo/storage", async (importOriginal) => ({
  // A lista de tipos de evidência é a real: é ela que a action consulta.
  ...(await importOriginal<typeof import("@repo/storage")>()),
  ensureBucket: h.ensureBucket,
  MERIDIAN_EVIDENCE_BUCKET: "meridian-evidence",
  storageClient: {
    storage: {
      from: () => ({
        upload: h.storageUpload,
        remove: h.storageRemove,
      }),
    },
  },
}));
vi.mock("@repo/database", () => {
  const database: Record<string, unknown> = {
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
    $queryRaw: h.statusRaw,
  };
  // A transação interativa entrega o mesmo cliente: o que importa aqui é que
  // leitura de estado e escrita passem por ele.
  database.$transaction = (fn: (tx: unknown) => unknown) => fn(database);
  return { database };
});

import {
  attachEvidence,
  getBattery,
  resolveRespondentToken,
  saveDraft,
  startRespondentSession,
  submitBattery,
} from "@/app/(meridian)/actions/respondent";

/** Conteúdo de texto de verdade: a action confere os primeiros bytes. */
const TEXTO = new TextEncoder().encode("abc");
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
    status: "COLLECTING",
  },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.headersGet.mockReturnValue(null);
  h.rateLimiterLimit.mockResolvedValue({
    success: true,
    limit: 30,
    remaining: 29,
    reset: 0,
  });
  h.rateLimiterPeek.mockResolvedValue({
    success: true,
    limit: 30,
    remaining: 30,
    reset: 0,
  });
  h.ensureBucket.mockResolvedValue(undefined);
  h.storageUpload.mockResolvedValue({ error: null });
  h.statusRaw.mockResolvedValue([{ status: "COLLECTING" }]);
  h.cookieGet.mockReturnValue({ name: "meridian_resp", value: TOKEN });
  h.storageRemove.mockResolvedValue({ error: null });
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
    const res = await resolveRespondentToken();
    expect(res.ok).toBe(true);
    expect(res.ok && res.data.tenantId).toBe("t1");
    expect(res.ok && res.data.axisLabel).toBe("Data");
  });

  it("consulta por hash, nunca pelo token em claro", async () => {
    await resolveRespondentToken();
    const args = h.respondentFindUnique.mock.calls[0]?.[0] as {
      where: { tokenHash: string };
    };
    expect(args.where.tokenHash).not.toBe(TOKEN);
    expect(args.where.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("devolve o mesmo erro para token inexistente, expirado e revogado", async () => {
    h.respondentFindUnique.mockResolvedValue(null);
    const inexistente = await resolveRespondentToken();

    h.respondentFindUnique.mockResolvedValue(
      respondent({ tokenExpiresAt: PAST })
    );
    const expirado = await resolveRespondentToken();

    h.respondentFindUnique.mockResolvedValue(respondent({ status: "REVOKED" }));
    const revogado = await resolveRespondentToken();

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
    await getBattery();
    const args = h.questionFindMany.mock.calls[0]?.[0] as {
      where: { templateId: string; axis: string };
    };
    expect(args.where.axis).toBe("DATA");
    expect(args.where.templateId).toBe("tpl1");
  });

  it("carrega só as respostas do próprio respondente", async () => {
    await getBattery();
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
    await saveDraft({ answers: [] });
    expect(h.respondentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PENDING" } })
    );
  });
});

describe("submitBattery", () => {
  it("não conclui com pergunta em branco e devolve quantas faltam", async () => {
    h.questionCount.mockResolvedValue(5);
    h.responseCount.mockResolvedValue(3);
    const res = await submitBattery();
    expect(res.ok && res.data.missing).toBe(2);
    expect(h.respondentUpdate).not.toHaveBeenCalled();
  });

  it("conclui quando a bateria está completa e registra a trilha", async () => {
    h.questionCount.mockResolvedValue(5);
    h.responseCount.mockResolvedValue(5);
    const res = await submitBattery();
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

describe("rate limit do lookup de token (atrito.md:48 / parecer cond. 5)", () => {
  // Duas etapas — revisão da Morgana sobre 9468abd9: checar (peek, só
  // leitura) ANTES da consulta por hash; incrementar (limit) só DEPOIS de um
  // miss. Checar só depois do miss deixava um IP já acima do teto continuar
  // acertando token válido — sucesso nunca chamava o limitador.

  it("(a) IP acima do teto + token VÁLIDO → RATE_LIMIT_ERROR, sem consultar o banco", async () => {
    h.rateLimiterPeek.mockResolvedValue({
      success: false,
      limit: 30,
      remaining: 0,
      reset: 0,
    });
    // respondentFindUnique segue mockado com um respondente válido —
    // mesmo assim tem que barrar, porque o peek roda antes da consulta.
    const res = await getBattery();
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toBe("Muitas tentativas. Aguarde um minuto.");
    expect(h.respondentFindUnique).not.toHaveBeenCalled();
  });

  it("(b) sucesso não incrementa — só o peek (só leitura) é consultado", async () => {
    const res = await getBattery();
    expect(res.ok).toBe(true);
    expect(h.rateLimiterPeek).toHaveBeenCalledTimes(1);
    expect(h.rateLimiterLimit).not.toHaveBeenCalled();
  });

  it("(c) miss incrementa — dentro do teto, consulta o banco e grava a falha", async () => {
    h.respondentFindUnique.mockResolvedValue(null);
    const res = await getBattery();
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toBe("Link inválido ou expirado.");
    expect(h.rateLimiterLimit).toHaveBeenCalledTimes(1);
  });

  it("resolveRespondentToken também passa pelo peek — bypass corrigido", async () => {
    h.rateLimiterPeek.mockResolvedValue({
      success: false,
      limit: 30,
      remaining: 0,
      reset: 0,
    });
    const res = await resolveRespondentToken();
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toBe("Muitas tentativas. Aguarde um minuto.");
    expect(h.respondentFindUnique).not.toHaveBeenCalled();
  });

  it("prefere x-real-ip a x-forwarded-for como identificador", async () => {
    h.headersGet.mockImplementation((name: string) =>
      name === "x-real-ip" ? "8.8.8.8" : "9.9.9.9, 1.1.1.1"
    );
    await getBattery();
    expect(h.rateLimiterPeek).toHaveBeenCalledWith("8.8.8.8");
  });

  it("cai para o primeiro IP de x-forwarded-for quando não há x-real-ip", async () => {
    h.headersGet.mockImplementation((name: string) =>
      name === "x-forwarded-for" ? "9.9.9.9, 1.1.1.1" : null
    );
    await getBattery();
    expect(h.rateLimiterPeek).toHaveBeenCalledWith("9.9.9.9");
  });

  it("usa 'anonymous' quando não há x-real-ip nem x-forwarded-for", async () => {
    h.headersGet.mockReturnValue(null);
    await getBattery();
    expect(h.rateLimiterPeek).toHaveBeenCalledWith("anonymous");
  });

  it("aplica o mesmo mecanismo a saveDraft — também passa por loadRespondent", async () => {
    h.rateLimiterPeek.mockResolvedValue({
      success: false,
      limit: 30,
      remaining: 0,
      reset: 0,
    });
    const res = await saveDraft({ answers: [] });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toBe("Muitas tentativas. Aguarde um minuto.");
  });

  it("em produção, trata peek indisponível como limite excedido (fail-closed)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    h.rateLimiterPeek.mockRejectedValue(new Error("connection refused"));
    const res = await getBattery();
    vi.unstubAllEnvs();
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toBe("Muitas tentativas. Aguarde um minuto.");
    expect(h.respondentFindUnique).not.toHaveBeenCalled();
  });

  it("fora de produção, peek indisponível não bloqueia — segue pro banco normalmente", async () => {
    vi.stubEnv("NODE_ENV", "test");
    h.rateLimiterPeek.mockRejectedValue(new Error("connection refused"));
    const res = await getBattery();
    vi.unstubAllEnvs();
    expect(res.ok).toBe(true);
  });

  it("falha ao gravar o miss (limit indisponível) não muda o erro devolvido", async () => {
    h.respondentFindUnique.mockResolvedValue(null);
    h.rateLimiterLimit.mockRejectedValue(new Error("connection refused"));
    const res = await getBattery();
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toBe("Link inválido ou expirado.");
  });
});

describe("ensureBucket cacheado no processo (atrito.md:54)", () => {
  it("chama ensureBucket uma vez só, mesmo com duas evidências anexadas", async () => {
    h.questionFindFirst.mockResolvedValue({ id: "q1" });
    h.responseFindUnique.mockResolvedValue(null);
    h.evidenceCreate.mockResolvedValue({ id: "e1", fileName: "ev.txt" });
    const file = {
      size: 3,
      type: "text/plain",
      name: "ev.txt",
      arrayBuffer: () => Promise.resolve(TEXTO.buffer as ArrayBuffer),
    } as unknown as File;

    await attachEvidence("q1", file);
    await attachEvidence("q1", file);

    expect(h.ensureBucket).toHaveBeenCalledTimes(1);
  });
});

describe("attachEvidence — target do audit (achado da Morgana sobre report.ts, mesmo padrão aqui)", () => {
  it("não carrega o nome original do arquivo no target — usa o id da evidência", async () => {
    h.questionFindFirst.mockResolvedValue({ id: "q1" });
    h.responseFindUnique.mockResolvedValue(null);
    h.evidenceCreate.mockResolvedValue({ id: "e1", fileName: "ev.txt" });
    const file = {
      size: 3,
      type: "text/plain",
      name: "ev.txt",
      arrayBuffer: () => Promise.resolve(TEXTO.buffer as ArrayBuffer),
    } as unknown as File;

    await attachEvidence("q1", file);

    const audit = h.auditCreate.mock.calls[0]?.[0] as {
      data: { metadata: { target: string } };
    };
    expect(audit.data.metadata.target).not.toContain("ev.txt");
    expect(audit.data.metadata.target).toBe("AS-104 · e1");
  });
});

// D-29 (FR-029c, SC-014): a coleta fechada não aceita mais escrita pelo link,
// mesmo com o token ainda válido — antes mesmo da finalização. Só COLLECTING
// grava; ler a bateria continua permitido.
describe("coleta fechada trava a escrita do respondente (FR-029c)", () => {
  const file = {
    size: 3,
    type: "text/plain",
    name: "ev.txt",
    arrayBuffer: () => Promise.resolve(TEXTO.buffer as ArrayBuffer),
  } as unknown as File;

  const fechado = (status: string) =>
    respondent({
      assessment: {
        id: "a1",
        code: "AS-104",
        orgName: "Vanta Saúde",
        templateId: "tpl1",
        status,
      },
    });

  it.each([
    "REVIEW",
    "FINALISED",
    "DRAFT",
  ])("saveDraft recusa com o assessment em %s, sem gravar nada", async (status) => {
    h.respondentFindUnique.mockResolvedValue(fechado(status));
    const res = await saveDraft({
      answers: [{ questionId: "clx000000000000000000q001", rawValue: 3 }],
    });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.code).toBe("collection.closed");
    expect(h.responseUpsert).not.toHaveBeenCalled();
    expect(h.respondentUpdate).not.toHaveBeenCalled();
  });

  it.each([
    "REVIEW",
    "FINALISED",
    "DRAFT",
  ])("submitBattery recusa com o assessment em %s, sem concluir nem auditar", async (status) => {
    h.respondentFindUnique.mockResolvedValue(fechado(status));
    const res = await submitBattery();
    expect(res.ok).toBe(false);
    expect(!res.ok && res.code).toBe("collection.closed");
    expect(h.respondentUpdate).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it.each([
    "REVIEW",
    "FINALISED",
    "DRAFT",
  ])("attachEvidence recusa com o assessment em %s, sem tocar no bucket nem no banco", async (status) => {
    h.respondentFindUnique.mockResolvedValue(fechado(status));
    const res = await attachEvidence("q1", file);
    expect(res.ok).toBe(false);
    expect(!res.ok && res.code).toBe("collection.closed");
    expect(h.ensureBucket).not.toHaveBeenCalled();
    expect(h.evidenceCreate).not.toHaveBeenCalled();
  });

  it("em COLLECTING a escrita segue normal", async () => {
    const res = await saveDraft({
      answers: [{ questionId: "clx000000000000000000q001", rawValue: 3 }],
    });
    expect(res.ok).toBe(true);
  });

  it("ler a bateria continua permitido depois do fechamento (só leitura)", async () => {
    h.respondentFindUnique.mockResolvedValue(fechado("REVIEW"));
    const res = await getBattery();
    expect(res.ok).toBe(true);
  });
});

// A leitura do token acontece antes; entre ela e a escrita o consultor pode
// fechar a coleta. A conferência final lê o estado na mesma transação da
// escrita (com trava de linha), então quem perde a corrida não grava.
describe("submitBattery de bateria já concluída", () => {
  it("é idempotente: devolve concluído sem gravar nem auditar de novo", async () => {
    h.respondentFindUnique.mockResolvedValue(respondent({ status: "DONE" }));
    const res = await submitBattery();
    expect(res.ok && res.data.missing).toBe(0);
    expect(h.respondentUpdate).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
    expect(h.questionCount).not.toHaveBeenCalled();
  });
});

describe("coleta fechada entre o token e a escrita", () => {
  const file = {
    size: 3,
    type: "text/plain",
    name: "ev.txt",
    arrayBuffer: () => Promise.resolve(TEXTO.buffer as ArrayBuffer),
  } as unknown as File;

  beforeEach(() => {
    // O token ainda mostra COLLECTING; o banco, na transação, já diz REVIEW.
    h.statusRaw.mockResolvedValue([{ status: "REVIEW" }]);
  });

  it("saveDraft recusa e não grava resposta", async () => {
    const res = await saveDraft({
      answers: [{ questionId: "clx000000000000000000q001", rawValue: 3 }],
    });
    expect(!res.ok && res.code).toBe("collection.closed");
    expect(h.statusRaw).toHaveBeenCalledTimes(1);
    expect(h.responseUpsert).not.toHaveBeenCalled();
    expect(h.respondentUpdate).not.toHaveBeenCalled();
  });

  it("submitBattery recusa e não conclui nem audita", async () => {
    h.questionCount.mockResolvedValue(1);
    h.responseCount.mockResolvedValue(1);
    const res = await submitBattery();
    expect(!res.ok && res.code).toBe("collection.closed");
    expect(h.respondentUpdate).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("attachEvidence recusa, não grava metadado e remove o arquivo já enviado", async () => {
    h.questionFindFirst.mockResolvedValue({ id: "q1" });
    h.responseFindUnique.mockResolvedValue(null);
    const res = await attachEvidence("q1", file);
    expect(!res.ok && res.code).toBe("collection.closed");
    expect(h.evidenceCreate).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
    expect(h.storageRemove).toHaveBeenCalledTimes(1);
  });
});

// Achado 28a do Lacre: o token do respondente ia no caminho da URL e aparecia em
// claro nos logs de runtime. Agora a primeira carga o troca por um cookie
// httpOnly e as actions leem o cookie: nada de token em argumento nem em URL.
describe("token da sessão do respondente vem do cookie", () => {
  it("consulta pelo hash do valor do cookie", async () => {
    await getBattery();
    const args = h.respondentFindUnique.mock.calls[0]?.[0] as {
      where: { tokenHash: string };
    };
    expect(args.where.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(args.where.tokenHash).not.toBe(TOKEN);
  });

  it("sem cookie, toda action devolve o mesmo erro de link inválido, sem tocar no banco", async () => {
    h.cookieGet.mockReturnValue(undefined);
    const file = {
      size: 1,
      type: "text/plain",
      name: "a.txt",
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)),
    } as unknown as File;
    const results = [
      await getBattery(),
      await resolveRespondentToken(),
      await saveDraft({ answers: [] }),
      await submitBattery(),
      await attachEvidence("q1", file),
    ];
    for (const res of results) {
      expect(res.ok).toBe(false);
      expect(!res.ok && res.error).toBe("Link inválido ou expirado.");
    }
    expect(h.respondentFindUnique).not.toHaveBeenCalled();
  });

  it("cookie com lixo (não é hex de 64) é recusado antes de consultar o banco", async () => {
    h.cookieGet.mockReturnValue({
      name: "meridian_resp",
      value: "nao-e-token",
    });
    const res = await getBattery();
    expect(res.ok).toBe(false);
    expect(h.respondentFindUnique).not.toHaveBeenCalled();
  });
});

// Achado 28a, 2ª parte: o token chega à server action no CORPO do POST (argumento),
// vindo do fragmento da URL, que o servidor nunca vê. A action o valida e grava o
// cookie de sessão; nada disso passa pelo endereço da requisição.
describe("startRespondentSession", () => {
  const EXPIRES = new Date("2026-10-16T12:00:00.000Z");

  it("token válido: grava o cookie httpOnly, SameSite=Lax, no path da bateria, expirando com o token", async () => {
    h.respondentFindUnique.mockResolvedValue(
      respondent({ tokenExpiresAt: EXPIRES })
    );
    const res = await startRespondentSession(TOKEN);
    expect(res.ok).toBe(true);
    expect(h.cookieSet).toHaveBeenCalledTimes(1);
    const [name, value, options] = h.cookieSet.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(name).toBe("meridian_resp");
    expect(value).toBe(TOKEN);
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/meridian-responder",
      expires: EXPIRES,
    });
  });

  it("consulta pelo hash do token recebido, nunca por ele em claro", async () => {
    h.respondentFindUnique.mockResolvedValue(respondent());
    await startRespondentSession(TOKEN);
    const args = h.respondentFindUnique.mock.calls[0]?.[0] as {
      where: { tokenHash: string };
    };
    expect(args.where.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(args.where.tokenHash).not.toBe(TOKEN);
  });

  it("inexistente, expirado e revogado: mesmo erro, sem cookie", async () => {
    const errors: (string | undefined)[] = [];
    for (const found of [
      null,
      respondent({ tokenExpiresAt: PAST }),
      respondent({ status: "REVOKED" }),
    ]) {
      h.respondentFindUnique.mockResolvedValue(found);
      const res = await startRespondentSession(TOKEN);
      expect(res.ok).toBe(false);
      errors.push(res.ok ? undefined : res.error);
    }
    expect(new Set(errors).size).toBe(1);
    expect(errors[0]).toBe("Link inválido ou expirado.");
    expect(h.cookieSet).not.toHaveBeenCalled();
  });

  it("texto que não tem forma de token nem chega ao banco", async () => {
    const res = await startRespondentSession("curto");
    expect(res.ok).toBe(false);
    expect(h.respondentFindUnique).not.toHaveBeenCalled();
    expect(h.cookieSet).not.toHaveBeenCalled();
  });

  it("acima do teto de consultas por IP: recusa sem consultar o banco", async () => {
    h.rateLimiterPeek.mockResolvedValue({
      success: false,
      limit: 30,
      remaining: 0,
      reset: 0,
    });
    const res = await startRespondentSession(TOKEN);
    expect(!res.ok && res.error).toBe("Muitas tentativas. Aguarde um minuto.");
    expect(h.respondentFindUnique).not.toHaveBeenCalled();
    expect(h.cookieSet).not.toHaveBeenCalled();
  });
});

// Achado 29c do Lacre: saveDraft gravava respostas sem trilha. O ato é do
// respondente (sem conta), então a trilha leva actorType "respondent" e o id
// dele; o diff conta o que foi gravado, nunca o conteúdo da resposta nem o nome.
describe("saveDraft — trilha de auditoria", () => {
  const QID = "clx000000000000000000q001";
  const ANSWER = [{ questionId: QID, rawValue: 3 }];
  beforeEach(() => {
    // A pergunta do eixo do respondente, com o mesmo id que o rascunho envia.
    h.questionFindMany.mockResolvedValue([
      {
        id: QID,
        code: "Q-D01",
        ordinal: 1,
        type: "LIKERT",
        weight: 1,
        inverted: false,
        scaleLabels: [],
      },
    ]);
  });
  const audit = () =>
    (
      h.auditCreate.mock.calls[0]?.[0] as {
        data: {
          action: string;
          actorType: string;
          actorId: string;
          entityType: string;
          entityId: string;
          diff: [string, string, string][];
          metadata: { target: string };
        };
      }
    ).data;

  it("grava meridian.respondent.draft como ato do respondente, com a contagem de respostas", async () => {
    h.respondentFindUnique.mockResolvedValue(respondent({ status: "PENDING" }));
    await saveDraft({ answers: ANSWER });
    expect(h.auditCreate).toHaveBeenCalledTimes(1);
    const a = audit();
    expect(a.action).toBe("meridian.respondent.draft");
    expect(a.actorType).toBe("respondent");
    expect(a.actorId).toBe("r1");
    expect(a.entityType).toBe("meridian.response");
    expect(a.entityId).toBe("r1");
    expect(a.metadata.target).toBe("AS-104 · Data");
    expect(a.diff).toEqual([["Respostas gravadas", "—", "1"]]);
  });

  it("o primeiro rascunho registra também a passagem de Convidado para Pendente", async () => {
    h.respondentFindUnique.mockResolvedValue(respondent({ status: "INVITED" }));
    await saveDraft({ answers: ANSWER });
    expect(audit().diff).toEqual([
      ["Respostas gravadas", "—", "1"],
      ["Status", "INVITED", "PENDING"],
    ]);
  });

  // `actorName` (quem agiu) vem do helper, como nas trilhas de enviar e de anexar:
  // identifica o ator. O que este teste prende é o RESTO: alvo e diff não levam
  // nome nem o valor da resposta.
  it("alvo e diff não levam o nome do respondente nem o valor da resposta", async () => {
    h.respondentFindUnique.mockResolvedValue(respondent({ status: "PENDING" }));
    await saveDraft({
      answers: [{ questionId: QID, rawValue: 4 }],
    });
    const a = audit();
    expect(JSON.stringify(a.diff)).not.toContain("Jonas Reis");
    expect(a.metadata.target).not.toContain("Jonas Reis");
    expect(JSON.stringify(a.diff)).not.toMatch(/rawValue|"4"/);
  });

  it("rascunho que não grava nada (sem resposta, já Pendente) não gera trilha", async () => {
    h.respondentFindUnique.mockResolvedValue(respondent({ status: "PENDING" }));
    await saveDraft({ answers: [] });
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("recusado pela coleta fechada não grava trilha", async () => {
    h.statusRaw.mockResolvedValue([{ status: "REVIEW" }]);
    await saveDraft({ answers: ANSWER });
    expect(h.auditCreate).not.toHaveBeenCalled();
  });
});
