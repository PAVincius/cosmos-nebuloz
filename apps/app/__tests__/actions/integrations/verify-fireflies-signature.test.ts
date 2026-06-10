// @vitest-environment node

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyFirefliesSignature } from "@/app/actions/integrations/webhooks/verify-signature";

const SECRET = "fireflies-webhook-secret";

function sign(body: Buffer, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

describe("verifyFirefliesSignature", () => {
  const body = Buffer.from(
    JSON.stringify({
      meetingId: "ASxwZxCstx",
      eventType: "Transcription completed",
      clientReferenceId: "be582c46-4ac9-4565-9ba6-6ab4264496a8",
    })
  );

  it("accepts a valid sha256 signature", () => {
    expect(verifyFirefliesSignature(body, sign(body, SECRET), SECRET)).toBe(
      true
    );
  });

  it("rejects a signature computed with the wrong secret", () => {
    expect(
      verifyFirefliesSignature(body, sign(body, "wrong-secret"), SECRET)
    ).toBe(false);
  });

  it("rejects a tampered body", () => {
    const tampered = Buffer.from(body.toString().replace("ASxwZxCstx", "EVIL"));
    expect(verifyFirefliesSignature(tampered, sign(body, SECRET), SECRET)).toBe(
      false
    );
  });

  it("rejects an empty/malformed signature without throwing", () => {
    expect(verifyFirefliesSignature(body, "", SECRET)).toBe(false);
  });
});
