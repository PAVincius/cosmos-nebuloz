import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// /legal/privacy: canal do titular que chegou por uma organização (operadora)
// e o contato do encarregado. O texto vem do dicionário (`web.legal.privacy`),
// não de componente, então o contrato se confere nos JSON.

const DICTIONARIES = resolve(
  __dirname,
  "../../../../packages/internationalization/dictionaries"
);
const CANAL = "privacy@nebuloz.ai";

type Section = { heading: string; body: string[] };
const privacy = (locale: "pt" | "en") =>
  JSON.parse(readFileSync(resolve(DICTIONARIES, `${locale}.json`), "utf-8")).web
    .legal.privacy as { sections: Section[] };

const textOf = (sections: Section[]) =>
  sections.flatMap((s) => [s.heading, ...s.body]).join("\n");

describe.each([
  ["pt", "Se seus dados chegaram até nós por uma organização", "5 dias úteis"],
  ["en", "If your data reached us through an organization", "5 business days"],
] as const)("política de privacidade (%s)", (locale, heading, prazo) => {
  const { sections } = privacy(locale);

  it("traz a seção da organização controladora com o canal e o repasse em 5 dias úteis", () => {
    const section = sections.find((s) => s.heading === heading);
    expect(section).toBeDefined();
    const text = section?.body.join("\n") ?? "";
    expect(text).toContain(CANAL);
    expect(text).toContain(prazo);
    expect(text).toContain("13.709/2018");
  });

  it("usa o canal .ai no contato do encarregado e nos direitos, sem marcador de e-mail pendente", () => {
    const text = textOf(sections);
    expect(text).toContain(CANAL);
    expect(text).not.toMatch(/DADO NECESSÁRIO: e-mail do encarregado/);
    expect(text).not.toContain("@nebuloz.com");
  });

  it("o encarregado provisório é o co-CEO Willian Magalhães Marchi, sem marcador", () => {
    const quem = sections[0]?.body.join("\n") ?? "";
    expect(quem).toContain("Willian Magalhães Marchi");
    expect(quem).toMatch(/co-CEO/);
    expect(quem).not.toMatch(/DADO NECESSÁRIO: nome completo do CEO/);
  });
});
