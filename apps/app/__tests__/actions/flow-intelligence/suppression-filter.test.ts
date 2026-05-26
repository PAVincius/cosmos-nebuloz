// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// suppression-filter.ts imports @repo/database at module level;
// mock it so the pure shouldSuppress function can be tested in isolation.
vi.mock("@repo/database", () => ({
  database: {
    anomalyDetectionRun: { findMany: vi.fn() },
  },
}));

import { shouldSuppress } from "@/app/actions/flow-intelligence/suppression-filter";

describe("shouldSuppress", () => {
  it("never suppresses new anomaly", () => {
    expect(shouldSuppress("new")).toBe(false);
  });

  it("never suppresses chronic anomaly", () => {
    expect(shouldSuppress("chronic", new Date(Date.now() - 1000))).toBe(false);
  });

  it("suppresses recurring seen < 3 days ago", () => {
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(shouldSuppress("recurring", recent)).toBe(true);
  });

  it("does not suppress recurring seen > 3 days ago", () => {
    const old = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    expect(shouldSuppress("recurring", old)).toBe(false);
  });
});
