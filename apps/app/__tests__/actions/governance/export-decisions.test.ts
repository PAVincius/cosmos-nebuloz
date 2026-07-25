// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  listDecisions: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("../../../app/actions/governance/decision-log", () => ({
  listDecisions: mocks.listDecisions,
}));

import { exportDecisionsCSV } from "../../../app/actions/governance/export-decisions";

// Valid 6-month range
const FROM = new Date("2025-01-01");
const TO = new Date("2025-06-30");

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    tipo: "architecture",
    targetType: "epic",
    targetId: "epic-cuid123456",
    decisao: "Use microservices",
    justificativa: "Scalability requirement",
    decisorId: "user-cuid123456",
    dataDecisao: new Date("2025-03-15"),
    createdAt: new Date("2025-03-15"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  mocks.listDecisions.mockResolvedValue([]);
});

describe("exportDecisionsCSV", () => {
  it("returns CSV with header + rows for normal entries", async () => {
    mocks.listDecisions.mockResolvedValue([makeEntry()]);

    const result = await exportDecisionsCSV({ from: FROM, to: TO });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const lines = result.data.csv.split("\n");
    expect(lines[0]).toBe(
      "data,tipo,target_type,target_id,decisao,justificativa,decisor_id"
    );
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("2025-03-15");
    expect(lines[1]).toContain('"architecture"');
    expect(lines[1]).toContain('"Use microservices"');
  });

  it("returns CSV with only header when entries list is empty", async () => {
    mocks.listDecisions.mockResolvedValue([]);

    const result = await exportDecisionsCSV({ from: FROM, to: TO });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.csv).toBe(
      "data,tipo,target_type,target_id,decisao,justificativa,decisor_id"
    );
  });

  it("escapes quotes in fields with double-quote doubling", async () => {
    mocks.listDecisions.mockResolvedValue([
      makeEntry({ decisao: 'He said "yes"' }),
    ]);

    const result = await exportDecisionsCSV({ from: FROM, to: TO });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.csv).toContain('"He said ""yes"""');
  });

  it("returns { ok: false } when period exceeds 1 year", async () => {
    const result = await exportDecisionsCSV({
      from: new Date("2024-01-01"),
      to: new Date("2025-01-02"), // 366+ days
    });

    expect(result.ok).toBe(false);
  });

  it("returns { ok: false } for invalid date input", async () => {
    const result = await exportDecisionsCSV({
      from: "not-a-date",
      to: TO,
    });

    expect(result.ok).toBe(false);
  });

  it("uses dataDecisao field for the date column when present", async () => {
    const dataDecisao = new Date("2025-05-20");
    const createdAt = new Date("2025-01-01"); // different date — should NOT appear
    mocks.listDecisions.mockResolvedValue([
      makeEntry({ dataDecisao, createdAt }),
    ]);

    const result = await exportDecisionsCSV({ from: FROM, to: TO });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const lines = result.data.csv.split("\n");
    expect(lines[1]).toContain("2025-05-20");
    expect(lines[1]).not.toContain("2025-01-01");
  });
});
