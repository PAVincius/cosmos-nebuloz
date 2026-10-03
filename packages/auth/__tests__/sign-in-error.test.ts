import { describe, expect, it } from "vitest";
import {
  EMAIL_NAO_VERIFICADO,
  SENHA_INCORRETA,
  signInErrorMessage,
} from "../sign-in-error";

describe("signInErrorMessage", () => {
  it("conta sem e-mail verificado ganha mensagem própria, não 'senha incorreta'", () => {
    expect(
      signInErrorMessage({
        code: "EMAIL_NOT_VERIFIED",
        message: "Email not verified",
        status: 403,
      })
    ).toBe(EMAIL_NAO_VERIFICADO);
    expect(EMAIL_NAO_VERIFICADO).toMatch(/e-mail/i);
    expect(EMAIL_NAO_VERIFICADO).toMatch(/link/i);
  });

  it("qualquer outro erro continua genérico, sem revelar se a conta existe", () => {
    expect(
      signInErrorMessage({
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Invalid email or password",
        status: 401,
      })
    ).toBe(SENHA_INCORRETA);
    expect(signInErrorMessage({ status: 500 })).toBe(SENHA_INCORRETA);
    expect(signInErrorMessage(null)).toBe(SENHA_INCORRETA);
  });
});
