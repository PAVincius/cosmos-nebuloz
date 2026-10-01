import { describe, expect, it } from "vitest";
import {
  assessmentOptionLabel,
  hasFullScoring,
} from "@/lib/scaffold/assessment-options";

// D-27: a trilha de prontidão nasce de um diagnóstico do Meridian. O seletor da
// "Nova trilha" só oferece assessment com pontuação nos cinco eixos — sem ela a
// trilha não tem o relatório, o baseline nem a leitura de confiança do A2.

const CINCO = ["DATA", "PROCESS", "PEOPLE", "GOVERNANCE", "INFRASTRUCTURE"];

describe("hasFullScoring", () => {
  it("vale só com os cinco eixos pontuados", () => {
    expect(hasFullScoring(CINCO)).toBe(true);
  });

  it("recusa assessment sem pontuação ou com eixo faltando", () => {
    expect(hasFullScoring([])).toBe(false);
    expect(hasFullScoring(CINCO.slice(0, 4))).toBe(false);
  });

  it("eixo repetido não completa o que falta", () => {
    expect(
      hasFullScoring(["DATA", "DATA", "PROCESS", "PEOPLE", "GOVERNANCE"])
    ).toBe(false);
  });
});

describe("assessmentOptionLabel", () => {
  const base = {
    code: "AS-120",
    orgName: "Atlas",
    status: "FINALISED",
    date: new Date("2026-09-30T12:00:00Z"),
  };

  it("mostra código, organização, data e estado, em português", () => {
    expect(assessmentOptionLabel(base)).toBe(
      "AS-120 · Atlas · 30/09/2026 · Finalizado"
    );
  });

  it("nomeia cada estado do Meridian", () => {
    const estado = (s: string) =>
      assessmentOptionLabel({ ...base, status: s })
        .split(" · ")
        .at(-1);
    expect(estado("DRAFT")).toBe("Rascunho");
    expect(estado("COLLECTING")).toBe("Em coleta");
    expect(estado("REVIEW")).toBe("Em revisão");
    expect(estado("FINALISED")).toBe("Finalizado");
  });

  it("estado desconhecido aparece como veio, sem inventar rótulo", () => {
    expect(assessmentOptionLabel({ ...base, status: "NOVO" })).toContain(
      "NOVO"
    );
  });

  it("a data não depende do fuso de quem renderiza", () => {
    expect(
      assessmentOptionLabel({ ...base, date: new Date("2026-01-05T23:30:00Z") })
    ).toContain("05/01/2026");
  });
});
