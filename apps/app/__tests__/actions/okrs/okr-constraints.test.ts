import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  okrCreate: vi.fn(),
  okrCount: vi.fn(),
  okrFindFirst: vi.fn(),
  okrFindFirstOrThrow: vi.fn(),
  keyResultCreate: vi.fn(),
  keyResultCount: vi.fn(),
  keyResultFindFirst: vi.fn(),
  keyResultFindFirstOrThrow: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
  AuthError: class AuthError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));
vi.mock("../../../app/actions/okrs/notifications", () => ({
  checkKRThresholds: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@repo/database", () => ({
  database: {
    oKR: {
      create: mocks.okrCreate,
      count: mocks.okrCount,
      findFirst: mocks.okrFindFirst,
      findFirstOrThrow: mocks.okrFindFirstOrThrow,
    },
    keyResult: {
      create: mocks.keyResultCreate,
      count: mocks.keyResultCount,
      findFirst: mocks.keyResultFindFirst,
      findFirstOrThrow: mocks.keyResultFindFirstOrThrow,
    },
  },
}));

import { createKeyResult, createOKR } from "../../../app/actions/okrs";

const RTE_CTX = { ...tenantCtx, role: "RTE" as const };
const PO_CTX = { ...tenantCtx, role: "PO" as const };

const VALID_OKR_INPUT = {
  title: "Increase deployment frequency",
  type: "pi_art",
  artId: "ctest1234567890art000001",
  quarter: 2,
  year: 2026,
};

describe("createOKR — AC-001: valid creation with quarter/year", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(RTE_CTX);
    mocks.okrCount.mockResolvedValue(0);
    mocks.okrCreate.mockResolvedValue({
      id: "okr-1",
      ...VALID_OKR_INPUT,
      status: "ON_TRACK",
    });
  });

  it("persists OKR with quarter and year when count < 10", async () => {
    const result = await createOKR(VALID_OKR_INPUT);
    expect(result.ok).toBe(true);
    expect(mocks.okrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quarter: 2, year: 2026 }),
      })
    );
  });

  it("blocks creation when ART already has 10 OKRs for the quarter", async () => {
    mocks.okrCount.mockResolvedValue(10);
    const result = await createOKR(VALID_OKR_INPUT);
    expect(result.ok).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).error).toMatch(/Maximum 10 OKRs/);
    expect(mocks.okrCreate).not.toHaveBeenCalled();
  });
});

describe("createOKR — AC-002: PO cannot create ART-level OKR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(PO_CTX);
    mocks.okrCount.mockResolvedValue(0);
    mocks.okrCreate.mockResolvedValue({ id: "okr-1" });
  });

  it("blocks PO from creating pi_art OKR", async () => {
    const result = await createOKR({ ...VALID_OKR_INPUT, type: "pi_art" });
    expect(result.ok).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).error).toMatch(/INSUFFICIENT_ROLE|RTE/i);
    expect(mocks.okrCreate).not.toHaveBeenCalled();
  });

  it("allows PO to create portfolio_theme OKR", async () => {
    const result = await createOKR({
      ...VALID_OKR_INPUT,
      type: "portfolio_theme",
    });
    expect(result.ok).toBe(true);
  });
});

describe("createKeyResult — AC-008: maximum 5 key results per OKR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(RTE_CTX);
    mocks.okrFindFirst.mockResolvedValue({
      id: "ctest1234567890okr00001",
      tenantId: tenantCtx.tenantId,
    });
    mocks.keyResultCreate.mockResolvedValue({
      id: "ctest1234567890kr000001",
      title: "KR title",
      current: 0,
      target: 100,
      unit: "%",
      confidence: "ON_TRACK",
      metricRuleId: null,
    });
  });

  it("allows creating 5th key result", async () => {
    mocks.keyResultCount.mockResolvedValue(4);
    const result = await createKeyResult({
      okrId: "ctest1234567890okr00001",
      title: "Deploy frequency KR",
      target: 10,
      unit: "deploys/day",
    });
    expect(result.ok).toBe(true);
  });

  it("blocks creating 6th key result", async () => {
    mocks.keyResultCount.mockResolvedValue(5);
    const result = await createKeyResult({
      okrId: "ctest1234567890okr00001",
      title: "One too many",
      target: 10,
      unit: "%",
    });
    expect(result.ok).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).error).toMatch(/Maximum 5 key results/);
    expect(mocks.keyResultCreate).not.toHaveBeenCalled();
  });
});
