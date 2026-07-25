// @vitest-environment node
import { describe, expect, it } from "vitest";
import { detectPrimaryRole } from "@/app/actions/safe-copilot/roles/detect-role";

describe("detectPrimaryRole", () => {
  it("returns RTE when among roles", () => {
    expect(detectPrimaryRole(["MEMBER", "RTE"])).toBe("RTE");
  });

  it("respects priority order — ADMIN beats SM (both map to LPM > SM)", () => {
    expect(detectPrimaryRole(["SM", "ADMIN"])).toBe("LPM");
  });

  it("falls back to DEV for MEMBER", () => {
    expect(detectPrimaryRole(["MEMBER"])).toBe("DEV");
  });

  it("returns DEV for empty array", () => {
    expect(detectPrimaryRole([])).toBe("DEV");
  });

  it("STE maps to RTE", () => {
    expect(detectPrimaryRole(["STE"])).toBe("RTE");
  });
});
