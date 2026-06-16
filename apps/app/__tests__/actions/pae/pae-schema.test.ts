import { describe, expect, it } from "vitest";
import { CreatePAERequestSchema } from "@/app/actions/pae/schema";

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
