import { describe, expect, it } from "vitest";
import {
  WORK_FORM_LABEL,
  WORK_FORMS,
  workFormLabel,
} from "@/lib/scaffold/forms";
import { ScaffoldArchetypeEnum } from "@/lib/scaffold/schemas";

// As 5 formas do trabalho (Norte, seção c). O rótulo estava em três lugares e
// cobria 3 das 5: o seletor mostrava "ANALYSIS" cru e o filtro do portfólio só
// tinha 3 chips (Crivo F4).

describe("formas do trabalho", () => {
  it("são as cinco, na ordem do catálogo", () => {
    expect(WORK_FORMS).toEqual([
      "CONVERSATIONAL",
      "ANALYSIS",
      "DOC_REVIEW",
      "TRIAGE",
      "REPORTING",
    ]);
  });

  it("toda forma tem rótulo pt-BR, sem código cru", () => {
    for (const f of WORK_FORMS) {
      expect(WORK_FORM_LABEL[f]).toBeTruthy();
      expect(WORK_FORM_LABEL[f]).not.toBe(f);
      expect(WORK_FORM_LABEL[f]).not.toMatch(/^[A-Z_]+$/);
    }
  });

  it("o schema aceita exatamente as mesmas formas (filtro e criação não divergem)", () => {
    expect([...ScaffoldArchetypeEnum.options].sort()).toEqual(
      [...WORK_FORMS].sort()
    );
  });

  it("workFormLabel: rótulo conhecido, e o código quando a forma for nova", () => {
    expect(workFormLabel("ANALYSIS")).toBe("Análise e priorização");
    expect(workFormLabel("ALGO_NOVO")).toBe("ALGO_NOVO");
    expect(workFormLabel(null)).toBe("");
  });
});
