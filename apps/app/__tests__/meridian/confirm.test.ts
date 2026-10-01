import { beforeEach, describe, expect, it, vi } from "vitest";

// Confirmar o computado (D-29, FR-029a, SC-012). Decisão do revisor sobre um
// eixo CONTESTADO que mantém o score: ação DISTINTA do override (que muda o
// score e continua recusando "sem mudança"), mesmas exigências (override.write,
// justificativa de 20+), append-only (linha kind=CONFIRMATION com antes e
// depois iguais), auditada; tira o eixo da fila (CONTESTED → COMPUTED) sem
// mexer em `final` nem em `computed`.

const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  assessmentFindFirst: vi.fn(),
  scoreFindFirst: vi.fn(),
  scoreUpdate: vi.fn(),
  overrideCreate: vi.fn(),
  sequenceUpsert: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/meridian/guards", () => ({
  requireMeridianPermissionContext: h.requirePerm,
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
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      meridianAssessment: { findFirst: h.assessmentFindFirst },
      meridianAxisScore: { findFirst: h.scoreFindFirst, update: h.scoreUpdate },
      meridianOverride: { create: h.overrideCreate },
      meridianSequence: { upsert: h.sequenceUpsert },
      auditLog: { create: h.auditCreate },
    }),
}));

import { confirmComputed } from "@/app/(meridian)/actions/confirm";

const CTX = {
  tenantId: "t1",
  userId: "u1",
  role: "ADMIN",
  meridianRole: "REVIEWER",
  user: { name: "Clara", email: "c@x.com" },
};
const AS_ID = "clx0000000000000000000as1";
const RATIONALE =
  "O computado reflete a evidência; a discordância é de leitura.";
const SCORE = {
  id: "sc1",
  computed: 61,
  final: null,
  status: "CONTESTED",
  assessment: { code: "AS-104", orgName: "Vanta Saúde" },
};
const input = (over: Record<string, unknown> = {}) => ({
  assessmentId: AS_ID,
  axis: "DATA" as const,
  rationale: RATIONALE,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.requirePerm.mockResolvedValue(CTX);
  h.assessmentFindFirst.mockResolvedValue({ status: "REVIEW" });
  h.scoreFindFirst.mockResolvedValue(SCORE);
  h.sequenceUpsert.mockResolvedValue({ next: 12 });
  h.overrideCreate.mockResolvedValue({ id: "ov1", code: "OV-11" });
  h.scoreUpdate.mockResolvedValue({});
  h.auditCreate.mockResolvedValue({});
});

describe("confirmComputed", () => {
  it("grava uma linha kind=CONFIRMATION com antes e depois iguais, e devolve o código", async () => {
    const res = await confirmComputed(input());
    expect(res.ok && res.data.code).toBe("OV-11");
    const data = h.overrideCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({
      tenantId: "t1",
      assessmentId: AS_ID,
      axis: "DATA",
      kind: "CONFIRMATION",
      fromScore: 61,
      toScore: 61,
      rationale: RATIONALE,
      reviewerId: "u1",
    });
  });

  it("tira o eixo da fila sem mudar o score: status vira COMPUTED, final e computed intactos", async () => {
    await confirmComputed(input());
    const update = h.scoreUpdate.mock.calls[0][0];
    expect(update.data).toEqual({ status: "COMPUTED" });
    expect(update.data).not.toHaveProperty("final");
    expect(update.data).not.toHaveProperty("computed");
  });

  it("parte do final vigente quando já existe: antes e depois são esse valor", async () => {
    h.scoreFindFirst.mockResolvedValue({ ...SCORE, final: 55 });
    await confirmComputed(input());
    const data = h.overrideCreate.mock.calls[0][0].data;
    expect(data.fromScore).toBe(55);
    expect(data.toScore).toBe(55);
  });

  it("exige override.write (a mesma permissão do override) e nem toca no banco sem ela", async () => {
    h.requirePerm.mockRejectedValue(new Error("Requer papel"));
    const res = await confirmComputed(input());
    expect(res.ok).toBe(false);
    expect(h.requirePerm).toHaveBeenCalledWith("override.write");
    expect(h.scoreFindFirst).not.toHaveBeenCalled();
    expect(h.overrideCreate).not.toHaveBeenCalled();
  });

  it.each([
    "",
    "   ",
    "curto",
    "x".repeat(19),
  ])("justificativa %j (menos de 20 caracteres) é recusada antes de qualquer leitura", async (rationale) => {
    const res = await confirmComputed(input({ rationale }));
    expect(res.ok).toBe(false);
    expect(!res.ok && res.code).toBe("confirm.rationale");
    expect(h.scoreFindFirst).not.toHaveBeenCalled();
    expect(h.overrideCreate).not.toHaveBeenCalled();
  });

  it("só confirma eixo CONTESTADO: computado, sobrescrito ou já confirmado são recusados", async () => {
    for (const status of ["COMPUTED", "OVERRIDDEN"]) {
      h.scoreFindFirst.mockResolvedValue({ ...SCORE, status });
      const res = await confirmComputed(input());
      expect(res.ok).toBe(false);
      expect(!res.ok && res.code).toBe("confirm.not-contested");
    }
    expect(h.overrideCreate).not.toHaveBeenCalled();
    expect(h.scoreUpdate).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("eixo sem score: recusa nomeando o motivo", async () => {
    h.scoreFindFirst.mockResolvedValue(null);
    const res = await confirmComputed(input());
    expect(res.ok).toBe(false);
    expect(!res.ok && res.code).toBe("confirm.no-score");
  });

  it("assessment finalizado trava a confirmação (FR-029d)", async () => {
    h.assessmentFindFirst.mockResolvedValue({ status: "FINALISED" });
    const res = await confirmComputed(input());
    expect(res.ok).toBe(false);
    expect(!res.ok && res.code).toBe("assessment.finalised");
    expect(h.overrideCreate).not.toHaveBeenCalled();
    expect(h.scoreUpdate).not.toHaveBeenCalled();
  });

  it("audita a confirmação com o código, o eixo e a justificativa", async () => {
    await confirmComputed(input());
    const audit = h.auditCreate.mock.calls[0][0].data;
    expect(audit).toMatchObject({
      tenantId: "t1",
      userId: "u1",
      action: "meridian.override.confirm",
      entityType: "meridian.override",
      entityId: "ov1",
      diff: [["Eixo", "Contestado", "Confirmado pelo revisor"]],
    });
    expect(audit.metadata.note).toBe(RATIONALE);
    expect(audit.metadata.target).toBe("AS-104 · Data");
  });

  it("filtra por tenant da sessão e pelo assessment informado", async () => {
    await confirmComputed(input());
    expect(h.scoreFindFirst.mock.calls[0][0].where).toEqual({
      tenantId: "t1",
      assessmentId: AS_ID,
      axis: "DATA",
    });
  });
});
