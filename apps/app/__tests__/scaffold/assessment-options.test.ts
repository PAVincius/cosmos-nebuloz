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

  // O relatório do assessment mostra a data em America/Sao_Paulo; o seletor tem
  // de dizer o mesmo dia, não o dia em UTC (01/10 onde o relatório diz 30/09).
  it("a data é a de America/Sao_Paulo, a mesma do relatório, e não a UTC", () => {
    const dia = (iso: string) =>
      assessmentOptionLabel({ ...base, date: new Date(iso) }).split(" · ")[2];
    // 02:00 UTC de 01/10 ainda é 23:00 de 30/09 em Brasília.
    expect(dia("2026-10-01T02:00:00Z")).toBe("30/09/2026");
    // 03:30 UTC de 01/10 já é 00:30 de 01/10 em Brasília.
    expect(dia("2026-10-01T03:30:00Z")).toBe("01/10/2026");
    expect(dia("2026-09-30T12:00:00Z")).toBe("30/09/2026");
    expect(dia("2026-01-05T23:30:00Z")).toBe("05/01/2026");
  });

  it("não muda com o fuso de quem renderiza", () => {
    const original = process.env.TZ;
    try {
      for (const tz of ["UTC", "Asia/Tokyo", "America/Los_Angeles"]) {
        process.env.TZ = tz;
        expect(
          assessmentOptionLabel({
            ...base,
            date: new Date("2026-10-01T02:00:00Z"),
          })
        ).toContain("30/09/2026");
      }
    } finally {
      process.env.TZ = original;
    }
  });
});
