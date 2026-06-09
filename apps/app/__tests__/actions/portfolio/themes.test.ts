import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  strategicThemeFindMany: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    strategicTheme: { findMany: mocks.strategicThemeFindMany },
  },
}));

import { checkThemeConcentration } from "../../../app/actions/portfolio/themes";

describe("checkThemeConcentration (AC-001)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  });

  it("flags theme above 60% default threshold (AC-001)", async () => {
    // 8/2/2 = 66.7% / 16.7% / 16.7%
    mocks.strategicThemeFindMany.mockResolvedValue([
      { id: "t1", title: "Security", _count: { epics: 8 } },
      { id: "t2", title: "Growth", _count: { epics: 2 } },
      { id: "t3", title: "Ops", _count: { epics: 2 } },
    ]);

    const result = await checkThemeConcentration({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.totalEpics).toBe(12);
    expect(result.data.alerts).toHaveLength(1);
    expect(result.data.alerts[0].themeId).toBe("t1");
    expect(result.data.alerts[0].percentage).toBeCloseTo(0.667, 2);
  });

  it("respects custom threshold (AC-001)", async () => {
    mocks.strategicThemeFindMany.mockResolvedValue([
      { id: "t1", title: "Security", _count: { epics: 5 } },
      { id: "t2", title: "Growth", _count: { epics: 5 } },
    ]);

    // 50% each — below 60% default, but above 40% custom
    const result = await checkThemeConcentration({ threshold: 0.4 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.alerts).toHaveLength(2);
  });

  it("returns no alerts when all themes within bounds (AC-001)", async () => {
    mocks.strategicThemeFindMany.mockResolvedValue([
      { id: "t1", title: "Security", _count: { epics: 4 } },
      { id: "t2", title: "Growth", _count: { epics: 3 } },
      { id: "t3", title: "Ops", _count: { epics: 3 } },
    ]);

    const result = await checkThemeConcentration({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.alerts).toHaveLength(0);
  });

  it("returns empty alerts when no epics exist (AC-001)", async () => {
    mocks.strategicThemeFindMany.mockResolvedValue([
      { id: "t1", title: "Security", _count: { epics: 0 } },
    ]);

    const result = await checkThemeConcentration({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.totalEpics).toBe(0);
    expect(result.data.alerts).toHaveLength(0);
  });
});
