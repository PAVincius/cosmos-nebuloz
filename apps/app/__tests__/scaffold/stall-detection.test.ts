import { describe, expect, it } from "vitest";
import {
  DEFAULT_STALL_THRESHOLD_DAYS,
  isStalled,
  overrideRate,
  stalledDays,
} from "@/lib/scaffold/stall";

// S-09 / SN-07 — detecção de estagnação, e SG-08 — taxa de override.
//
// As duas são aritmética sobre datas e contagens, e por isso vivem em lógica
// pura: a varredura agendada e o portfólio calculam a MESMA coisa, e duas
// implementações divergiriam no primeiro arredondamento — a sidebar diria "3
// estagnadas" e a tela listaria 2.

const day = (n: number) => new Date(Date.now() - n * 86_400_000);

describe("stalledDays", () => {
  it("conta a partir do último movimento de gate", () => {
    expect(stalledDays(day(11), day(60))).toBe(11);
  });

  it("conta a partir do início quando nunca houve gate", () => {
    // Trilha parada desde o primeiro dia está parada. Tratar "sem gate" como
    // zero esconderia exatamente a que mais precisa aparecer.
    expect(stalledDays(null, day(18))).toBe(18);
  });

  it("não devolve negativo com data no futuro", () => {
    expect(stalledDays(new Date(Date.now() + 86_400_000), day(5))).toBe(0);
  });
});

describe("isStalled", () => {
  it("sinaliza no limiar, não depois dele", () => {
    // `>=`, não `>`: o limiar é "há 14 dias sem movimento", e no 14º dia já faz
    // 14 dias. Um dia a mais de silêncio é um dia a mais de ninguém saber.
    expect(isStalled(14, 14)).toBe(true);
    expect(isStalled(13, 14)).toBe(false);
  });

  it("respeita limiar customizado do tenant", () => {
    expect(isStalled(8, 7)).toBe(true);
    expect(isStalled(8, 30)).toBe(false);
  });

  it("o default é 14 dias, o mesmo do protótipo", () => {
    expect(DEFAULT_STALL_THRESHOLD_DAYS).toBe(14);
  });
});

describe("overrideRate — SG-08", () => {
  it("é a fração de gates fechados por override", () => {
    expect(overrideRate({ closed: 10, overridden: 3 })).toBe(30);
  });

  it("arredonda para inteiro — décimo de ponto percentual não muda decisão", () => {
    expect(overrideRate({ closed: 3, overridden: 1 })).toBe(33);
  });

  it("sem gate fechado, a taxa é nula e não zero", () => {
    // Zero por cento diria "ninguém dispensou critério", que é diferente de
    // "ainda não houve gate". A distinção importa para o sponsor que lê.
    expect(overrideRate({ closed: 0, overridden: 0 })).toBeNull();
  });

  it("100% quando todo gate foi override", () => {
    expect(overrideRate({ closed: 4, overridden: 4 })).toBe(100);
  });
});
