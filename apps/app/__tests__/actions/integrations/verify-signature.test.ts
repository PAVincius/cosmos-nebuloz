// @vitest-environment node

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  verifyGitHubSignature,
  verifyLinearSignature,
} from "../../../app/actions/integrations/webhooks/verify-signature";

const SECRET = "super-secret";

function makeSignature(body: Buffer, secret = SECRET): string {
  const hmac = createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${hmac}`;
}

describe("verifyLinearSignature", () => {
  it("returns true for a valid signature", () => {
    const body = Buffer.from(JSON.stringify({ event: "issue.created" }));
    const sig = makeSignature(body);
    expect(verifyLinearSignature(body, sig, SECRET)).toBe(true);
  });

  it("returns false for an invalid (tampered) signature", () => {
    const body = Buffer.from(JSON.stringify({ event: "issue.created" }));
    const badSig =
      "sha256=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    expect(verifyLinearSignature(body, badSig, SECRET)).toBe(false);
  });

  it("returns false when secret is wrong", () => {
    const body = Buffer.from("payload");
    const sigWithWrongSecret = makeSignature(body, "wrong-secret");
    expect(verifyLinearSignature(body, sigWithWrongSecret, SECRET)).toBe(false);
  });

  it("returns false on length mismatch (signature prefix missing)", () => {
    const body = Buffer.from("payload");
    const shortSig = "sha256=abc";
    expect(verifyLinearSignature(body, shortSig, SECRET)).toBe(false);
  });
});

describe("verifyGitHubSignature", () => {
  it("returns true for a valid signature", () => {
    const body = Buffer.from(JSON.stringify({ action: "push" }));
    const sig = makeSignature(body);
    expect(verifyGitHubSignature(body, sig, SECRET)).toBe(true);
  });

  it("returns false for an invalid (tampered) signature", () => {
    const body = Buffer.from(JSON.stringify({ action: "push" }));
    const badSig =
      "sha256=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    expect(verifyGitHubSignature(body, badSig, SECRET)).toBe(false);
  });

  it("returns false when secret is wrong", () => {
    const body = Buffer.from("payload");
    const sigWithWrongSecret = makeSignature(body, "other-secret");
    expect(verifyGitHubSignature(body, sigWithWrongSecret, SECRET)).toBe(false);
  });

  it("returns false on length mismatch (signature prefix missing)", () => {
    const body = Buffer.from("payload");
    const shortSig = "sha256=tooshort";
    expect(verifyGitHubSignature(body, shortSig, SECRET)).toBe(false);
  });
});
