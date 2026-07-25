import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  getAIModel: vi.fn().mockReturnValue({}),
  getActiveProvider: vi.fn().mockReturnValue("anthropic"),
}));

vi.mock("ai", () => ({ generateText: mocks.generateText }));
vi.mock("@repo/ai/lib/models", () => ({
  getAIModel: mocks.getAIModel,
  getActiveProvider: mocks.getActiveProvider,
}));

import { generateCostAnomalyNarrative } from "../../lib/cost/anomaly-narrative";

const baseInput = {
  service: "EC2",
  accountId: "acc-1",
  actualAmount: 4000,
  baselineMedian: 997.5,
  deltaPct: 301.0,
  modifiedZScore: 270.02,
  severity: "CRITICAL",
};

describe("generateCostAnomalyNarrative — degrades honestly with no provider", () => {
  it("returns degraded:true and narrative:null when no AI provider is configured", async () => {
    mocks.getActiveProvider.mockReturnValueOnce("none");
    const result = await generateCostAnomalyNarrative(baseInput);

    expect(result).toEqual({ narrative: null, actions: [], degraded: true });
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("returns degraded:true (not a fabricated narrative) when the model call throws", async () => {
    mocks.generateText.mockRejectedValueOnce(new Error("upstream failure"));
    const result = await generateCostAnomalyNarrative(baseInput);

    expect(result.degraded).toBe(true);
    expect(result.narrative).toBeNull();
    expect(result.actions).toEqual([]);
  });
});

describe("generateCostAnomalyNarrative — happy path", () => {
  it("parses a JSON narrative/actions response from the model", async () => {
    mocks.generateText.mockResolvedValueOnce({
      text: '{"narrative":"EC2 spend tripled.","actions":["Review recent launches","Check for orphaned instances"]}',
    });
    const result = await generateCostAnomalyNarrative(baseInput);

    expect(result.degraded).toBe(false);
    expect(result.narrative).toBe("EC2 spend tripled.");
    expect(result.actions).toEqual([
      "Review recent launches",
      "Check for orphaned instances",
    ]);
  });

  it("includes the real metrics (not placeholders) in the prompt sent to the model", async () => {
    mocks.generateText.mockResolvedValueOnce({
      text: '{"narrative":"x","actions":[]}',
    });
    await generateCostAnomalyNarrative(baseInput);

    const call = mocks.generateText.mock.calls[0][0];
    expect(call.prompt).toContain("EC2");
    expect(call.prompt).toContain("acc-1");
    expect(call.prompt).toContain("4000.00");
    expect(call.prompt).toContain("997.50");
  });

  it("falls back to raw truncated text when the model doesn't return JSON", async () => {
    mocks.generateText.mockResolvedValueOnce({ text: "plain text answer" });
    const result = await generateCostAnomalyNarrative(baseInput);

    expect(result.degraded).toBe(false);
    expect(result.narrative).toBe("plain text answer");
    expect(result.actions).toEqual([]);
  });
});
