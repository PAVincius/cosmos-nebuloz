// Story-021 AC-008: auto-INVEST check on story save

import { describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ requireTenantSession: vi.fn() }));
vi.mock("@repo/auth/server", () => authMocks);
vi.mock("@repo/database", () => ({
  database: { story: { findFirst: vi.fn() } },
}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@repo/observability/log", () => ({
  log: { error: vi.fn(), info: vi.fn() },
}));

import { evaluateStoryInvest } from "../../../app/actions/stories/invest";

const BASE = {
  title: "As a user I want X",
  description: "Como usuário, quero fazer X para que Y aconteça",
  acceptanceCriteria: "Given X When Y Then Z",
  storyPoints: 5,
  status: "BACKLOG",
};

describe("evaluateStoryInvest (AC-008)", () => {
  it("returns GREEN when all criteria pass", () => {
    const result = evaluateStoryInvest(BASE);
    expect(result.badge).toBe("GREEN");
    expect(result.criteria.every((c) => c.pass)).toBe(true);
  });

  it("returns RED when storyPoints = 0 (Estimable ERROR)", () => {
    const result = evaluateStoryInvest({ ...BASE, storyPoints: 0 });
    expect(result.badge).toBe("RED");
    const estimable = result.criteria.find((c) => c.key === "estimable");
    expect(estimable?.pass).toBe(false);
    expect(estimable?.level).toBe("ERROR");
  });

  it("returns RED when acceptanceCriteria is empty (Testable ERROR)", () => {
    const result = evaluateStoryInvest({ ...BASE, acceptanceCriteria: "" });
    expect(result.badge).toBe("RED");
    const testable = result.criteria.find((c) => c.key === "testable");
    expect(testable?.pass).toBe(false);
    expect(testable?.level).toBe("ERROR");
  });

  it("returns AMBER when storyPoints > 13 but has AC (Small WARN only)", () => {
    const result = evaluateStoryInvest({ ...BASE, storyPoints: 21 });
    expect(result.badge).toBe("AMBER");
    const small = result.criteria.find((c) => c.key === "small");
    expect(small?.pass).toBe(false);
    expect(small?.level).toBe("WARN");
  });

  it("returns AMBER when description missing (Negotiable WARN)", () => {
    const result = evaluateStoryInvest({ ...BASE, description: null });
    expect(result.badge).toBe("AMBER");
    const negotiable = result.criteria.find((c) => c.key === "negotiable");
    expect(negotiable?.pass).toBe(false);
  });

  it("returns AMBER when description lacks user-story format (Valuable WARN)", () => {
    const result = evaluateStoryInvest({
      ...BASE,
      description: "Fix the thing",
    });
    expect(result.badge).toBe("AMBER");
    const valuable = result.criteria.find((c) => c.key === "valuable");
    expect(valuable?.pass).toBe(false);
  });

  it("marks independent as failing when status = SPLIT_INTO", () => {
    const result = evaluateStoryInvest({ ...BASE, status: "SPLIT_INTO" });
    const independent = result.criteria.find((c) => c.key === "independent");
    expect(independent?.pass).toBe(false);
    expect(independent?.level).toBe("INFO");
  });

  it("RED takes precedence over AMBER when both fail", () => {
    const result = evaluateStoryInvest({
      ...BASE,
      storyPoints: 0,
      description: null,
    });
    expect(result.badge).toBe("RED");
  });

  it("each criterion has key, label, pass, level, hint", () => {
    const result = evaluateStoryInvest(BASE);
    for (const c of result.criteria) {
      expect(c.key).toBeTruthy();
      expect(c.label).toBeTruthy();
      expect(typeof c.pass).toBe("boolean");
      expect(["ERROR", "WARN", "INFO"]).toContain(c.level);
      expect(c.hint).toBeTruthy();
    }
  });
});
