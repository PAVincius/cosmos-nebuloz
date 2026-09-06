// empresa-periodo.test.ts — o que o usuário escolhe são dias; o que a leitura
// usa são meses inteiros e segundas-feiras. Tetos recusam, não truncam.
import { describe, expect, it } from "vitest";
import {
  competenciasNoIntervalo,
  formatarDataBr,
  IntervaloExcedido,
  intervaloPadraoCaixa,
  intervaloPadraoCompetencia,
  intervaloValido,
  lerIntervaloDaUrl,
  PRESETS_CAIXA,
  PRESETS_COMPETENCIA,
  rotuloDoIntervalo,
  segundasNoIntervalo,
} from "../lib/empresa/periodo";

const HOJE = new Date("2026-09-06T15:00:00Z"); // domingo

describe("competenciasNoIntervalo", () => {
  it("lista os meses tocados, inclusive parciais", () => {
    expect(
      competenciasNoIntervalo({ de: "2026-07-01", ate: "2026-09-15" })
    ).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(
      competenciasNoIntervalo({ de: "2026-09-06", ate: "2026-09-06" })
    ).toEqual(["2026-09"]);
  });
  it("atravessa a virada de ano", () => {
    expect(
      competenciasNoIntervalo({ de: "2025-11-20", ate: "2026-01-03" })
    ).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
  it("aceita 12 meses e recusa 13", () => {
    expect(
      competenciasNoIntervalo({ de: "2025-10-01", ate: "2026-09-30" })
    ).toHaveLength(12);
    expect(() =>
      competenciasNoIntervalo({ de: "2025-09-01", ate: "2026-09-30" })
    ).toThrow(IntervaloExcedido);
  });
});

describe("segundasNoIntervalo", () => {
  it("começa na segunda da semana do `de` e vai até o `ate`", () => {
    expect(
      segundasNoIntervalo({ de: "2026-09-06", ate: "2026-09-20" })
    ).toEqual(["2026-08-31", "2026-09-07", "2026-09-14"]);
  });
  it("aceita 26 semanas e recusa 27", () => {
    expect(
      segundasNoIntervalo({ de: "2026-08-31", ate: "2027-02-28" })
    ).toHaveLength(26);
    expect(() =>
      segundasNoIntervalo({ de: "2026-08-31", ate: "2027-03-07" })
    ).toThrow(IntervaloExcedido);
  });
});

describe("padrões", () => {
  it("competência: últimos 3 meses, do dia 1 ao último dia do mês corrente", () => {
    expect(intervaloPadraoCompetencia(HOJE)).toEqual({
      de: "2026-07-01",
      ate: "2026-09-30",
    });
  });
  it("caixa: da segunda corrente ao domingo da 13ª semana", () => {
    expect(intervaloPadraoCaixa(HOJE)).toEqual({
      de: "2026-08-31",
      ate: "2026-11-29",
    });
  });
});

describe("presets e rótulo", () => {
  it("os presets de competência batem com os padrões", () => {
    const tres = PRESETS_COMPETENCIA.find((p) => p.id === "ultimos-3-meses");
    expect(tres?.intervalo(HOJE)).toEqual(intervaloPadraoCompetencia(HOJE));
    const mes = PRESETS_COMPETENCIA.find((p) => p.id === "este-mes");
    expect(mes?.intervalo(HOJE)).toEqual({
      de: "2026-09-01",
      ate: "2026-09-30",
    });
    const passado = PRESETS_COMPETENCIA.find((p) => p.id === "mes-passado");
    expect(passado?.intervalo(HOJE)).toEqual({
      de: "2026-08-01",
      ate: "2026-08-31",
    });
    const tri = PRESETS_COMPETENCIA.find((p) => p.id === "trimestre-atual");
    expect(tri?.intervalo(HOJE)).toEqual({
      de: "2026-07-01",
      ate: "2026-09-30",
    });
    const ano = PRESETS_COMPETENCIA.find((p) => p.id === "este-ano");
    expect(ano?.intervalo(HOJE)).toEqual({
      de: "2026-01-01",
      ate: "2026-12-31",
    });
  });
  it("os presets de caixa", () => {
    expect(
      PRESETS_CAIXA.find((p) => p.id === "proximas-13")?.intervalo(HOJE)
    ).toEqual(intervaloPadraoCaixa(HOJE));
    expect(
      PRESETS_CAIXA.find((p) => p.id === "proximas-26")?.intervalo(HOJE)
    ).toEqual({ de: "2026-08-31", ate: "2027-02-28" });
  });
  it("rótulo usa o nome do preset quando bate, senão as datas", () => {
    expect(
      rotuloDoIntervalo(
        { de: "2026-07-01", ate: "2026-09-30" },
        PRESETS_COMPETENCIA,
        HOJE
      )
    ).toBe("Últimos 3 meses");
    expect(
      rotuloDoIntervalo(
        { de: "2026-07-03", ate: "2026-09-30" },
        PRESETS_COMPETENCIA,
        HOJE
      )
    ).toBe("03/07/2026 – 30/09/2026");
  });
});

describe("URL", () => {
  const padrao = { de: "2026-07-01", ate: "2026-09-30" };
  it("lê de/ate válidos", () => {
    expect(
      lerIntervaloDaUrl({ de: "2026-01-01", ate: "2026-02-28" }, padrao)
    ).toEqual({ de: "2026-01-01", ate: "2026-02-28" });
  });
  it("ausente, inválido ou invertido cai no padrão", () => {
    expect(lerIntervaloDaUrl({}, padrao)).toEqual(padrao);
    expect(
      lerIntervaloDaUrl({ de: "ontem", ate: "2026-02-28" }, padrao)
    ).toEqual(padrao);
    expect(
      lerIntervaloDaUrl({ de: "2026-03-01", ate: "2026-02-28" }, padrao)
    ).toEqual(padrao);
    expect(intervaloValido({ de: "2026-02-30", ate: "2026-03-01" })).toBe(
      false
    );
  });
  it("formata dd/mm/aaaa", () => {
    expect(formatarDataBr("2026-09-06")).toBe("06/09/2026");
  });
});
