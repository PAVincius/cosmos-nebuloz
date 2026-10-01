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
  responseFindMany: vi.fn(),
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
      meridianResponse: { findMany: h.responseFindMany },
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
  h.responseFindMany.mockResolvedValue([]);
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

  // Faixas e arquétipo (briefing do Andaime): o relatório carrega o perfil de
  // prontidão calculado a partir dos scores finais e da confiança.
  it("traz o perfil de prontidão: faixas por eixo e arquétipo (caso Atlas)", async () => {
    const atlas = [
      ["DATA", 32, 0.72],
      ["PROCESS", 58, 0.65],
      ["PEOPLE", 47, 0.55],
      ["GOVERNANCE", 41, 0.61],
      ["INFRASTRUCTURE", 36, 0.8],
    ] as const;
    h.assessmentFindFirst.mockResolvedValue({
      ...base,
      overrides: [],
      scores: atlas.map(([axis, final, confidence]) => ({
        axis,
        computed: final,
        final: null,
        confidence,
        status: "CONFIRMED",
      })),
    });
    const res = await getReport({ assessmentId: AS_ID });
    const r = res.ok ? res.data.readiness : null;
    expect(r?.dominant).toBe("PILOT_NO_GROUND");
    expect(r?.secondary).toBe("ISOLATED_CHAMPION");
    expect(r?.unreliableAxes).toEqual(["PEOPLE"]);
    expect(r?.axes.map((a) => a.display)).toEqual([
      "Inicial",
      "Em formação",
      "Em formação",
      "Em formação",
      "Inicial",
    ]);
    expect(r?.axes.map((a) => a.unreliableMark)).toEqual([
      null,
      null,
      "Não confiável",
      null,
      null,
    ]);
  });

  // Sinais de pergunta (decisões do Norte): o relatório alimenta Campeão
  // isolado (Q-E03) e Governança de papel (Q-G01/G02/G03) com o normalizado
  // das respostas do assessment.
  const scoresMistos = [
    "DATA",
    "PROCESS",
    "PEOPLE",
    "GOVERNANCE",
    "INFRASTRUCTURE",
  ].map((axis) => ({
    axis,
    computed: 50,
    final: null,
    confidence: 0.9,
    status: "CONFIRMED",
  }));

  it("Q-E03 baixa nas respostas faz o relatório apontar Campeão isolado", async () => {
    h.assessmentFindFirst.mockResolvedValue({
      ...base,
      overrides: [],
      scores: scoresMistos,
    });
    h.responseFindMany.mockResolvedValue([
      { normalized: "0.250", question: { code: "Q-E03" } },
      { normalized: "0.250", question: { code: "Q-E03" } },
    ]);
    const res = await getReport({ assessmentId: AS_ID });
    expect(res.ok && res.data.readiness.dominant).toBe("ISOLATED_CHAMPION");
  });

  it("Q-G01 alta, Q-G02 e Q-G03 baixas: Governança de papel", async () => {
    h.assessmentFindFirst.mockResolvedValue({
      ...base,
      overrides: [],
      scores: scoresMistos,
    });
    h.responseFindMany.mockResolvedValue([
      { normalized: "1.000", question: { code: "Q-G01" } },
      { normalized: "0.000", question: { code: "Q-G02" } },
      { normalized: "0.250", question: { code: "Q-G03" } },
    ]);
    const res = await getReport({ assessmentId: AS_ID });
    expect(res.ok && res.data.readiness.dominant).toBe("PAPER_GOVERNANCE");
  });

  it("busca só as respostas do assessment, do tenant da sessão e dos códigos dos sinais", async () => {
    await getReport({ assessmentId: AS_ID });
    const where = h.responseFindMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe("t1");
    expect(where.respondent).toEqual({ assessmentId: AS_ID });
    expect(where.question.code.in.sort()).toEqual([
      "Q-E03",
      "Q-G01",
      "Q-G02",
      "Q-G03",
    ]);
  });

  it("template sem esses códigos (nenhuma resposta): o relatório sai normal, sem arquétipo de pergunta", async () => {
    h.assessmentFindFirst.mockResolvedValue({
      ...base,
      overrides: [],
      scores: scoresMistos,
    });
    h.responseFindMany.mockResolvedValue([]);
    const res = await getReport({ assessmentId: AS_ID });
    expect(res.ok).toBe(true);
    expect(res.ok && res.data.readiness.dominant).toBeNull();
  });

  it("usa o score final (com override), não o computado, na faixa", async () => {
    const res = await getReport({ assessmentId: AS_ID });
    // base: GOVERNANCE computado 74, final 66 → Estruturado em ambos; a
    // conferência é que o valor usado é o final.
    const gov = res.ok
      ? res.data.readiness.axes.find((a) => a.axis === "GOVERNANCE")
      : null;
    expect(gov?.score).toBe(66);
  });

  it("com menos de cinco eixos pontuados: faixas dos que existem, sem arquétipo", async () => {
    const res = await getReport({ assessmentId: AS_ID });
    expect(res.ok && res.data.readiness.axes).toHaveLength(1);
    expect(res.ok && res.data.readiness.dominant).toBeNull();
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
