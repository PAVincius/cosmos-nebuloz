import { beforeEach, describe, expect, it, vi } from "vitest";

// Relatórios — US6.
//
// O que estes testes protegem: que o relatório congelado pare no tempo. Se o
// `payload` fosse recomposto na exportação, reversionar uma fórmula mudaria
// silenciosamente o documento que o comitê já leu — e ninguém perceberia até
// duas cópias impressas da mesma reunião discordarem.

const h = vi.hoisted(() => ({
  requireSignalPermissionContext: vi.fn(),
  withTenantDb: vi.fn(),
  nextCode: vi.fn(),
  logSignalAudit: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@repo/database", () => ({
  withTenantDb: h.withTenantDb,
  Prisma: {},
}));
vi.mock("@/lib/signal/guards", async () => {
  const errors = await vi.importActual<typeof import("@/lib/signal/errors")>(
    "../../../lib/signal/errors"
  );
  return {
    ...errors,
    requireSignalPermissionContext: h.requireSignalPermissionContext,
  };
});
vi.mock("@/app/(signal)/actions/_shared", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/(signal)/actions/_shared")
  >("../../../app/(signal)/actions/_shared");
  return {
    ...actual,
    nextCode: h.nextCode,
    logSignalAudit: h.logSignalAudit,
  };
});

import {
  draftReport,
  exportReport,
  freezeReport,
} from "@/app/(signal)/actions/reports";

const CTX = {
  tenantId: "tnt_1",
  userId: "usr_1",
  signalRole: "ADMIN",
  user: { id: "usr_1", name: "Marina", email: "m@vanta.test" },
};

type Db = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
let db: Db;

const report = (over: Record<string, unknown> = {}) => ({
  id: "rp_1",
  code: "RP-118",
  name: "Fechamento do 2º semestre",
  kind: "EXECUTIVE",
  state: "DRAFT",
  periodLabel: "H2 2026",
  periodStart: new Date("2026-07-01"),
  periodEnd: new Date("2026-12-31"),
  payload: null,
  pageCount: null,
  blockedReason: null,
  ...over,
});

const initiative = (over: Record<string, unknown> = {}) => ({
  id: "in_1",
  code: "IN-014",
  name: "Copiloto de atendimento",
  businessUnit: "Atendimento",
  category: "COPILOT",
  status: "ACTIVE",
  owner: { name: "Rafael", email: "r@vanta.test" },
  adoption: [
    {
      periodStart: new Date("2026-08-01"),
      periodEnd: new Date("2026-08-31"),
      activeUsers: 72,
      licensedUsers: 100,
    },
  ],
  outcomes: [],
  roiFormulas: [
    {
      version: 3,
      entries: [
        {
          kind: "COST",
          label: "Licenças",
          total: "100000",
          sourceLabel: "Contrato Vanta",
        },
        {
          kind: "RETURN",
          label: "Horas poupadas",
          total: "230000",
          sourceLabel: "Zendesk",
        },
      ],
    },
  ],
  confidenceScores: [
    {
      got: 25,
      note: null,
      rule: { key: "baseline", label: "Baseline assinada", weight: 25 },
    },
    {
      got: 60,
      note: null,
      rule: { key: "fonte", label: "Fonte automática", weight: 75 },
    },
  ],
  observations: [
    {
      code: "EV-8841",
      metricLabel: "Tempo médio de resposta",
      value: "4,2 min",
      unit: "min",
      windowStart: new Date("2026-08-01"),
      windowEnd: new Date("2026-08-31"),
      connectionLabel: "Zendesk",
      transform: "média(first_reply_seconds) / 60",
      flag: null,
    },
  ],
  ...over,
});

const connection = (over: Record<string, unknown> = {}) => ({
  code: "CN-02",
  name: "Zendesk",
  health: "HEALTHY",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.requireSignalPermissionContext.mockResolvedValue(CTX);
  h.nextCode.mockResolvedValue("RP-119");

  db = {
    tenant: { findUnique: vi.fn().mockResolvedValue({ name: "Vanta" }) },
    signalSettings: {
      findUnique: vi.fn().mockResolvedValue({
        adoptionBar: 60,
        valueBar: "1.5",
        currency: "BRL",
      }),
    },
    signalInitiative: {
      findMany: vi.fn().mockResolvedValue([initiative()]),
    },
    signalConnection: {
      findMany: vi.fn().mockResolvedValue([connection()]),
    },
    signalReportSnapshot: {
      findUnique: vi.fn().mockResolvedValue(report()),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "rp_2" }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  h.withTenantDb.mockImplementation(
    (_tenantId: string, fn: (d: Db) => unknown) => fn(db)
  );
});

describe("freezeReport — fonte caída trava o fechamento", () => {
  it("recusa com 409 e lista o que reconectar", async () => {
    db.signalConnection.findMany.mockResolvedValue([
      connection({ health: "DOWN" }),
    ]);

    const res = await freezeReport({ code: "RP-118" });

    expect(res.ok).toBe(false);
    if (res.ok) {
      throw new Error("deveria ter recusado");
    }
    expect(res.rule).toBe("report.sources.down");
    expect(res.status).toBe(409);
    expect(res.blockers?.[0]).toContain("CN-02");
  });

  it("grava a razão no rascunho para quem abrir amanhã entender", async () => {
    db.signalConnection.findMany.mockResolvedValue([
      connection({ health: "DOWN" }),
    ]);

    await freezeReport({ code: "RP-118" });

    const data = db.signalReportSnapshot.update.mock.calls[0][0].data;
    expect(data.blockedReason).toContain("fora do ar");
    // Com a lista: amanhã ninguém precisa tentar de novo para saber qual.
    expect(data.blockedReason).toContain("CN-02");
    expect(data.state).toBeUndefined();
  });

  it("não trava por fonte caída que nenhum número cita", async () => {
    db.signalConnection.findMany.mockResolvedValue([
      connection(),
      connection({ code: "CN-09", name: "Planilha antiga", health: "DOWN" }),
    ]);

    const res = await freezeReport({ code: "RP-118" });

    expect(res.ok).toBe(true);
  });

  it("fonte apenas atrasada não trava — vira ressalva, não bloqueio", async () => {
    db.signalConnection.findMany.mockResolvedValue([
      connection({ health: "STALE" }),
    ]);

    const res = await freezeReport({ code: "RP-118" });

    expect(res.ok).toBe(true);
    const payload = db.signalReportSnapshot.update.mock.calls[0][0].data
      .payload as { caveats: string[] };
    expect(payload.caveats.join(" ")).toContain("fora do ar no fechamento");
  });
});

describe("freezeReport — o que fica gravado", () => {
  it("congela o payload e marca FINAL", async () => {
    const res = await freezeReport({ code: "RP-118" });

    expect(res.ok).toBe(true);
    const data = db.signalReportSnapshot.update.mock.calls[0][0].data;
    expect(data.state).toBe("FINAL");
    expect(data.generatedById).toBe("usr_1");
    expect(data.pageCount).toBeGreaterThan(0);
  });

  it("toda linha com ROI carrega versão da fórmula e confiança", async () => {
    await freezeReport({ code: "RP-118" });

    const payload = db.signalReportSnapshot.update.mock.calls[0][0].data
      .payload as {
      initiatives: {
        multiple: number | null;
        formulaVersion: number | null;
        confidenceScore: number | null;
      }[];
    };
    for (const line of payload.initiatives) {
      if (line.multiple !== null) {
        expect(line.formulaVersion).not.toBeNull();
        expect(line.confidenceScore).not.toBeNull();
      }
    }
  });

  it("iniciativa sem fórmula ativa sai sem ROI e com ressalva dizendo por quê", async () => {
    db.signalInitiative.findMany.mockResolvedValue([
      initiative({ roiFormulas: [] }),
    ]);

    await freezeReport({ code: "RP-118" });

    const payload = db.signalReportSnapshot.update.mock.calls[0][0].data
      .payload as {
      initiatives: { multiple: number | null }[];
      caveats: string[];
    };
    expect(payload.initiatives[0].multiple).toBeNull();
    expect(payload.caveats.join(" ")).toContain("não é retorno zero");
  });

  it("carrega a ressalva das observações congeladas", async () => {
    db.signalInitiative.findMany.mockResolvedValue([
      initiative({
        observations: [
          {
            ...initiative().observations[0],
            flag: "Congelada — fonte Zendesk desconectada em 05/07/2026",
          },
        ],
      }),
    ]);

    await freezeReport({ code: "RP-118" });

    const payload = db.signalReportSnapshot.update.mock.calls[0][0].data
      .payload as { caveats: string[] };
    expect(payload.caveats.join(" ")).toContain("ressalva");
  });

  it("diz explicitamente quando não há nada a declarar", async () => {
    await freezeReport({ code: "RP-118" });

    const payload = db.signalReportSnapshot.update.mock.calls[0][0].data
      .payload as { caveats: string[] };
    expect(payload.caveats[0]).toContain("Nenhuma ressalva");
  });
});

describe("relatório congelado não muda", () => {
  it("recusa congelar de novo", async () => {
    db.signalReportSnapshot.findUnique.mockResolvedValue(
      report({ state: "FINAL" })
    );

    const res = await freezeReport({ code: "RP-118" });

    expect(res.ok === false && res.rule).toBe("report.frozen");
    expect(db.signalReportSnapshot.update).not.toHaveBeenCalled();
  });

  it("exporta o payload gravado, não recompõe do banco", async () => {
    const frozen = { schema: 1, initiatives: [{ code: "IN-014" }] };
    db.signalReportSnapshot.findUnique.mockResolvedValue(
      report({ state: "FINAL", payload: frozen })
    );
    // A fórmula mudou depois do congelamento: o banco discorda do papel.
    db.signalInitiative.findMany.mockResolvedValue([
      initiative({ code: "IN-999" }),
    ]);

    const res = await exportReport({ code: "RP-118" });

    expect(res.ok && res.data).toEqual(frozen);
    expect(db.signalInitiative.findMany).not.toHaveBeenCalled();
  });

  it("recusa exportar rascunho", async () => {
    const res = await exportReport({ code: "RP-118" });

    expect(res.ok === false && res.rule).toBe("report.not-frozen");
  });

  it("recusa relatório de outra organização", async () => {
    db.signalReportSnapshot.findUnique.mockResolvedValue(null);

    const res = await exportReport({ code: "RP-999" });

    expect(res.ok === false && res.rule).toBe("report.not-found");
  });
});

describe("draftReport", () => {
  it("cria rascunho com o período", async () => {
    const res = await draftReport({
      name: "Fechamento H2",
      periodLabel: "H2 2026",
      periodStart: "2026-07-01",
      periodEnd: "2026-12-31",
    });

    expect(res.ok && res.data.code).toBe("RP-119");
    expect(db.signalReportSnapshot.create.mock.calls[0][0].data.state).toBe(
      "DRAFT"
    );
  });

  it("recusa período invertido", async () => {
    const res = await draftReport({
      name: "Fechamento",
      periodLabel: "H2 2026",
      periodStart: "2026-12-31",
      periodEnd: "2026-07-01",
    });

    expect(res.ok === false && res.rule).toBe("report.period.order");
    expect(db.signalReportSnapshot.create).not.toHaveBeenCalled();
  });
});
