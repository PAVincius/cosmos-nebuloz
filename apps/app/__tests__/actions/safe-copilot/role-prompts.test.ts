// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildRoleSystemPrompt } from "@/app/actions/safe-copilot/roles/role-prompts";

describe("buildRoleSystemPrompt", () => {
  it("RTE prompt contains ROAM", () => {
    expect(buildRoleSystemPrompt("RTE")).toContain("ROAM");
  });

  it("LPM prompt contains INVEST and WSJF", () => {
    const p = buildRoleSystemPrompt("LPM");
    expect(p).toContain("INVEST");
    expect(p).toContain("WSJF");
  });

  it("PO prompt contains Given/When/Then", () => {
    expect(buildRoleSystemPrompt("PO")).toContain("Given/When/Then");
  });

  it("SM prompt contains impedimento", () => {
    expect(buildRoleSystemPrompt("SM")).toContain("impedimento");
  });

  it("all roles return non-empty string", () => {
    for (const role of ["RTE", "LPM", "PO", "SM", "DEV"] as const) {
      expect(buildRoleSystemPrompt(role).length).toBeGreaterThan(50);
    }
  });
});
