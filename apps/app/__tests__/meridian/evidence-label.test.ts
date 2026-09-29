import { describe, expect, it } from "vitest";
import { evidenceLabel } from "@/lib/meridian/evidence-label";

// Ponto único do rótulo da evidência em Coleta e no gap. Hoje é o nome do
// arquivo; o Lacre decide se pode continuar assim (specs/010, Coleta).
describe("evidenceLabel", () => {
  it("usa o nome do arquivo", () => {
    expect(evidenceLabel({ fileName: "politica-dados.pdf" })).toBe(
      "politica-dados.pdf"
    );
  });
});
