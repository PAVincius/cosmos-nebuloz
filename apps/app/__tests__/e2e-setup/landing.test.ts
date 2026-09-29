import { describe, expect, it } from "vitest";
import { isPostLoginLanding } from "../../e2e/setup/landing";

const BASE = "http://localhost:3012";

describe("isPostLoginLanding", () => {
  it.each([
    "/",
    "/produto",
    "/dashboard",
    "/portfolio",
    "/meridian",
    "/scaffold",
    "/cosmos",
    "/signal",
    "/charter",
    "/cosmos/dashboard",
    "/meridian/",
    "/charter?welcome=1",
  ])("aceita %s", (path) => {
    expect(isPostLoginLanding(`${BASE}${path}`)).toBe(true);
  });

  it.each([
    "/sign-in",
    "/sign-in?redirect=/meridian",
    "/sign-up",
    "/forgot-password",
    "/meridianx",
    "/outro/meridian",
    "/api/auth/callback",
  ])("recusa %s", (path) => {
    expect(isPostLoginLanding(`${BASE}${path}`)).toBe(false);
  });

  it("recusa URL inválida sem lançar", () => {
    expect(isPostLoginLanding("nao-e-url")).toBe(false);
  });
});
