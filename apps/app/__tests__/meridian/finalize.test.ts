import { beforeEach, describe, expect, it, vi } from "vitest";

// Finalizar assessment (decisão do Norte, 30/09): o Meridian ganha a transição
// REVIEW → FINALISED. Só CONSULTANT (`assessment.manage`); pré-condições:
// scoring feito nos cinco eixos e nenhum eixo contestado pendente (fecha o
// SC-004); auditoria; efeito: o diagnóstico passa a valer como final e os gaps
// ranqueados (X-03, que só lê FINALISED) deixam de vir vazios.

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

import { finalizeAssessment } from "@/app/(meridian)/actions/finalize";

const CTX = {
  tenantId: "t1",
  userId: "u1",
  role: "ADMIN",
  meridianRole: "CONSULTANT",
  user: { name: "Marina", email: "m@x.com" },
};
const AS_ID = "clx0000000000000000000as1";

const AXES5 = ["DATA", "PROCESS", "PEOPLE", "GOVERNANCE", "INFRASTRUCTURE"];
const scores = (overrides: Record<string, string> = {}) =>
  AXES5.map((axis) => ({ axis, status: overrides[axis] ?? "COMPUTED" }));

const assessment = (over: Record<string, unknown> = {}) => ({
  id: AS_ID,
  code: "AS-104",
  orgName: "Vanta Saúde",
  status: "REVIEW",
  scores: scores(),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.requirePerm.mockResolvedValue(CTX);
  h.assessmentFindFirst.mockResolvedValue(assessment());
  h.assessmentUpdateMany.mockResolvedValue({ count: 1 });
  h.auditCreate.mockResolvedValue({});
});

describe("finalizeAssessment", () => {
  it("em revisão, com scoring nos cinco eixos e nada contestado: vira FINALISED e audita", async () => {
    const res = await finalizeAssessment({ assessmentId: AS_ID });
    expect(res.ok).toBe(true);
    const call = h.assessmentUpdateMany.mock.calls[0][0];
    expect(call.data).toEqual({ status: "FINALISED" });
    const audit = h.auditCreate.mock.calls[0][0].data;
    expect(audit).toMatchObject({
      tenantId: "t1",
      userId: "u1",
      action: "meridian.assessment.finalise",
      entityType: "meridian.assessment",
      entityId: AS_ID,
      diff: [["Status", "REVIEW", "FINALISED"]],
    });
    expect(audit.metadata.target).toBe("AS-104 · Vanta Saúde");
  });

  it("exige assessment.manage (só o consultor) e nem toca no banco sem a permissão", async () => {
    h.requirePerm.mockRejectedValue(new Error("Requer papel Consultor"));
    const res = await finalizeAssessment({ assessmentId: AS_ID });
    expect(res.ok).toBe(false);
    expect(h.requirePerm).toHaveBeenCalledWith("assessment.manage");
    expect(h.assessmentFindFirst).not.toHaveBeenCalled();
    expect(h.assessmentUpdateMany).not.toHaveBeenCalled();
  });

  it("filtra por tenant da sessão e atualiza só se ainda está em REVIEW", async () => {
    await finalizeAssessment({ assessmentId: AS_ID });
    expect(h.assessmentFindFirst.mock.calls[0][0].where).toEqual({
      id: AS_ID,
      tenantId: "t1",
    });
    expect(h.assessmentUpdateMany.mock.calls[0][0].where).toEqual({
      id: AS_ID,
      tenantId: "t1",
      status: "REVIEW",
    });
  });

  it("assessment de outro tenant: não encontrado, nada gravado", async () => {
    h.assessmentFindFirst.mockResolvedValue(null);
    const res = await finalizeAssessment({ assessmentId: AS_ID });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.code).toBe("assessment.not-found");
    expect(h.assessmentUpdateMany).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it.each([
    "DRAFT",
    "COLLECTING",
  ])("%s não finaliza: a coleta ainda não foi fechada", async (status) => {
    h.assessmentFindFirst.mockResolvedValue(assessment({ status }));
    const res = await finalizeAssessment({ assessmentId: AS_ID });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.code).toBe("finalize.not-in-review");
    expect(h.assessmentUpdateMany).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("já finalizado: recusa sem regravar nem auditar de novo", async () => {
    h.assessmentFindFirst.mockResolvedValue(
      assessment({ status: "FINALISED" })
    );
    const res = await finalizeAssessment({ assessmentId: AS_ID });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.code).toBe("finalize.already-finalised");
    expect(h.assessmentUpdateMany).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("scoring incompleto (menos de cinco eixos com score): recusa", async () => {
    h.assessmentFindFirst.mockResolvedValue(
      assessment({ scores: scores().slice(0, 3) })
    );
    const res = await finalizeAssessment({ assessmentId: AS_ID });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.code).toBe("finalize.scoring-missing");
    expect(h.assessmentUpdateMany).not.toHaveBeenCalled();
  });

  it("eixo contestado pendente: recusa e nomeia os eixos (fila de revisão não vazia, SC-004)", async () => {
    h.assessmentFindFirst.mockResolvedValue(
      assessment({ scores: scores({ DATA: "CONTESTED", PEOPLE: "CONTESTED" }) })
    );
    const res = await finalizeAssessment({ assessmentId: AS_ID });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.code).toBe("finalize.contested-pending");
    expect(h.assessmentUpdateMany).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("eixo sobrescrito (OVERRIDDEN) já foi decidido e não bloqueia", async () => {
    h.assessmentFindFirst.mockResolvedValue(
      assessment({ scores: scores({ DATA: "OVERRIDDEN" }) })
    );
    const res = await finalizeAssessment({ assessmentId: AS_ID });
    expect(res.ok).toBe(true);
  });

  it("corrida: se o status mudou entre a leitura e a escrita, recusa e não audita", async () => {
    h.assessmentUpdateMany.mockResolvedValue({ count: 0 });
    const res = await finalizeAssessment({ assessmentId: AS_ID });
    expect(res.ok).toBe(false);
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("id que não é cuid é recusado antes de qualquer leitura", async () => {
    const res = await finalizeAssessment({ assessmentId: "x" });
    expect(res.ok).toBe(false);
    expect(h.assessmentFindFirst).not.toHaveBeenCalled();
  });
});
