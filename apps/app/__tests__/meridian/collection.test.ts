import { beforeEach, describe, expect, it, vi } from "vitest";

// Coleta — FR-011/FR-012 e a mecânica do link seguro.
//
// O que trava aqui: eixo sem dono impede o fechamento (e o erro nomeia quais),
// pendência não impede mas é declarada, e revogar invalida o token na hora em
// vez de esperar a expiração.

const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  assessmentFindFirst: vi.fn(),
  assessmentUpdate: vi.fn(),
  respondentCreate: vi.fn(),
  respondentFindFirst: vi.fn(),
  respondentUpdate: vi.fn(),
  responseCount: vi.fn(),
  auditCreate: vi.fn(),
  runScoringInTx: vi.fn(),
}));

vi.mock("@/lib/meridian/guards", () => ({
  requireMeridianPermissionContext: h.requirePerm,
  requireMeridianContext: h.requirePerm,
  MeridianRuleError: class extends Error {
    rule: string;
    status = 422;
    constructor(rule: string, message: string) {
      super(message);
      this.rule = rule;
    }
  },
  StateConflictError: class extends Error {
    rule: string;
    status = 409;
    blockers: string[];
    constructor(rule: string, message: string, blockers: string[] = []) {
      super(message);
      this.rule = rule;
      this.blockers = blockers;
    }
  },
}));
vi.mock("@/app/(meridian)/actions/scoring", () => ({
  runScoringInTx: h.runScoringInTx,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      meridianAssessment: {
        findFirst: h.assessmentFindFirst,
        update: h.assessmentUpdate,
      },
      meridianRespondent: {
        create: h.respondentCreate,
        findFirst: h.respondentFindFirst,
        update: h.respondentUpdate,
      },
      meridianResponse: { count: h.responseCount },
      auditLog: { create: h.auditCreate },
    }),
}));

import {
  assignRespondent,
  closeCollection,
  revokeRespondent,
  sendReminder,
} from "@/app/(meridian)/actions/collection";

const CTX = {
  tenantId: "t1",
  userId: "u1",
  role: "ADMIN",
  meridianRole: "CONSULTANT",
  user: { name: "Marina", email: "m@x.com" },
};
const AS_ID = "clx0000000000000000000as1";
const R_ID = "clx00000000000000000000r1";

const ALL_AXES = [
  "DATA",
  "PROCESS",
  "PEOPLE",
  "GOVERNANCE",
  "INFRASTRUCTURE",
] as const;

const assessmentWith = (axes: readonly string[]) => ({
  id: AS_ID,
  code: "AS-104",
  orgName: "Vanta Saúde",
  status: "COLLECTING",
  deadline: new Date("2026-12-01"),
  template: { questions: axes.flatMap((axis) => [{ axis }, { axis }]) },
  respondents: axes.map((axis, i) => ({ id: `r${i}`, axis })),
});

beforeEach(() => {
  vi.clearAllMocks();
  h.requirePerm.mockResolvedValue(CTX);
  h.assessmentUpdate.mockResolvedValue({});
  h.respondentCreate.mockResolvedValue({ id: R_ID });
  h.respondentUpdate.mockResolvedValue({});
  h.auditCreate.mockResolvedValue({});
  h.responseCount.mockResolvedValue(10);
  h.runScoringInTx.mockResolvedValue([]);
});

describe("assignRespondent", () => {
  beforeEach(() => {
    h.assessmentFindFirst.mockResolvedValue({
      id: AS_ID,
      code: "AS-104",
      deadline: new Date("2026-12-01"),
      status: "DRAFT",
    });
  });

  it("devolve o token em claro uma única vez e persiste só o hash", async () => {
    const res = await assignRespondent({
      assessmentId: AS_ID,
      name: "Jonas Reis",
      role: "Eng. de Dados",
      email: "jonas@vanta.com",
      axis: "DATA",
    });
    expect(res.ok).toBe(true);
    const token = res.ok ? res.data.token : "";
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    const created = h.respondentCreate.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(created.data.tokenHash).toBeTruthy();
    expect(created.data.tokenHash).not.toBe(token);
    expect(created.data).not.toHaveProperty("token");
  });

  it("abre a coleta ao atribuir o primeiro respondente", async () => {
    await assignRespondent({
      assessmentId: AS_ID,
      name: "Jonas",
      role: "Eng",
      email: "j@x.com",
      axis: "DATA",
    });
    expect(h.assessmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "COLLECTING" } })
    );
  });

  it("recusa atribuição em assessment finalizado", async () => {
    h.assessmentFindFirst.mockResolvedValue({
      id: AS_ID,
      code: "AS-104",
      deadline: new Date("2026-12-01"),
      status: "FINALISED",
    });
    const res = await assignRespondent({
      assessmentId: AS_ID,
      name: "Jonas",
      role: "Eng",
      email: "j@x.com",
      axis: "DATA",
    });
    expect(res.ok).toBe(false);
    expect(h.respondentCreate).not.toHaveBeenCalled();
  });

  it("recusa e-mail inválido no boundary", async () => {
    const res = await assignRespondent({
      assessmentId: AS_ID,
      name: "Jonas",
      role: "Eng",
      email: "não-é-email",
      axis: "DATA",
    });
    expect(res.ok).toBe(false);
    expect(h.respondentCreate).not.toHaveBeenCalled();
  });
});

describe("revokeRespondent", () => {
  it("regrava o hash — o token antigo deixa de casar na hora", async () => {
    h.respondentFindFirst.mockResolvedValue({
      id: R_ID,
      name: "Jonas",
      status: "PENDING",
    });
    const res = await revokeRespondent({ respondentId: R_ID });
    expect(res.ok).toBe(true);
    const update = h.respondentUpdate.mock.calls[0]?.[0] as {
      data: { status: string; tokenHash: string };
    };
    expect(update.data.status).toBe("REVOKED");
    expect(update.data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("sendReminder", () => {
  it("recusa lembrete a quem já concluiu", async () => {
    h.respondentFindFirst.mockResolvedValue({
      id: R_ID,
      name: "Ana Kim",
      status: "DONE",
    });
    const res = await sendReminder({ respondentId: R_ID });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/já concluiu/i);
    expect(h.respondentUpdate).not.toHaveBeenCalled();
  });

  it("recusa lembrete a respondente revogado", async () => {
    h.respondentFindFirst.mockResolvedValue({
      id: R_ID,
      name: "Ana",
      status: "REVOKED",
    });
    const res = await sendReminder({ respondentId: R_ID });
    expect(res.ok).toBe(false);
  });

  it("registra o lembrete para quem está pendente", async () => {
    h.respondentFindFirst.mockResolvedValue({
      id: R_ID,
      name: "Rui",
      status: "PENDING",
    });
    const res = await sendReminder({ respondentId: R_ID });
    expect(res.ok).toBe(true);
    expect(h.respondentUpdate).toHaveBeenCalled();
  });
});

describe("closeCollection", () => {
  it("recusa quando há eixo sem respondente e nomeia os eixos", async () => {
    h.assessmentFindFirst.mockResolvedValue(
      assessmentWith(["DATA", "PROCESS"])
    );
    const res = await closeCollection({ assessmentId: AS_ID });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/sem respondente/i);
    expect(h.assessmentUpdate).not.toHaveBeenCalled();
    expect(h.runScoringInTx).not.toHaveBeenCalled();
  });

  it("fecha com todos os eixos cobertos e dispara o scoring na mesma transação", async () => {
    h.assessmentFindFirst.mockResolvedValue(assessmentWith(ALL_AXES));
    h.responseCount.mockResolvedValue(10);
    const res = await closeCollection({ assessmentId: AS_ID });
    expect(res.ok).toBe(true);
    expect(res.ok && res.data.pendingResponses).toBe(0);
    expect(h.assessmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REVIEW" }),
      })
    );
    expect(h.runScoringInTx).toHaveBeenCalledTimes(1);
  });

  it("aceita pendências e devolve a contagem para a UI declarar o impacto", async () => {
    h.assessmentFindFirst.mockResolvedValue(assessmentWith(ALL_AXES));
    h.responseCount.mockResolvedValue(6);
    const res = await closeCollection({ assessmentId: AS_ID });
    expect(res.ok).toBe(true);
    expect(res.ok && res.data.pendingResponses).toBe(4);
  });

  it("recusa fechar assessment já finalizado", async () => {
    h.assessmentFindFirst.mockResolvedValue({
      ...assessmentWith(ALL_AXES),
      status: "FINALISED",
    });
    const res = await closeCollection({ assessmentId: AS_ID });
    expect(res.ok).toBe(false);
  });

  it("ignora respondente revogado ao medir cobertura de eixo", async () => {
    // A action filtra REVOKED na própria query; o teste garante que o filtro
    // continua na cláusula, e não virou responsabilidade da UI.
    h.assessmentFindFirst.mockResolvedValue(assessmentWith(ALL_AXES));
    await closeCollection({ assessmentId: AS_ID });
    const args = h.assessmentFindFirst.mock.calls[0]?.[0] as {
      include: { respondents: { where: { status: { not: string } } } };
    };
    expect(args.include.respondents.where.status.not).toBe("REVOKED");
  });
});
