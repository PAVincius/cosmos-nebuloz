import { describe, expect, it } from "vitest";
import { formatRiskComment } from "../pr-commenter.js";
import type { RiskAnalysis } from "../risk-analyzer.js";

const SAMPLE_ANALYSIS: RiskAnalysis = {
  score: "HIGH",
  model_used: "sonnet",
  security: [
    {
      risk: "Token expiry uses < not <=",
      location: "packages/auth/server.ts:42",
      severity: "HIGH",
    },
  ],
  regression: [
    {
      risk: "No tests cover changed lines",
      location: "packages/safe-engine/src/wsjf.ts",
      severity: "MEDIUM",
    },
  ],
  safe_domain: [],
  summary: "Change touches core auth logic.",
  checklist: ["Verify token expiry with active sessions"],
};

describe("formatRiskComment", () => {
  it("includes the score in the header", () => {
    const comment = formatRiskComment(SAMPLE_ANALYSIS, "+100/-20", "sonnet");
    expect(comment).toContain("## AI Risk Score: HIGH");
  });

  it("includes model name", () => {
    const comment = formatRiskComment(SAMPLE_ANALYSIS, "+100/-20", "sonnet");
    expect(comment).toContain("Claude Sonnet 4.6");
  });

  it("includes diff stats", () => {
    const comment = formatRiskComment(SAMPLE_ANALYSIS, "+100/-20", "sonnet");
    expect(comment).toContain("+100/-20");
  });

  it("lists security findings", () => {
    const comment = formatRiskComment(SAMPLE_ANALYSIS, "+100/-20", "sonnet");
    expect(comment).toContain("Token expiry uses < not <=");
    expect(comment).toContain("packages/auth/server.ts:42");
  });

  it("lists regression findings", () => {
    const comment = formatRiskComment(SAMPLE_ANALYSIS, "+100/-20", "sonnet");
    expect(comment).toContain("No tests cover changed lines");
  });

  it("omits empty sections", () => {
    const comment = formatRiskComment(SAMPLE_ANALYSIS, "+100/-20", "sonnet");
    expect(comment).not.toContain("### SAFe Domain\n\n---");
  });

  it("includes checklist items", () => {
    const comment = formatRiskComment(SAMPLE_ANALYSIS, "+100/-20", "sonnet");
    expect(comment).toContain("- [ ] Verify token expiry with active sessions");
  });

  it("works with Haiku model label", () => {
    const analysis = { ...SAMPLE_ANALYSIS, score: "LOW" as const };
    const comment = formatRiskComment(analysis, "+5/-2", "haiku");
    expect(comment).toContain("Claude Haiku 4.5");
    expect(comment).toContain("## AI Risk Score: LOW");
  });
});
