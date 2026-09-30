import { beforeEach, describe, expect, it, vi } from "vitest";

// A3 — listagem de evidências para Coleta e gap (specs/010-evidencia-coleta-gap).
// A lista só sai do servidor para quem tem `evidence.read`; quem não tem recebe
// o total e nenhuma linha, então a tela não tem o que mostrar (FR-006).

const h = vi.hoisted(() => ({
  requireCtx: vi.fn(),
  requirePerm: vi.fn(),
  assessmentFindFirst: vi.fn(),
  evidenceFindMany: vi.fn(),
  evidenceFindFirst: vi.fn(),
  auditCreate: vi.fn(),
  createSignedUrl: vi.fn(),
}));

vi.mock("@/lib/meridian/guards", () => ({
  requireMeridianContext: h.requireCtx,
  requireMeridianPermissionContext: h.requirePerm,
  MeridianRuleError: class extends Error {
    rule: string;
    constructor(rule: string, message: string) {
      super(message);
      this.rule = rule;
    }
  },
}));
vi.mock("@repo/storage", () => ({
  MERIDIAN_EVIDENCE_BUCKET: "meridian-evidence",
  storageClient: {
    storage: { from: () => ({ createSignedUrl: h.createSignedUrl }) },
  },
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      meridianAssessment: { findFirst: h.assessmentFindFirst },
      meridianEvidence: {
        findMany: h.evidenceFindMany,
        findFirst: h.evidenceFindFirst,
      },
      auditLog: { create: h.auditCreate },
    }),
  database: {},
}));

import {
  listAssessmentEvidence,
  requestEvidenceUrl,
} from "@/app/(meridian)/actions/report";

const AS_ID = "clx0000000000000000000as1";
const EV_ID = "clx0000000000000000000ev1";
const ctxOf = (meridianRole: string) => ({
  tenantId: "t1",
  userId: "u1",
  role: "ADMIN",
  meridianRole,
  user: { name: "Marina", email: "m@x.com" },
});

const rows = [
  {
    id: "ev-1",
    fileName: "politica-dados.pdf",
    storagePath: "t1/as1/uuid-1",
  },
  {
    id: "ev-2",
    fileName: "contrato.pdf",
    storagePath: "eliminado-por-retencao",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  h.assessmentFindFirst.mockResolvedValue({ id: AS_ID });
  h.evidenceFindMany.mockResolvedValue(rows);
});

describe("listAssessmentEvidence", () => {
  it("consultor recebe cada evidência com rótulo e estado de retenção", async () => {
    h.requireCtx.mockResolvedValue(ctxOf("CONSULTANT"));
    const res = await listAssessmentEvidence({ assessmentId: AS_ID });
    expect(res.ok && res.data).toEqual({
      total: 2,
      items: [
        { id: "ev-1", label: "politica-dados.pdf", eliminated: false },
        { id: "ev-2", label: "contrato.pdf", eliminated: true },
      ],
    });
  });

  it("revisor também recebe a lista", async () => {
    h.requireCtx.mockResolvedValue(ctxOf("REVIEWER"));
    const res = await listAssessmentEvidence({ assessmentId: AS_ID });
    expect(res.ok && res.data.items).toHaveLength(2);
  });

  it("papel sem evidence.read recebe só o total, sem nome nem id", async () => {
    h.requireCtx.mockResolvedValue(ctxOf("VIEWER"));
    const res = await listAssessmentEvidence({ assessmentId: AS_ID });
    expect(res.ok && res.data).toEqual({ total: 2, items: [] });
    expect(JSON.stringify(res)).not.toMatch(/politica-dados|ev-1/);
  });

  it("filtra por tenant e assessment, e nunca devolve o storagePath", async () => {
    h.requireCtx.mockResolvedValue(ctxOf("CONSULTANT"));
    const res = await listAssessmentEvidence({ assessmentId: AS_ID });
    expect(h.evidenceFindMany.mock.calls[0][0].where).toEqual({
      tenantId: "t1",
      assessmentId: AS_ID,
    });
    expect(JSON.stringify(res)).not.toMatch(/uuid-1|storagePath/);
  });

  it("listar não grava trilha — só a leitura do arquivo grava", async () => {
    h.requireCtx.mockResolvedValue(ctxOf("CONSULTANT"));
    await listAssessmentEvidence({ assessmentId: AS_ID });
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("assessment de outro tenant: erro, sem listar evidência", async () => {
    h.requireCtx.mockResolvedValue(ctxOf("CONSULTANT"));
    h.assessmentFindFirst.mockResolvedValue(null);
    const res = await listAssessmentEvidence({ assessmentId: AS_ID });
    expect(res.ok).toBe(false);
    expect(h.evidenceFindMany).not.toHaveBeenCalled();
  });
});

describe("requestEvidenceUrl sem permissão (FR-007)", () => {
  it("recusa antes de tocar no banco, na trilha ou no bucket", async () => {
    h.requirePerm.mockRejectedValue(new Error("FORBIDDEN"));
    const res = await requestEvidenceUrl({ evidenceId: EV_ID });
    expect(res.ok).toBe(false);
    expect(h.requirePerm).toHaveBeenCalledWith("evidence.read");
    expect(h.evidenceFindFirst).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
    expect(h.createSignedUrl).not.toHaveBeenCalled();
  });
});
