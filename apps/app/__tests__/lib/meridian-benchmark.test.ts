import { describe, expect, it } from "vitest";
import {
  BENCH_THRESHOLD,
  cohortKeyOf,
  percentiles,
  readCohort,
} from "@/lib/meridian/benchmark";

// FR-033/FR-034. O ponto de corte é a leitura, e é aqui — não na renderização.
// Um teste que só checasse a tela deixaria a action devolvendo os percentis,
// que é exatamente o vazamento que o limiar existe para impedir.

describe("cohortKeyOf", () => {
  it("compõe setor e faixa em minúsculas, sem acento", () => {
    expect(cohortKeyOf("Saúde", "200–1.000")).toBe("saude · 200–1.000");
  });

  it("é estável para variações de caixa e espaço", () => {
    expect(cohortKeyOf("  FINTECH ", "50–200")).toBe(
      cohortKeyOf("Fintech", "50–200")
    );
  });
});

describe("percentiles", () => {
  it("interpola linearmente", () => {
    expect(percentiles([10, 20, 30, 40, 50])).toEqual({
      p25: 20,
      p50: 30,
      p75: 40,
    });
  });

  it("não depende da ordem de entrada", () => {
    expect(percentiles([50, 10, 40, 20, 30])).toEqual(
      percentiles([10, 20, 30, 40, 50])
    );
  });

  it("devolve o próprio valor para amostra de um", () => {
    expect(percentiles([42])).toEqual({ p25: 42, p50: 42, p75: 42 });
  });

  it("devolve zeros para amostra vazia", () => {
    expect(percentiles([])).toEqual({ p25: 0, p50: 0, p75: 0 });
  });
});

describe("readCohort", () => {
  const bands = {
    DATA: { p25: 38, p50: 52, p75: 64 },
    PROCESS: { p25: 44, p50: 55, p75: 68 },
    PEOPLE: { p25: 30, p50: 42, p75: 55 },
    GOVERNANCE: { p25: 41, p50: 57, p75: 71 },
    INFRASTRUCTURE: { p25: 40, p50: 53, p75: 66 },
  };

  it("retém a leitura abaixo do limiar e não devolve percentil algum", () => {
    const read = readCohort({ cohortKey: "agro · 200–1.000", n: 3, bands });
    expect(read.withheld).toBe(true);
    expect(JSON.stringify(read)).not.toContain("p50");
  });

  it("libera a leitura no limiar exato", () => {
    const read = readCohort({ cohortKey: "x", n: BENCH_THRESHOLD, bands });
    expect(read.withheld).toBe(false);
    expect(read.withheld === false && read.bands.DATA.p50).toBe(52);
  });

  it("retém quando o agregado ainda não existe", () => {
    const read = readCohort({ cohortKey: "novo", n: 9, bands: null });
    expect(read.withheld).toBe(true);
  });

  it("informa n mesmo quando retém — é o que a UI explica ao usuário", () => {
    expect(readCohort({ cohortKey: "agro", n: 3, bands }).n).toBe(3);
  });
});
