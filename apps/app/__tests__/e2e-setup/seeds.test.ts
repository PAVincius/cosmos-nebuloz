import { describe, expect, it } from "vitest";
import { E2E_TENANT_SLUG, SEEDS } from "../../e2e/setup/seeds";

describe("SEEDS do globalSetup", () => {
  it("seed:charter recebe o tenant do e2e, não o padrão medcore", () => {
    expect(SEEDS).toContain(`seed:charter ${E2E_TENANT_SLUG}`);
    expect(SEEDS).not.toContain("seed:charter");
  });

  it("seed:meridian usa o mesmo tenant", () => {
    expect(SEEDS).toContain(`seed:meridian ${E2E_TENANT_SLUG}`);
  });

  it("nenhum seed de tenant fica sem slug", () => {
    for (const seed of SEEDS) {
      if (/^seed:(charter|meridian)\b/.test(seed)) {
        expect(seed.split(" ")).toHaveLength(2);
      }
    }
  });

  it("o tenant do e2e é o do banco local", () => {
    expect(E2E_TENANT_SLUG).toBe("cosmos-dev");
  });

  it("roda o seed base antes dos que dependem dele", () => {
    expect(SEEDS[0]).toBe("seed:e2e");
  });
});
