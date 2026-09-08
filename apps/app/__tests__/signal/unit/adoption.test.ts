import { describe, expect, it } from "vitest";
import {
  adoptionPct,
  computeAdoption,
  fmtAdoption,
} from "@/lib/signal/adoption";
import { round1 } from "@/lib/signal/roi";
import { INITIATIVES } from "../fixtures";

const d = (iso: string) => new Date(iso);

describe("percentual de adoção", () => {
  it.each(
    INITIATIVES.map((i) => [i.code, i] as const)
  )("%s bate com o handoff", (_code, fixture) => {
    expect(round1(adoptionPct(fixture.adoption))).toBe(
      fixture.expected.adoptionPct
    );
  });

  it("base licenciada zero devolve 0, não NaN", () => {
    // NaN vazaria para a tela como "NaN%" na primeira iniciativa em rascunho.
    const pct = adoptionPct({ activeUsers: 0, licensedUsers: 0 });
    expect(pct).toBe(0);
    expect(Number.isNaN(pct)).toBe(false);
  });

  it("base negativa (dado corrompido) também devolve 0, não percentual negativo", () => {
    expect(adoptionPct({ activeUsers: 5, licensedUsers: -3 })).toBe(0);
  });

  it("adoção total é 100%", () => {
    expect(adoptionPct({ activeUsers: 18, licensedUsers: 18 })).toBe(100);
  });
});

describe("série de adoção", () => {
  const snapshots = [
    { periodStart: d("2026-06-01"), activeUsers: 4, licensedUsers: 18 },
    { periodStart: d("2026-07-01"), activeUsers: 9, licensedUsers: 18 },
    {
      periodStart: d("2026-08-01"),
      activeUsers: 14,
      licensedUsers: 18,
      frequencyLabel: "9,4 usos/semana",
      depthNote: "usa em 3 dos 4 passos do fluxo",
    },
  ];

  it("usa o período mais recente como valor corrente", () => {
    const result = computeAdoption(snapshots);
    expect(result.activeUsers).toBe(14);
    expect(round1(result.pct)).toBe(77.8);
  });

  it("ordena por período, mesmo recebendo fora de ordem", () => {
    const shuffled = [
      snapshots[2],
      snapshots[0],
      snapshots[1],
    ] as typeof snapshots;
    const result = computeAdoption(shuffled);
    expect(result.activeUsers).toBe(14);
    expect(result.trend.map(Math.round)).toEqual([22, 50, 78]);
  });

  it("calcula a variação em pontos percentuais contra o período anterior", () => {
    const result = computeAdoption(snapshots);
    expect(round1(result.deltaPoints as number)).toBe(27.8); // 77,8 − 50,0
  });

  it("uma única medição não tem tendência", () => {
    // Inventar delta 0 sugeriria estabilidade onde não há série.
    const result = computeAdoption([snapshots[0] as (typeof snapshots)[0]]);
    expect(result.deltaPoints).toBeNull();
  });

  it("adoção em queda devolve delta negativo", () => {
    const falling = [
      { periodStart: d("2026-06-01"), activeUsers: 10, licensedUsers: 38 },
      { periodStart: d("2026-07-01"), activeUsers: 8, licensedUsers: 38 },
    ];
    expect(computeAdoption(falling).deltaPoints).toBeLessThan(0);
  });

  it("sem snapshot devolve estado vazio coerente", () => {
    expect(computeAdoption([])).toEqual({
      pct: 0,
      activeUsers: 0,
      licensedUsers: 0,
      frequencyLabel: null,
      depthNote: null,
      trend: [],
      deltaPoints: null,
    });
  });

  it("preserva frequência e profundidade do período corrente", () => {
    const result = computeAdoption(snapshots);
    expect(result.frequencyLabel).toBe("9,4 usos/semana");
    // Profundidade é qualitativa de propósito: vale mais que um número inventado.
    expect(result.depthNote).toBe("usa em 3 dos 4 passos do fluxo");
  });
});

describe("formatação", () => {
  it("apresenta inteiro, como a lista e o card do handoff", () => {
    expect(fmtAdoption(77.8)).toBe("78%");
    expect(fmtAdoption(0)).toBe("0%");
  });
});
