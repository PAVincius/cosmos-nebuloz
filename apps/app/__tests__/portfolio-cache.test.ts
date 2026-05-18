import { describe, expect, it } from "vitest";
import { portfolioEpicsCacheTag } from "../app/actions/epics/portfolio-cache";

describe("portfolioEpicsCacheTag", () => {
  it("returns a stable tag per tenant", () => {
    expect(portfolioEpicsCacheTag("tenant-a")).toBe("portfolio-epics:tenant-a");
    expect(portfolioEpicsCacheTag("tenant-b")).toBe("portfolio-epics:tenant-b");
  });

  it("isolates tenants", () => {
    const a = portfolioEpicsCacheTag("org-1");
    const b = portfolioEpicsCacheTag("org-2");
    expect(a).not.toBe(b);
  });
});
