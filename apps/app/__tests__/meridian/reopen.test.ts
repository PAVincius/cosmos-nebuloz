import { beforeEach, describe, expect, it, vi } from "vitest";

// Reabrir assessment finalizado (D-29, FR-029e, SC-015). Só CONSULTANT
// (`assessment.manage`), com motivo de 20+ caracteres, auditado; volta a
// REVIEW — nunca a COLLECTING; as respostas seguem travadas. Nada além do
// status é tocado (o baseline assinado de uma trilha do Scaffold não muda): o
// banco de mentira só conhece `meridianAssessment` e `auditLog`, então qualquer
// outra escrita estoura.

const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  assessmentFindFirst: vi.fn(),
  assessmentUpdateMany: vi.fn(),
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
      meridianAssessment: {
        findFirst: h.assessmentFindFirst,
        updateMany: h.assessmentUpdateMany,
      },
      auditLog: { create: h.auditCreate },
    }),
}));

import { reopenAssessment } from "@/app/(meridian)/actions/reopen";

const CTX = {
  tenantId: "t1",
  userId: "u1",
  role: "ADMIN",
  meridianRole: "CONSULTANT",
  user: { name: "Marina", email: "m@x.com" },
};
const AS_ID = "clx0000000000000000000as1";
const REASON = "Pontuação de Dados lançada no eixo errado — corrigir.";

beforeEach(() => {
  vi.clearAllMocks();
  h.requirePerm.mockResolvedValue(CTX);
  h.assessmentFindFirst.mockResolvedValue({
    id: AS_ID,
    code: "AS-104",
    orgName: "Vanta Saúde",
    status: "FINALISED",
  });
  h.assessmentUpdateMany.mockResolvedValue({ count: 1 });
  h.auditCreate.mockResolvedValue({});
});

describe("reopenAssessment", () => {
  it("FINALISED volta a REVIEW (nunca a COLLECTING) e audita com o motivo", async () => {
    const res = await reopenAssessment({ assessmentId: AS_ID, reason: REASON });
    expect(res.ok).toBe(true);
    expect(h.assessmentUpdateMany.mock.calls[0][0].data).toEqual({
      status: "REVIEW",
    });
    const audit = h.auditCreate.mock.calls[0][0].data;
    expect(audit).toMatchObject({
      tenantId: "t1",
      userId: "u1",
      action: "meridian.assessment.reopen",
      entityType: "meridian.assessment",
      entityId: AS_ID,
      diff: [["Status", "FINALISED", "REVIEW"]],
    });
    expect(audit.metadata.note).toBe(REASON);
    expect(audit.metadata.target).toBe("AS-104 · Vanta Saúde");
  });

  it("só o consultor: exige assessment.manage e nem toca no banco sem a permissão", async () => {
    h.requirePerm.mockRejectedValue(new Error("Requer papel Consultor"));
    const res = await reopenAssessment({ assessmentId: AS_ID, reason: REASON });
    expect(res.ok).toBe(false);
    expect(h.requirePerm).toHaveBeenCalledWith("assessment.manage");
    expect(h.assessmentFindFirst).not.toHaveBeenCalled();
    expect(h.assessmentUpdateMany).not.toHaveBeenCalled();
  });

  it.each([
    "",
    "   ",
    "curto demais",
    "x".repeat(19),
  ])("motivo %j (menos de 20 caracteres) é recusado antes de qualquer leitura", async (reason) => {
    const res = await reopenAssessment({ assessmentId: AS_ID, reason });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.code).toBe("reopen.reason");
    expect(h.assessmentFindFirst).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("motivo com exatamente 20 caracteres (depois do trim) passa", async () => {
    const res = await reopenAssessment({
      assessmentId: AS_ID,
      reason: `  ${"x".repeat(20)}  `,
    });
    expect(res.ok).toBe(true);
    expect(h.auditCreate.mock.calls[0][0].data.metadata.note).toBe(
      "x".repeat(20)
    );
  });

  it.each([
    "DRAFT",
    "COLLECTING",
    "REVIEW",
  ])("%s não reabre: só se reabre o que está finalizado", async (status) => {
    h.assessmentFindFirst.mockResolvedValue({
      id: AS_ID,
      code: "AS-104",
      orgName: "Vanta Saúde",
      status,
    });
    const res = await reopenAssessment({
      assessmentId: AS_ID,
      reason: REASON,
    });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.code).toBe("reopen.not-finalised");
    expect(h.assessmentUpdateMany).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("filtra por tenant e atualiza só se ainda está FINALISED (corrida)", async () => {
    await reopenAssessment({ assessmentId: AS_ID, reason: REASON });
    expect(h.assessmentFindFirst.mock.calls[0][0].where).toEqual({
      id: AS_ID,
      tenantId: "t1",
    });
    expect(h.assessmentUpdateMany.mock.calls[0][0].where).toEqual({
      id: AS_ID,
      tenantId: "t1",
      status: "FINALISED",
    });
    h.assessmentUpdateMany.mockResolvedValue({ count: 0 });
    const res = await reopenAssessment({ assessmentId: AS_ID, reason: REASON });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.code).toBe("reopen.state-changed");
  });

  it("assessment de outro tenant: não encontrado, nada gravado", async () => {
    h.assessmentFindFirst.mockResolvedValue(null);
    const res = await reopenAssessment({ assessmentId: AS_ID, reason: REASON });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.code).toBe("assessment.not-found");
    expect(h.assessmentUpdateMany).not.toHaveBeenCalled();
  });

  it("só o status muda: nenhuma outra tabela é tocada (baseline assinado, scores, gaps, plano)", async () => {
    // O db de mentira só tem meridianAssessment e auditLog: tocar em qualquer
    // outra tabela estoura e a action devolveria ok:false.
    const res = await reopenAssessment({ assessmentId: AS_ID, reason: REASON });
    expect(res.ok).toBe(true);
    expect(h.assessmentUpdateMany.mock.calls[0][0].data).toEqual({
      status: "REVIEW",
    });
  });
});
