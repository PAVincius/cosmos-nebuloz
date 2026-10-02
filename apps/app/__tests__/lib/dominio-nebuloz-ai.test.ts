import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// O domínio migrou para .ai (produção: app.nebuloz.ai e nebuloz.ai). Estes dois
// pontos ficaram em .com depois da troca dos e-mails: o exemplo de APP_URL do
// seed (a URL de aceite do convite sai com ele) e o link do rodapé do e-mail
// de convite, que é o que o convidado clica. Falha se o .com voltar.

const ROOT = resolve(__dirname, "../../../..");
const read = (file: string) => readFileSync(resolve(ROOT, file), "utf-8");

describe("domínio .ai nos pontos que o convidado e o operador usam", () => {
  it("seed-nebuloz: o exemplo de APP_URL aponta para app.nebuloz.ai", () => {
    const seed = read("apps/app/scripts/seed-nebuloz.ts");
    expect(seed).toContain('APP_URL="https://app.nebuloz.ai"');
    expect(seed).not.toMatch(/nebuloz\.com/i);
  });

  it("e-mail de convite: o link e o texto do rodapé são nebuloz.ai", () => {
    const invite = read("packages/email/templates/invite.tsx");
    expect(invite).toContain('href="https://nebuloz.ai"');
    expect(invite).toMatch(/>\s*nebuloz\.ai\s*</);
    expect(invite).not.toMatch(/nebuloz\.com/i);
  });
});
