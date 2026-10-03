import { describe, expect, it } from "vitest";
import { renderVerificationEmail } from "../index";

describe("renderVerificationEmail", () => {
  it("leva o link de verificação e o nome de quem se cadastrou", async () => {
    const html = await renderVerificationEmail({
      userName: "Ana Lima",
      verifyUrl: "https://app.nebuloz.ai/api/auth/verify-email?token=abc",
    });

    expect(html).toContain("Confirme seu e-mail");
    expect(html).toContain("Ana Lima");
    expect(html).toContain("verify-email?token=abc");
  });

  it("funciona sem nome e diz quanto o link dura", async () => {
    const html = await renderVerificationEmail({
      verifyUrl: "https://app.nebuloz.ai/api/auth/verify-email?token=abc",
    });

    expect(html).toMatch(/60(<!-- -->)? minutos/);
  });
});
