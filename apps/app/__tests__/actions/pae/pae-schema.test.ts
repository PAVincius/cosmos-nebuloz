import { describe, expect, it } from "vitest";
import {
  CreatePAERequestSchema,
  durationToMs,
  ResolvePAERequestSchema,
} from "@/app/actions/pae/schema";

describe("CreatePAERequestSchema", () => {
  it("accepts valid input", () => {
    const result = CreatePAERequestSchema.safeParse({
      entityType: "Epic",
      action: "create",
      duration: "4h",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional justification", () => {
    const result = CreatePAERequestSchema.safeParse({
      entityType: "Epic",
      action: "create",
      duration: "4h",
      justification: "Sprint planning urgente",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid duration", () => {
    const result = CreatePAERequestSchema.safeParse({
      entityType: "Epic",
      action: "create",
      duration: "2h",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing entityType", () => {
    const result = CreatePAERequestSchema.safeParse({
      action: "create",
      duration: "4h",
    });
    expect(result.success).toBe(false);
  });

  it("rejects justification over 500 chars", () => {
    const result = CreatePAERequestSchema.safeParse({
      entityType: "Epic",
      action: "create",
      duration: "4h",
      justification: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe("ResolvePAERequestSchema", () => {
  it("accepts valid cuid", () => {
    const result = ResolvePAERequestSchema.safeParse({
      id: "cjld2cjxh0000qzrmn831i7rn",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty string id", () => {
    const result = ResolvePAERequestSchema.safeParse({ id: "" });
    expect(result.success).toBe(false);
  });

  it("rejects non-cuid id", () => {
    const result = ResolvePAERequestSchema.safeParse({ id: "not-a-cuid" });
    expect(result.success).toBe(false);
  });
});

describe("durationToMs", () => {
  it("1h = 3,600,000 ms", () => {
    expect(durationToMs("1h")).toBe(3_600_000);
  });

  it("4h = 14,400,000 ms", () => {
    expect(durationToMs("4h")).toBe(14_400_000);
  });

  it("8h = 28,800,000 ms", () => {
    expect(durationToMs("8h")).toBe(28_800_000);
  });

  it("24h = 86,400,000 ms", () => {
    expect(durationToMs("24h")).toBe(86_400_000);
  });
});
