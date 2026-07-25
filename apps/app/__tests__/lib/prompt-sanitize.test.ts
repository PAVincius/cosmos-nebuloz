// @vitest-environment node

import { describe, expect, it } from "vitest";
import { sanitizeForPrompt } from "../../lib/prompt-sanitize";

describe("sanitizeForPrompt", () => {
  it("returns empty string for null", () => {
    expect(sanitizeForPrompt(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(sanitizeForPrompt(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(sanitizeForPrompt("")).toBe("");
  });

  it("strips C0 control characters", () => {
    // \x00-\x08, \x0B, \x0C, \x0E-\x1F, \x7F
    const withControl = "hello\x00\x01\x07\x0B\x0C\x1F\x7Fworld";
    expect(sanitizeForPrompt(withControl)).toBe("helloworld");
  });

  it("replaces < with ‹ and > with ›", () => {
    expect(sanitizeForPrompt("<script>alert('xss')</script>")).toBe(
      "‹script›alert('xss')‹/script›"
    );
  });

  it("leaves normal text unchanged", () => {
    expect(sanitizeForPrompt("Hello, world!")).toBe("Hello, world!");
  });

  it("trims leading and trailing whitespace", () => {
    expect(sanitizeForPrompt("  hello  ")).toBe("hello");
  });

  it("preserves tab and newline (not stripped)", () => {
    // \t is \x09, \n is \x0A — both are allowed (not in the stripped range)
    expect(sanitizeForPrompt("line1\nline2")).toBe("line1\nline2");
  });
});
