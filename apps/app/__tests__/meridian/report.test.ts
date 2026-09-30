import { beforeEach, describe, expect, it, vi } from "vitest";

// Relatório e evidência — FR-035/FR-037.
//
// Duas regras: o diff só existe em reavaliação, e a trilha do acesso à
// evidência é gravada ANTES de a URL sair. Auditoria de acesso concedido, não
// de byte entregue.

const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  assessmentFindFirst: vi.fn(),
  auditFindMany: vi.fn(),
  auditCreate: vi.fn(),
  cohortFindUnique: vi.fn(),
  evidenceFindFirst: vi.fn(),
  createSignedUrl: vi.fn(),
  enablementFindUnique: vi.fn(),
}));

vi.mock("@/lib/meridian/guards", () => ({
  requireMeridianPermissionContext: h.requirePerm,
  requireMeridianContext: h.requirePerm,
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
  MERIDIAN_EVIDENCE_BUCKET: "meridian-evidence",
  storageClient: {
    storage: { from: () => ({ createSignedUrl: h.createSignedUrl }) },
  },
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      meridianAssessment: { findFirst: h.assessmentFindFirst },
      meridianEvidence: { findFirst: h.evidenceFindFirst },
      auditLog: { findMany: h.auditFindMany, create: h.auditCreate },
      meridianBenchmarkEnablement: { findUnique: h.enablementFindUnique },
    }),
  database: {
    meridianBenchmarkCohort: { findUnique: h.cohortFindUnique },
  },
}));

import {
  getReassessmentDiff,
  getReport,
  requestEvidenceUrl,
} from "@/app/(meridian)/actions/report";

const CTX = {
  tenantId: "t1",
  userId: "u1",
  role: "ADMIN",
  meridianRole: "CONSULTANT",
  user: { name: "Marina", email: "m@x.com" },
};
const AS_ID = "clx0000000000000000000as1";

const BANDS = {
  DATA: { p25: 38, p50: 52, p75: 64 },
  PROCESS: { p25: 44, p50: 55, p75: 68 },
  PEOPLE: { p25: 30, p50: 42, p75: 55 },
  GOVERNANCE: { p25: 41, p50: 57, p75: 71 },
  INFRASTRUCTURE: { p25: 40, p50: 53, p75: 66 },
};

const base = {
  id: AS_ID,
  code: "AS-104",
  orgName: "Vanta Saúde",
  sector: "Saúde",
  sizeBand: "200–1.000",
  reassessmentOfId: null,
  template: { version: "v3.2" },
  scores: [
    {
      axis: "GOVERNANCE",
      computed: 74,
      final: 66,
      confidence: 0.91,
      status: "OVERRIDDEN",
    },
  ],
  overrides: [
    {
      id: "ov1",
      axis: "GOVERNANCE",
      rationale: "Política sem ciclo real de enforcement.",
    },
  ],
  gaps: [
    {
      code: "G-01",
      statement: "Sem catálogo unificado.",
      severity: "HIGH",
      costOfDelay: 88,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.requirePerm.mockResolvedValue(CTX);
  h.assessmentFindFirst.mockResolvedValue(base);
  h.auditFindMany.mockResolvedValue([]);
  h.auditCreate.mockResolvedValue({});
  h.cohortFindUnique.mockResolvedValue(null);
  h.enablementFindUnique.mockResolvedValue({ enabled: true });
  h.createSignedUrl.mockResolvedValue({
    data: { signedUrl: "https://x/y" },
    error: null,
  });
});

describe("getReport", () => {
  it("marca o eixo sobrescrito e traz a justificativa junto", async () => {
    const res = await getReport({ assessmentId: AS_ID });
    expect(res.ok).toBe(true);
    const axis = res.ok ? res.data.axes[0] : null;
    expect(axis?.overridden).toBe(true);
    expect(axis?.score).toBe(66);
    expect(axis?.computed).toBe(74);
    expect(axis?.rationale).toMatch(/enforcement/);
  });

  it("retém a coorte inexistente sem inventar comparação", async () => {
    const res = await getReport({ assessmentId: AS_ID });
    expect(res.ok && res.data.cohort?.withheld).toBe(true);
    expect(JSON.stringify(res)).not.toContain("p50");
  });

  it("libera a coorte acima do mínimo", async () => {
    h.cohortFindUnique.mockResolvedValue({
      cohortKey: "saude · 200–1.000",
      n: 11,
      percentiles: BANDS,
    });
    const res = await getReport({ assessmentId: AS_ID });
    expect(res.ok && res.data.cohort?.withheld).toBe(false);
  });

  // Benchmark travado por tenant, lado da leitura (specs/012, decisão do CEO de
  // 29/09): sem habilitação o tenant também não lê — o bloco some do relatório.
  it("habilitação desligada: o relatório vem sem o bloco de benchmark", async () => {
    h.enablementFindUnique.mockResolvedValue({ enabled: false });
    h.cohortFindUnique.mockResolvedValue({
      cohortKey: "saude · 200–1.000",
      n: 11,
      percentiles: BANDS,
    });
    const res = await getReport({ assessmentId: AS_ID });
    expect(res.ok && res.data.cohort).toBeNull();
    expect(h.cohortFindUnique).not.toHaveBeenCalled();
    expect(JSON.stringify(res)).not.toMatch(/p50|saude · 200/);
    expect(res.ok && res.data.axes).toHaveLength(1);
  });

  it("tenant sem linha de habilitação: também sem o bloco", async () => {
    h.enablementFindUnique.mockResolvedValue(null);
    const res = await getReport({ assessmentId: AS_ID });
    expect(res.ok && res.data.cohort).toBeNull();
    expect(h.cohortFindUnique).not.toHaveBeenCalled();
  });

  it("tenant interno com a habilitação ligada lê normal", async () => {
    h.requirePerm.mockResolvedValue({ ...CTX, tenantId: "nebuloz-interno" });
    h.enablementFindUnique.mockResolvedValue({ enabled: true });
    h.cohortFindUnique.mockResolvedValue({
      cohortKey: "saude · 200–1.000",
      n: 11,
      percentiles: BANDS,
    });
    const res = await getReport({ assessmentId: AS_ID });
    expect(res.ok && res.data.cohort?.withheld).toBe(false);
    expect(h.enablementFindUnique.mock.calls[0][0].where).toEqual({
      tenantId: "nebuloz-interno",
    });
  });

  it("exige permissão de leitura de relatório", async () => {
    h.requirePerm.mockRejectedValue(new Error("Requer papel Leitor"));
    const res = await getReport({ assessmentId: AS_ID });
    expect(res.ok).toBe(false);
  });
});

describe("getReassessmentDiff", () => {
  it("recusa quando o assessment não é reavaliação", async () => {
    h.assessmentFindFirst.mockResolvedValue({
      ...base,
      reassessmentOf: null,
      template: { version: "v3.2" },
      gaps: [],
    });
    const res = await getReassessmentDiff({ assessmentId: AS_ID });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/re-assessment|reavaliação/i);
  });

  it("compara eixo a eixo e sinaliza mudança de versão de template", async () => {
    h.assessmentFindFirst.mockResolvedValue({
      ...base,
      template: { version: "v3.2" },
      gaps: [{ code: "G-01", statement: "Sem catálogo.", state: "OPEN" }],
      reassessmentOf: {
        code: "AS-092",
        closedAt: new Date("2025-12-12"),
        template: { version: "v3.1" },
        scores: [
          {
            axis: "GOVERNANCE",
            computed: 58,
            final: null,
          },
        ],
        gaps: [
          { code: "G-09", statement: "Backups sem teste.", state: "RESOLVED" },
          { code: "G-01", statement: "Sem catálogo.", state: "OPEN" },
        ],
        planItems: [],
      },
    });
    const res = await getReassessmentDiff({ assessmentId: AS_ID });
    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.templateChanged).toBe(true);
    expect(res.data.axes[0]).toMatchObject({
      axis: "GOVERNANCE",
      was: 58,
      now: 66,
      delta: 8,
    });
    expect(res.data.resolved.map((r) => r.code)).toEqual(["G-09"]);
    expect(res.data.persisting).toEqual(["G-01"]);
  });
});

describe("requestEvidenceUrl", () => {
  const EV_ID = "clx000000000000000000ev01";

  beforeEach(() => {
    h.evidenceFindFirst.mockResolvedValue({
      id: EV_ID,
      storagePath: "t1/a1/ev01",
      fileName: "catalogo.xlsx",
      assessment: { code: "AS-104" },
    });
  });

  it("grava a trilha ANTES de emitir a URL", async () => {
    const order: string[] = [];
    h.auditCreate.mockImplementation(() => {
      order.push("audit");
      return Promise.resolve({});
    });
    h.createSignedUrl.mockImplementation(() => {
      order.push("url");
      return Promise.resolve({
        data: { signedUrl: "https://x/y" },
        error: null,
      });
    });
    const res = await requestEvidenceUrl({ evidenceId: EV_ID });
    expect(res.ok).toBe(true);
    expect(order).toEqual(["audit", "url"]);
  });

  it("registra a leitura como meridian.evidence.read", async () => {
    await requestEvidenceUrl({ evidenceId: EV_ID });
    const audit = h.auditCreate.mock.calls[0]?.[0] as {
      data: { action: string; entityType: string };
    };
    expect(audit.data.action).toBe("meridian.evidence.read");
    expect(audit.data.entityType).toBe("meridian.evidence");
  });

  it("target do audit não carrega fileName (dado pessoal em log de vida longa, achado da Morgana)", async () => {
    await requestEvidenceUrl({ evidenceId: EV_ID });
    const audit = h.auditCreate.mock.calls[0]?.[0] as {
      data: { metadata: { target: string } };
    };
    expect(audit.data.metadata.target).not.toContain("catalogo.xlsx");
    expect(audit.data.metadata.target).toBe(`AS-104 · ${EV_ID}`);
  });

  it("cada abertura grava exatamente 1 linha na trilha — a tela 'Ver evidência' chama isto por clique", async () => {
    const res = await requestEvidenceUrl({ evidenceId: EV_ID });
    expect(res.ok).toBe(true);
    expect(h.auditCreate).toHaveBeenCalledTimes(1);

    // Duas aberturas separadas do mesmo arquivo não deduplicam — são dois
    // acessos, duas linhas. Auditoria de acesso concedido, não de arquivo.
    await requestEvidenceUrl({ evidenceId: EV_ID });
    expect(h.auditCreate).toHaveBeenCalledTimes(2);
  });

  it("recusa evidência de outra organização", async () => {
    h.evidenceFindFirst.mockResolvedValue(null);
    const res = await requestEvidenceUrl({ evidenceId: EV_ID });
    expect(res.ok).toBe(false);
    expect(h.createSignedUrl).not.toHaveBeenCalled();
  });

  it("recusa evidência eliminada pela retenção de 90 dias, sem tentar assinar URL nem gravar audit falso", async () => {
    h.evidenceFindFirst.mockResolvedValue({
      id: EV_ID,
      storagePath: "eliminado-por-retencao",
      fileName: "catalogo.xlsx",
      assessment: { code: "AS-104" },
    });
    const res = await requestEvidenceUrl({ evidenceId: EV_ID });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toMatch(/retenção/);
    expect(h.createSignedUrl).not.toHaveBeenCalled();
    // A checagem de retenção roda ANTES do audit — sem isso, o log dizia
    // "URL assinada emitida para download" pra uma evidência que não existe
    // mais (achado P3 da Morgana).
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("exige permissão de leitura de evidência", async () => {
    h.requirePerm.mockRejectedValue(new Error("Requer papel Consultor"));
    const res = await requestEvidenceUrl({ evidenceId: EV_ID });
    expect(res.ok).toBe(false);
    expect(h.auditCreate).not.toHaveBeenCalled();
  });
});
