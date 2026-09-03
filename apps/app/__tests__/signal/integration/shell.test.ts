import { beforeEach, describe, expect, it, vi } from "vitest";

// getShellData — a única consulta que roda por navegação server-side.
//
// Os contadores do sidebar e o card de portfólio saem daqui. O que o teste
// protege: que os agregados sejam somados antes de dividir, que "em risco" use
// o veredito e não o ROI cru, e que o tom do contador de alertas distinga
// "precisa de atenção" de "precisa de decisão".

const h = vi.hoisted(() => ({
  requireSignalContext: vi.fn(),
  withTenantDb: vi.fn(),
  listModules: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({ withTenantDb: h.withTenantDb }));
vi.mock("@repo/rbac", async () => {
  const actual = await vi.importActual<
    typeof import("@repo/rbac/src/signal-matrix")
  >("../../../../../packages/rbac/src/signal-matrix");
  return { ...actual, listModules: h.listModules };
});
vi.mock("@/lib/signal/guards", () => ({
  requireSignalContext: h.requireSignalContext,
}));

import { getShellData } from "@/app/(signal)/actions/shell";

const CTX = {
  tenantId: "tnt_1",
  userId: "usr_1",
  signalRole: "ANALYST",
  user: { id: "usr_1", name: "Marina Duarte", email: "marina@vanta.test" },
};

type DbShape = Record<string, Record<string, ReturnType<typeof vi.fn>>>;

/** Monta o db mockado com os retornos que interessam ao caso. */
const mockDb = (over: {
  initiatives?: unknown[];
  settings?: unknown;
  openAlerts?: number;
  weakAlerts?: number;
  evidence?: number;
  finalReports?: number;
  unhealthy?: number;
  mappings?: number;
}) => {
  const db: DbShape = {
    tenant: { findUnique: vi.fn().mockResolvedValue({ name: "Vanta Saúde" }) },
    signalSettings: {
      findUnique: vi.fn().mockResolvedValue(over.settings ?? null),
    },
    signalInitiative: {
      findMany: vi.fn().mockResolvedValue(over.initiatives ?? []),
    },
    signalAlert: {
      count: vi
        .fn()
        .mockResolvedValueOnce(over.openAlerts ?? 0)
        .mockResolvedValueOnce(over.weakAlerts ?? 0),
    },
    signalMetricObservation: {
      count: vi.fn().mockResolvedValue(over.evidence ?? 0),
    },
    signalReportSnapshot: {
      count: vi.fn().mockResolvedValue(over.finalReports ?? 0),
    },
    signalConnection: {
      count: vi.fn().mockResolvedValue(over.unhealthy ?? 0),
    },
    signalMetricMapping: {
      count: vi.fn().mockResolvedValue(over.mappings ?? 0),
    },
  };
  h.withTenantDb.mockImplementation(
    (_tenantId: string, fn: (d: unknown) => unknown) => fn(db)
  );
  return db;
};

/** Iniciativa com fórmula ativa e um snapshot de adoção. */
const initiative = (
  returned: number,
  invested: number,
  activeUsers: number,
  licensedUsers: number
) => ({
  id: `ini_${returned}`,
  roiFormulas: [
    {
      entries: [
        { kind: "RETURN", total: returned },
        { kind: "COST", total: invested },
      ],
    },
  ],
  adoption: [{ activeUsers, licensedUsers }],
});

beforeEach(() => {
  vi.clearAllMocks();
  h.requireSignalContext.mockResolvedValue(CTX);
  h.listModules.mockResolvedValue(["COSMOS", "SIGNAL"]);
});

describe("guard", () => {
  it("começa pelo contexto do Signal — layout não protege RPC", async () => {
    mockDb({});
    await getShellData();
    expect(h.requireSignalContext).toHaveBeenCalledOnce();
  });

  it("propaga a negativa do guard sem consultar o banco", async () => {
    mockDb({});
    h.requireSignalContext.mockRejectedValue(new Error("FORBIDDEN"));
    await expect(getShellData()).rejects.toThrow("FORBIDDEN");
    expect(h.withTenantDb).not.toHaveBeenCalled();
  });

  it("consulta sempre dentro de withTenantDb, com o tenant da sessão", async () => {
    mockDb({});
    await getShellData();
    expect(h.withTenantDb).toHaveBeenCalledWith("tnt_1", expect.any(Function));
  });
});

describe("contadores do sidebar", () => {
  it("reflete o banco em cada chave de tela", async () => {
    mockDb({
      initiatives: [initiative(764_400, 182_000, 14, 18)],
      openAlerts: 5,
      evidence: 42,
      finalReports: 3,
      unhealthy: 2,
      mappings: 8,
    });
    const shell = await getShellData();
    expect(shell.badges).toEqual({
      initiatives: 1,
      alerts: 5,
      evidence: 42,
      reports: 3,
      connections: 2,
      mapping: 8,
    });
  });

  it("conta só iniciativas ATIVAS, não o total", async () => {
    const db = mockDb({});
    await getShellData();
    expect(db.signalInitiative?.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACTIVE" }),
      })
    );
  });

  it("conta só relatórios CONGELADOS — rascunho não é entrega", async () => {
    const db = mockDb({});
    await getShellData();
    expect(db.signalReportSnapshot?.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ state: "FINAL" }),
      })
    );
  });

  it("conta só fontes NÃO saudáveis — o contador existe para incomodar", async () => {
    const db = mockDb({});
    await getShellData();
    expect(db.signalConnection?.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ health: { not: "HEALTHY" } }),
      })
    );
  });
});

describe("tom do contador de alertas", () => {
  it("vermelho quando há alerta de uso sem valor", async () => {
    // WEAK é o único que pede decisão, não atenção.
    mockDb({ openAlerts: 4, weakAlerts: 1 });
    expect((await getShellData()).alertsTone).toBe("red");
  });

  it("âmbar quando há alerta aberto, mas nenhum de uso sem valor", async () => {
    mockDb({ openAlerts: 3, weakAlerts: 0 });
    expect((await getShellData()).alertsTone).toBe("amber");
  });

  it("sem tom quando não há alerta aberto", async () => {
    mockDb({ openAlerts: 0, weakAlerts: 0 });
    expect((await getShellData()).alertsTone).toBeNull();
  });
});

describe("card de portfólio", () => {
  it("soma os dois lados antes de dividir", async () => {
    mockDb({
      initiatives: [
        initiative(764_400, 182_000, 14, 18),
        initiative(215_980, 240_000, 52, 62),
      ],
    });
    const { portfolio } = await getShellData();
    expect(portfolio.returned).toBe(980_380);
    expect(portfolio.invested).toBe(422_000);
    expect(portfolio.multiple).toBeCloseTo(980_380 / 422_000, 6);
  });

  it("conta como em risco o investido de VANITY e STOP, pelo veredito", async () => {
    mockDb({
      initiatives: [
        // 78% adoção, 4,2× → PROVEN, não entra
        initiative(764_400, 182_000, 14, 18),
        // 84% adoção, 0,9× → VANITY, entra
        initiative(215_980, 240_000, 52, 62),
        // 22% adoção, 0,6× → STOP, entra
        initiative(52_820, 88_000, 8, 38),
      ],
    });
    const { portfolio } = await getShellData();
    expect(portfolio.atRisk).toBe(240_000 + 88_000);
  });

  it("NÃO conta promessa parada como dinheiro em risco", async () => {
    // 33% adoção, 3,1× → PROMISE: o retorno existe, falta escala.
    mockDb({ initiatives: [initiative(229_560, 74_000, 3, 9)] });
    expect((await getShellData()).portfolio.atRisk).toBe(0);
  });

  it("portfólio vazio não divide por zero", async () => {
    mockDb({ initiatives: [] });
    const { portfolio } = await getShellData();
    expect(portfolio).toMatchObject({
      invested: 0,
      returned: 0,
      multiple: 0,
      atRisk: 0,
    });
  });

  it("iniciativa sem fórmula ativa entra com zero, não quebra o agregado", async () => {
    mockDb({
      initiatives: [
        { id: "ini_draft", roiFormulas: [], adoption: [] },
        initiative(764_400, 182_000, 14, 18),
      ],
    });
    const { portfolio } = await getShellData();
    expect(portfolio.returned).toBe(764_400);
    expect(portfolio.multiple).toBeCloseTo(4.2, 4);
  });
});

describe("limiares do tenant", () => {
  it("usa os limiares configurados, e eles mudam o que conta como em risco", async () => {
    // 71% adoção e 1,8× é PROVEN com a régua padrão. Com valueBar 2,0 vira
    // VANITY, e o mesmo dinheiro passa a aparecer em risco.
    const initiatives = [initiative(172_680, 96_000, 17, 24)];
    mockDb({ initiatives });
    expect((await getShellData()).portfolio.atRisk).toBe(0);

    vi.clearAllMocks();
    h.requireSignalContext.mockResolvedValue(CTX);
    h.listModules.mockResolvedValue(["SIGNAL"]);
    mockDb({
      initiatives,
      settings: {
        adoptionBar: 60,
        valueBar: 2.0,
        currency: "BRL",
        fiscalYearLabel: "FY26",
      },
    });
    const shell = await getShellData();
    expect(shell.bars).toEqual({ adoptionBar: 60, valueBar: 2 });
    expect(shell.portfolio.atRisk).toBe(96_000);
  });

  it("cai para a régua padrão quando o tenant não configurou", async () => {
    mockDb({ settings: null });
    expect((await getShellData()).bars).toEqual({
      adoptionBar: 60,
      valueBar: 1.5,
    });
  });
});

describe("identidade", () => {
  it("traz organização, papel legível e módulos contratados", async () => {
    mockDb({});
    const shell = await getShellData();
    expect(shell.organization).toBe("Vanta Saúde");
    expect(shell.user).toEqual({ name: "Marina Duarte", role: "Analista" });
    expect(shell.modules).toEqual(["COSMOS", "SIGNAL"]);
  });

  it("cai para o e-mail quando não há nome", async () => {
    h.requireSignalContext.mockResolvedValue({
      ...CTX,
      user: { id: "usr_1", name: null, email: "marina@vanta.test" },
    });
    mockDb({});
    expect((await getShellData()).user.name).toBe("marina@vanta.test");
  });
});
