import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  strategicThemeFindMany: vi.fn(),
  strategicThemeFindFirst: vi.fn(),
  strategicThemeCreate: vi.fn(),
  strategicThemeUpdate: vi.fn(),
  strategicThemeCount: vi.fn(),
  billingEntryGroupBy: vi.fn(),
  billingEntryAggregate: vi.fn(),
  epicUpdateMany: vi.fn(),
  transaction: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: h.headers }));
vi.mock("next/cache", () => ({ revalidateTag: h.revalidateTag }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSession,
  requireRole: h.requireRole,
  AuthError: MockAuthError,
}));
vi.mock("@repo/database", () => ({
  database: {
    strategicTheme: {
      findMany: h.strategicThemeFindMany,
      findFirst: h.strategicThemeFindFirst,
      create: h.strategicThemeCreate,
      update: h.strategicThemeUpdate,
      count: h.strategicThemeCount,
    },
    billingEntry: {
      groupBy: h.billingEntryGroupBy,
      aggregate: h.billingEntryAggregate,
    },
    epic: {
      updateMany: h.epicUpdateMany,
    },
    $transaction: h.transaction,
  },
}));
vi.mock("../../app/actions/audit/log-audit", () => ({ logAudit: h.logAudit }));

import { database } from "@repo/database";
// Ambos os imports vêm depois de todo vi.mock() acima — é o que a regra 5 de
// .claude/COMMON_MISTAKES.md exige. A ordem entre eles é a do organizador do
// Biome.
import {
  archiveTheme,
  createTheme,
  getTheme,
  listThemes,
  rebalanceThemeTargets,
} from "../../app/(cosmos)/actions/themes";
import {
  MAX_ACTIVE_THEMES,
  THEME_CONCENTRATION_THRESHOLD_PCT,
} from "../../app/(cosmos)/actions/themes.constants";

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
  h.strategicThemeCount.mockResolvedValue(0);
});

describe("listThemes", () => {
  beforeEach(() => {
    h.billingEntryGroupBy.mockResolvedValue([]);
  });

  it("returns tenant-scoped themes with computed epic count and avg progress", async () => {
    h.strategicThemeFindMany.mockResolvedValue([
      {
        id: "th1",
        title: "Expansão LATAM",
        description: null,
        color: "#6366f1",
        healthStatus: "on",
        targetAllocationPct: 25,
        horizon: "PI-26",
        epics: [
          { featureCount: 4, doneFeatureCount: 2 },
          { featureCount: 2, doneFeatureCount: 2 },
        ],
      },
    ]);

    const r = await listThemes();
    expect(r.ok).toBe(true);
    expect(database.strategicTheme.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
    if (r.ok) {
      expect(r.data[0].epicCount).toBe(2);
      expect(r.data[0].avgProgress).toBe(75); // (50 + 100) / 2
    }
  });

  it("queries BillingEntry.groupBy tenant-scoped, restricted to themed rows", async () => {
    h.strategicThemeFindMany.mockResolvedValue([]);

    await listThemes();

    expect(h.billingEntryGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["themeId"],
        where: { tenantId: tenantCtx.tenantId, themeId: { not: null } },
        _sum: { effectiveCost: true },
      })
    );
  });

  it("computes actualAllocationPct per theme, normalized against all themed BillingEntry cost tenant-wide", async () => {
    h.strategicThemeFindMany.mockResolvedValue([
      {
        id: "th1",
        title: "A",
        description: null,
        color: "#6366f1",
        healthStatus: "on",
        targetAllocationPct: 25,
        horizon: null,
        epics: [],
      },
      {
        id: "th2",
        title: "B",
        description: null,
        color: "#6366f1",
        healthStatus: "on",
        targetAllocationPct: 75,
        horizon: null,
        epics: [],
      },
    ]);
    h.billingEntryGroupBy.mockResolvedValue([
      { themeId: "th1", _sum: { effectiveCost: 300 } },
      { themeId: "th2", _sum: { effectiveCost: 700 } },
    ]);

    const r = await listThemes();

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.find((t) => t.id === "th1")?.actualAllocationPct).toBe(30);
      expect(r.data.find((t) => t.id === "th2")?.actualAllocationPct).toBe(70);
    }
  });

  it("returns actualAllocationPct 0 (not null) for a theme with no cost while other themes have data", async () => {
    h.strategicThemeFindMany.mockResolvedValue([
      {
        id: "th1",
        title: "A",
        description: null,
        color: "#6366f1",
        healthStatus: "on",
        targetAllocationPct: 50,
        horizon: null,
        epics: [],
      },
      {
        id: "th2",
        title: "B",
        description: null,
        color: "#6366f1",
        healthStatus: "on",
        targetAllocationPct: 50,
        horizon: null,
        epics: [],
      },
    ]);
    h.billingEntryGroupBy.mockResolvedValue([
      { themeId: "th2", _sum: { effectiveCost: 500 } },
    ]);

    const r = await listThemes();

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.find((t) => t.id === "th1")?.actualAllocationPct).toBe(0);
    }
  });

  it("returns null actualAllocationPct for every theme when the tenant has no BillingEntry cost data (never fabricates)", async () => {
    h.strategicThemeFindMany.mockResolvedValue([
      {
        id: "th1",
        title: "A",
        description: null,
        color: "#6366f1",
        healthStatus: "on",
        targetAllocationPct: 100,
        horizon: null,
        epics: [],
      },
    ]);
    h.billingEntryGroupBy.mockResolvedValue([]);

    const r = await listThemes();

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0].actualAllocationPct).toBeNull();
    }
  });
});

describe("getTheme", () => {
  const themeRow = {
    id: "th1",
    title: "Expansão LATAM",
    description: null,
    color: "#6366f1",
    healthStatus: "on",
    horizon: "PI-26",
    targetAllocationPct: 30,
    pillar: { id: "pil1", name: "Crescimento" },
    epics: [
      {
        id: "ep1",
        title: "Epic 1",
        statusId: "DOING",
        lifecycleStatus: "IMPLEMENTING",
        wsjf: 12,
        featureCount: 4,
        doneFeatureCount: 2,
      },
    ],
  };

  it("scopes the lookup by id + tenantId (IDOR guard) — must fail if tenantId were dropped from the where clause", async () => {
    h.strategicThemeFindFirst.mockResolvedValue(themeRow);
    h.billingEntryAggregate.mockResolvedValue({ _sum: { effectiveCost: 0 } });

    await getTheme("th1");

    expect(h.strategicThemeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "th1", tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.billingEntryAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId, themeId: "th1" },
        _sum: { effectiveCost: true },
      })
    );
    expect(h.billingEntryAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId, themeId: { not: null } },
        _sum: { effectiveCost: true },
      })
    );
  });

  it("returns an error when the theme does not belong to this tenant (not found)", async () => {
    h.strategicThemeFindFirst.mockResolvedValue(null);

    const res = await getTheme("other-tenant-theme");

    expect(res.ok).toBe(false);
    expect(h.billingEntryAggregate).not.toHaveBeenCalled();
  });

  it("computes actualAllocationPct from BillingEntry.effectiveCost, normalized against all themed entries tenant-wide", async () => {
    h.strategicThemeFindFirst.mockResolvedValue(themeRow);
    h.billingEntryAggregate
      .mockResolvedValueOnce({ _sum: { effectiveCost: 300 } }) // this theme's cost
      .mockResolvedValueOnce({ _sum: { effectiveCost: 1000 } }); // all themed cost tenant-wide

    const res = await getTheme("th1");

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.actualAllocationPct).toBe(30); // 300 / 1000 * 100
      expect(res.data.pillar).toEqual({ id: "pil1", name: "Crescimento" });
      expect(res.data.epics[0].progressPct).toBe(50);
    }
  });

  it("returns null actualAllocationPct (never fabricates a number) when there is no BillingEntry cost data", async () => {
    h.strategicThemeFindFirst.mockResolvedValue(themeRow);
    h.billingEntryAggregate.mockResolvedValue({
      _sum: { effectiveCost: null },
    });

    const res = await getTheme("th1");

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.actualAllocationPct).toBeNull();
    }
  });
});

describe("createTheme", () => {
  const validInput = {
    title: "Excelência Operacional",
    description: "Reduzir custo operacional em 15% no ano.",
    budgetTotal: 250_000,
  };

  it("is denied when the role is not permitted (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await createTheme(validInput);

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN", "STE"], tenantCtx);
    expect(h.strategicThemeCreate).not.toHaveBeenCalled();
  });

  it("creates, audits, and revalidates on success", async () => {
    h.strategicThemeCreate.mockResolvedValue({ id: "new-theme" });

    const res = await createTheme(validInput);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.id).toBe("new-theme");
    }
    expect(h.strategicThemeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          title: validInput.title,
          description: validInput.description,
          budgetTotal: validInput.budgetTotal,
        }),
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "created",
        entityType: "theme",
        entityId: "new-theme",
      })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
  });

  it("defaults description/budgetTotal to null when omitted", async () => {
    h.strategicThemeCreate.mockResolvedValue({ id: "new-theme-2" });

    await createTheme({ title: "Tema simples" });

    expect(h.strategicThemeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: null,
          budgetTotal: null,
        }),
      })
    );
  });
});

describe("rebalanceThemeTargets", () => {
  const validInput = {
    targets: [
      { themeId: "th1", targetAllocationPct: 60 },
      { themeId: "th2", targetAllocationPct: 40 },
    ],
  };

  beforeEach(() => {
    h.transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
    h.strategicThemeUpdate.mockResolvedValue({});
  });

  it("is denied when the role is not permitted (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await rebalanceThemeTargets(validInput);

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN", "STE"], tenantCtx);
    expect(h.strategicThemeFindMany).not.toHaveBeenCalled();
    expect(h.strategicThemeUpdate).not.toHaveBeenCalled();
    expect(h.transaction).not.toHaveBeenCalled();
  });

  it("rejects a themeId that does not belong to this tenant, and runs no update", async () => {
    // Only th1 is owned by this tenant — th2 belongs to another tenant.
    h.strategicThemeFindMany.mockResolvedValue([
      { id: "th1", targetAllocationPct: 60 },
    ]);

    const res = await rebalanceThemeTargets(validInput);

    expect(res.ok).toBe(false);
    expect(h.strategicThemeUpdate).not.toHaveBeenCalled();
    expect(h.transaction).not.toHaveBeenCalled();
    expect(h.logAudit).not.toHaveBeenCalled();
    expect(h.revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects when the allocations do not sum to 100", async () => {
    const res = await rebalanceThemeTargets({
      targets: [
        { themeId: "th1", targetAllocationPct: 60 },
        { themeId: "th2", targetAllocationPct: 30 },
      ],
    });

    expect(res.ok).toBe(false);
    expect(h.strategicThemeFindMany).not.toHaveBeenCalled();
    expect(h.strategicThemeUpdate).not.toHaveBeenCalled();
    expect(h.transaction).not.toHaveBeenCalled();
  });

  it("rejects duplicate themeIds even if the sum is 100", async () => {
    const res = await rebalanceThemeTargets({
      targets: [
        { themeId: "th1", targetAllocationPct: 60 },
        { themeId: "th1", targetAllocationPct: 40 },
      ],
    });

    expect(res.ok).toBe(false);
    expect(h.strategicThemeFindMany).not.toHaveBeenCalled();
    expect(h.transaction).not.toHaveBeenCalled();
  });

  it("accepts a sum within float tolerance (99.995 ~ 100)", async () => {
    h.strategicThemeFindMany.mockResolvedValue([
      { id: "th1", targetAllocationPct: 60 },
      { id: "th2", targetAllocationPct: 40 },
    ]);

    const res = await rebalanceThemeTargets({
      targets: [
        { themeId: "th1", targetAllocationPct: 60.003 },
        { themeId: "th2", targetAllocationPct: 39.995 },
      ],
    });

    expect(res.ok).toBe(true);
  });

  it("updates every theme in a single transaction, audits once, and revalidates on success", async () => {
    h.strategicThemeFindMany.mockResolvedValue([
      { id: "th1", targetAllocationPct: 60 },
      { id: "th2", targetAllocationPct: 40 },
    ]);

    const res = await rebalanceThemeTargets(validInput);

    expect(res.ok).toBe(true);
    expect(h.strategicThemeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ["th1", "th2"] },
          tenantId: tenantCtx.tenantId,
        },
      })
    );
    expect(h.strategicThemeUpdate).toHaveBeenCalledTimes(2);
    expect(h.strategicThemeUpdate).toHaveBeenCalledWith({
      where: { id: "th1" },
      data: { targetAllocationPct: 60 },
    });
    expect(h.strategicThemeUpdate).toHaveBeenCalledWith({
      where: { id: "th2" },
      data: { targetAllocationPct: 40 },
    });
    expect(h.transaction).toHaveBeenCalledTimes(1);
    expect(h.transaction.mock.calls[0][0]).toHaveLength(2);
    expect(h.logAudit).toHaveBeenCalledTimes(2);
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "updated",
        entityType: "theme",
        entityId: "th1",
        diff: { from: "60", to: "60" },
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "updated",
        entityType: "theme",
        entityId: "th2",
        diff: { from: "40", to: "40" },
      })
    );
    expect(h.revalidateTag).toHaveBeenCalledTimes(1);
  });

  // AC-005 — alvo de alocação é atributo de tema ativo. Aceitar um arquivado no
  // rebalanceamento faria a soma de 100% cobrir tema que não recebe mais
  // investimento, e o Strategy Map passaria a mentir sobre o portfólio.
  it("recusa o lote inteiro quando um dos temas está arquivado", async () => {
    h.strategicThemeFindMany.mockResolvedValue([
      { id: "th1", targetAllocationPct: 60, status: "ACTIVE" },
      { id: "th2", targetAllocationPct: 40, status: "ARCHIVED" },
    ]);

    const res = await rebalanceThemeTargets(validInput);

    expect(res.ok).toBe(false);
    expect(h.transaction).not.toHaveBeenCalled();
    expect(h.strategicThemeUpdate).not.toHaveBeenCalled();
    expect(h.logAudit).not.toHaveBeenCalled();
  });
});

// ── AC-004 — concentração de portfólio ────────────────────────────────────
describe("listThemes — concentração de portfólio", () => {
  const epics = (n: number) =>
    Array.from({ length: n }, () => ({ featureCount: 0, doneFeatureCount: 0 }));

  const row = (over: Record<string, unknown>) => ({
    id: "th",
    title: "T",
    description: null,
    color: "#6366f1",
    healthStatus: "on",
    targetAllocationPct: null,
    horizon: null,
    status: "ACTIVE",
    epics: [],
    ...over,
  });

  beforeEach(() => {
    h.billingEntryGroupBy.mockResolvedValue([]);
  });

  it("sinaliza apenas o tema acima da diretriz de 60% dos épicos (8/2/2)", async () => {
    h.strategicThemeFindMany.mockResolvedValue([
      row({ id: "th1", title: "Segurança", epics: epics(8) }),
      row({ id: "th2", title: "Plataforma", epics: epics(2) }),
      row({ id: "th3", title: "Crescimento", epics: epics(2) }),
    ]);

    const r = await listThemes();

    expect(r.ok).toBe(true);
    if (r.ok) {
      const byId = new Map(r.data.map((t) => [t.id, t]));
      expect(byId.get("th1")?.epicSharePct).toBe(66.7);
      expect(byId.get("th1")?.overConcentrated).toBe(true);
      expect(byId.get("th2")?.epicSharePct).toBe(16.7);
      expect(byId.get("th2")?.overConcentrated).toBe(false);
      expect(byId.get("th3")?.overConcentrated).toBe(false);
    }
    expect(THEME_CONCENTRATION_THRESHOLD_PCT).toBe(60);
  });

  it("ignora tema arquivado no denominador e nunca o sinaliza", async () => {
    h.strategicThemeFindMany.mockResolvedValue([
      row({ id: "th1", epics: epics(3) }),
      row({ id: "th2", epics: epics(3) }),
      row({ id: "arq", status: "ARCHIVED", epics: epics(20) }),
    ]);

    const r = await listThemes();

    expect(r.ok).toBe(true);
    if (r.ok) {
      const byId = new Map(r.data.map((t) => [t.id, t]));
      // 3 de 6 entre ativos = 50%, e não 3 de 26
      expect(byId.get("th1")?.epicSharePct).toBe(50);
      expect(byId.get("arq")?.epicSharePct).toBeNull();
      expect(byId.get("arq")?.overConcentrated).toBe(false);
      expect(byId.get("arq")?.status).toBe("ARCHIVED");
    }
  });

  it("retorna epicSharePct null (nunca 0) quando nenhum tema ativo tem épico", async () => {
    h.strategicThemeFindMany.mockResolvedValue([
      row({ id: "th1" }),
      row({ id: "th2" }),
    ]);

    const r = await listThemes();

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0].epicSharePct).toBeNull();
      expect(r.data[0].overConcentrated).toBe(false);
    }
  });
});

// ── AC-002 — teto SAFe de temas ativos ────────────────────────────────────
describe("createTheme — teto de temas ativos", () => {
  it("conta apenas temas não arquivados ao aplicar o teto", async () => {
    h.strategicThemeCreate.mockResolvedValue({ id: "novo" });

    await createTheme({ title: "Tema" });

    expect(h.strategicThemeCount).toHaveBeenCalledWith({
      where: { tenantId: tenantCtx.tenantId, status: { not: "ARCHIVED" } },
    });
  });

  it(`recusa a criação com ${MAX_ACTIVE_THEMES} temas ativos, sem gravar nada`, async () => {
    h.strategicThemeCount.mockResolvedValue(MAX_ACTIVE_THEMES);

    const res = await createTheme({ title: "Oitavo tema" });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain(String(MAX_ACTIVE_THEMES));
    }
    expect(h.strategicThemeCreate).not.toHaveBeenCalled();
    expect(h.logAudit).not.toHaveBeenCalled();
    expect(h.revalidateTag).not.toHaveBeenCalled();
  });

  it("permite criar quando o tenant está abaixo do teto", async () => {
    h.strategicThemeCount.mockResolvedValue(MAX_ACTIVE_THEMES - 1);
    h.strategicThemeCreate.mockResolvedValue({ id: "setimo" });

    const res = await createTheme({ title: "Sétimo tema" });

    expect(res.ok).toBe(true);
    expect(h.strategicThemeCreate).toHaveBeenCalled();
  });
});

// ── AC-003 — arquivamento não-cascateante ─────────────────────────────────
describe("archiveTheme", () => {
  it("é negado quando o papel não é permitido (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await archiveTheme({ id: "th1" });

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN", "STE"], tenantCtx);
    expect(h.strategicThemeFindFirst).not.toHaveBeenCalled();
    expect(h.strategicThemeUpdate).not.toHaveBeenCalled();
  });

  it("busca o tema por id + tenantId e recusa o que não pertence ao tenant (IDOR)", async () => {
    h.strategicThemeFindFirst.mockResolvedValue(null);

    const res = await archiveTheme({ id: "de-outro-tenant" });

    expect(res.ok).toBe(false);
    expect(h.strategicThemeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "de-outro-tenant", tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.strategicThemeUpdate).not.toHaveBeenCalled();
  });

  it("recusa arquivar um tema já arquivado", async () => {
    h.strategicThemeFindFirst.mockResolvedValue({
      id: "th1",
      status: "ARCHIVED",
      targetAllocationPct: null,
    });

    const res = await archiveTheme({ id: "th1" });

    expect(res.ok).toBe(false);
    expect(h.strategicThemeUpdate).not.toHaveBeenCalled();
    expect(h.logAudit).not.toHaveBeenCalled();
  });

  it("arquiva zerando o alvo, audita a transição e não toca em nenhum épico", async () => {
    h.strategicThemeFindFirst.mockResolvedValue({
      id: "th1",
      status: "ACTIVE",
      targetAllocationPct: 30,
    });
    h.strategicThemeUpdate.mockResolvedValue({ id: "th1" });

    const res = await archiveTheme({ id: "th1" });

    expect(res.ok).toBe(true);
    expect(h.strategicThemeUpdate).toHaveBeenCalledWith({
      where: { id: "th1" },
      data: { status: "ARCHIVED", targetAllocationPct: null },
    });
    // não-cascateante: os épicos existentes continuam apontando para o tema
    expect(h.epicUpdateMany).not.toHaveBeenCalled();
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "status_changed",
        entityType: "theme",
        entityId: "th1",
        diff: { from: "ACTIVE", to: "ARCHIVED" },
      })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
  });
});
