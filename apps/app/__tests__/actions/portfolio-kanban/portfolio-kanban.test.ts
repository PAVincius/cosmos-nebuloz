import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  tenantFindFirst: vi.fn(),
  tenantFindFirstOrThrow: vi.fn(),
  tenantUpdate: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
  requireRole: mocks.requireRole,
}));
vi.mock("@repo/database", () => ({
  database: {
    tenant: {
      findFirst: mocks.tenantFindFirst,
      findFirstOrThrow: mocks.tenantFindFirstOrThrow,
      update: mocks.tenantUpdate,
    },
  },
}));

import {
  getPortfolioKanbanConfig,
  getViewerRole,
  resetKanbanColumns,
  updateColumnColor,
  updateColumnLabel,
} from "../../../app/actions/portfolio-kanban/index";
import { DEFAULT_PORTFOLIO_COLUMNS } from "../../../app/actions/portfolio-kanban/schema";

const TENANT_ID = tenantCtx.tenantId;

const storedConfig = {
  columns: [
    { id: "FUNNEL", label: "Custom Funnel", color: "#ff0000", wipLimit: 5 },
    { id: "ANALYZING", label: "Reviewing", color: "#d97706", wipLimit: 5 },
    {
      id: "PORTFOLIO_BACKLOG",
      label: "Portfolio Backlog",
      color: "#5e6ad2",
      wipLimit: 5,
    },
    {
      id: "IMPLEMENTING",
      label: "Implementing",
      color: "#0ea5e9",
      wipLimit: 5,
    },
    { id: "DONE", label: "Done", color: "#27a644", wipLimit: 5 },
    { id: "REJECTED", label: "Rejected", color: "#dc2626" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  mocks.requireRole.mockReturnValue(undefined);
  mocks.revalidatePath.mockReturnValue(undefined);
  mocks.tenantUpdate.mockResolvedValue({});
});

// ─── getPortfolioKanbanConfig ─────────────────────────────────────────────────

describe("getPortfolioKanbanConfig", () => {
  it("returns default columns when tenant has no stored config", async () => {
    mocks.tenantFindFirst.mockResolvedValue({ metadata: null });

    const result = await getPortfolioKanbanConfig();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.columns).toEqual(DEFAULT_PORTFOLIO_COLUMNS);
  });

  it("merges stored columns with defaults, preserving custom labels", async () => {
    mocks.tenantFindFirst.mockResolvedValue({
      metadata: { portfolioKanban: storedConfig },
    });

    const result = await getPortfolioKanbanConfig();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // FUNNEL was customized with "Custom Funnel"
    const backlog = result.data.columns.find((c) => c.id === "FUNNEL");
    expect(backlog?.label).toBe("Custom Funnel");
  });

  it("returns default columns when stored config is invalid", async () => {
    mocks.tenantFindFirst.mockResolvedValue({
      metadata: { portfolioKanban: { columns: "not-an-array" } },
    });

    const result = await getPortfolioKanbanConfig();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.columns).toEqual(DEFAULT_PORTFOLIO_COLUMNS);
  });
});

// ─── updateColumnColor ────────────────────────────────────────────────────────

describe("updateColumnColor", () => {
  beforeEach(() => {
    // getPortfolioKanbanConfig is called internally — stub tenantFindFirst for it
    mocks.tenantFindFirst.mockResolvedValue({ metadata: null });
    mocks.tenantFindFirstOrThrow.mockResolvedValue({ metadata: null });
  });

  it("updates color for given columnId and persists config", async () => {
    const result = await updateColumnColor({
      columnId: "FUNNEL",
      color: "#123456",
    });

    expect(result.ok).toBe(true);
    expect(mocks.requireRole).toHaveBeenCalledWith(["ADMIN", "STE"], tenantCtx);
    expect(mocks.tenantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TENANT_ID },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            portfolioKanban: expect.objectContaining({
              columns: expect.arrayContaining([
                expect.objectContaining({ id: "FUNNEL", color: "#123456" }),
              ]),
            }),
          }),
        }),
      })
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/portfolio");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/portfolio");
  });

  it("returns error result when color is invalid hex", async () => {
    const result = await updateColumnColor({
      columnId: "FUNNEL",
      color: "red",
    });

    expect(result.ok).toBe(false);
    expect(mocks.tenantUpdate).not.toHaveBeenCalled();
  });
});

// ─── updateColumnLabel ────────────────────────────────────────────────────────

describe("updateColumnLabel", () => {
  beforeEach(() => {
    mocks.tenantFindFirst.mockResolvedValue({ metadata: null });
    mocks.tenantFindFirstOrThrow.mockResolvedValue({ metadata: null });
  });

  it("updates label for given columnId and persists config", async () => {
    const result = await updateColumnLabel({
      columnId: "ANALYZING",
      label: "In Analysis",
    });

    expect(result.ok).toBe(true);
    expect(mocks.requireRole).toHaveBeenCalledWith(["ADMIN", "STE"], tenantCtx);
    expect(mocks.tenantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            portfolioKanban: expect.objectContaining({
              columns: expect.arrayContaining([
                expect.objectContaining({
                  id: "ANALYZING",
                  label: "In Analysis",
                }),
              ]),
            }),
          }),
        }),
      })
    );
  });

  it("returns error result when label is empty", async () => {
    const result = await updateColumnLabel({
      columnId: "ANALYZING",
      label: "",
    });

    expect(result.ok).toBe(false);
    expect(mocks.tenantUpdate).not.toHaveBeenCalled();
  });
});

// ─── resetKanbanColumns ───────────────────────────────────────────────────────

describe("resetKanbanColumns", () => {
  beforeEach(() => {
    mocks.tenantFindFirstOrThrow.mockResolvedValue({ metadata: null });
  });

  it("resets columns to defaults and persists", async () => {
    const result = await resetKanbanColumns();

    expect(result.ok).toBe(true);
    expect(mocks.requireRole).toHaveBeenCalledWith(["ADMIN", "STE"], tenantCtx);
    expect(mocks.tenantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            portfolioKanban: { columns: DEFAULT_PORTFOLIO_COLUMNS },
          }),
        }),
      })
    );
    if (!result.ok) return;
    expect(result.data.columns).toEqual(DEFAULT_PORTFOLIO_COLUMNS);
  });
});

// ─── getViewerRole ────────────────────────────────────────────────────────────

describe("getViewerRole", () => {
  it("returns the current user's role", async () => {
    const result = await getViewerRole();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe(tenantCtx.role);
  });

  it("returns error result when session fails", async () => {
    mocks.requireTenantSession.mockRejectedValue(new Error("Session expired"));

    const result = await getViewerRole();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Session expired/);
  });
});
