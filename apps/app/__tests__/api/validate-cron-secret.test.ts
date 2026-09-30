import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateCronSecret } from "@/app/api/cron/_utils/validate-cron-secret";

// A Vercel Cron chama a rota com `Authorization: Bearer <CRON_SECRET>`.
// O validador comparava o header cru com o segredo e recusava toda chamada
// real da Vercel (ADR-0021, achado do Pilar).

const original = process.env.CRON_SECRET;

beforeEach(() => {
  process.env.CRON_SECRET = "s3cret-value";
});

afterEach(() => {
  process.env.CRON_SECRET = original;
});

describe("validateCronSecret", () => {
  it("aceita o formato que a Vercel envia: Bearer <segredo>", () => {
    expect(validateCronSecret("Bearer s3cret-value")).toBe(true);
  });

  it("recusa segredo errado, com ou sem Bearer", () => {
    expect(validateCronSecret("Bearer outro-valor!")).toBe(false);
    expect(validateCronSecret("outro-valor!")).toBe(false);
  });

  it("recusa header ausente ou vazio", () => {
    expect(validateCronSecret(null)).toBe(false);
    expect(validateCronSecret("")).toBe(false);
    expect(validateCronSecret("Bearer ")).toBe(false);
  });

  it("recusa tudo quando CRON_SECRET não está configurado", () => {
    process.env.CRON_SECRET = "";
    expect(validateCronSecret("Bearer ")).toBe(false);
    expect(validateCronSecret("Bearer undefined")).toBe(false);
  });

  it("recusa outros esquemas de autorização", () => {
    expect(validateCronSecret("Basic s3cret-value")).toBe(false);
  });
});
