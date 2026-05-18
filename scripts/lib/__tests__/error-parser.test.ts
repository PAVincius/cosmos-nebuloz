import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseErrors } from "../error-parser.js";

const REPO_ROOT = "/repo";

describe("parseErrors — biome", () => {
  it("extracts file, line, and rule from biome output", () => {
    const raw =
      "scripts/lib/foo.ts:42:10 lint/suspicious/noExplicitAny ━━━━\n\n  × Unexpected any.\n";
    const errors = parseErrors("biome", raw, REPO_ROOT);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(42);
    expect(errors[0].rule).toBe("lint/suspicious/noExplicitAny");
    expect(errors[0].file).toBe(path.join(REPO_ROOT, "scripts/lib/foo.ts"));
  });

  it("returns empty array for output with no errors", () => {
    const errors = parseErrors(
      "biome",
      "Checked 10 files. No errors found.",
      REPO_ROOT
    );
    expect(errors).toHaveLength(0);
  });

  it("returns at most 3 errors", () => {
    const lines = Array.from(
      { length: 10 },
      (_, i) => `apps/app/file${i}.ts:${i + 1}:1 lint/style/noVar ━━━━`
    ).join("\n");
    const errors = parseErrors("biome", lines, REPO_ROOT);
    expect(errors.length).toBeLessThanOrEqual(3);
  });
});

describe("parseErrors — typescript", () => {
  it("extracts file, line, and error code from TS output", () => {
    const raw =
      "apps/app/app/route.ts(42,10): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.";
    const errors = parseErrors("typescript", raw, REPO_ROOT);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(42);
    expect(errors[0].rule).toBe("TS2345");
    expect(errors[0].message).toContain("not assignable");
  });

  it("returns empty array for no TS errors", () => {
    const errors = parseErrors("typescript", "Found 0 errors.", REPO_ROOT);
    expect(errors).toHaveLength(0);
  });
});

describe("parseErrors — build", () => {
  it("extracts file from build error output", () => {
    const raw =
      "Error: ./apps/app/app/page.tsx\nModule not found: Can't resolve './missing'";
    const errors = parseErrors("build", raw, REPO_ROOT);
    expect(errors).toHaveLength(1);
    expect(errors[0].file).toBe(path.join(REPO_ROOT, "apps/app/app/page.tsx"));
    expect(errors[0].rule).toBe("build");
  });
});
