// data.test.ts — crítica rodada 4 (P1): 24 chamadas `toLocale*String("pt-BR")`
// sem `timeZone` no backoffice. Em Vercel (UTC) o "quando" da trilha de
// auditoria saía 3h adiantado; no cliente, mismatch de hidratação. O helper
// fixa o fuso do painel em America/Sao_Paulo — a ISO em UTC abaixo cai na
// véspera às 23:30, prova de que o fuso está sendo aplicado.
import { describe, expect, it } from "vitest";
import {
  FUSO_DO_PAINEL,
  formatarData,
  formatarDataHora,
  formatarHora,
} from "@/lib/data";

const ISO_UTC = "2026-09-19T02:30:00.000Z";

describe("lib/data — fuso fixo do painel", () => {
  it("expõe o fuso como constante", () => {
    expect(FUSO_DO_PAINEL).toBe("America/Sao_Paulo");
  });

  it("formatarDataHora converte UTC para o horário de Brasília (véspera, 23:30)", () => {
    expect(formatarDataHora(ISO_UTC)).toBe("18/09/2026 23:30");
  });

  it("formatarData devolve só a data no fuso do painel", () => {
    expect(formatarData(ISO_UTC)).toBe("18/09/2026");
  });

  it("formatarHora devolve só a hora no fuso do painel", () => {
    expect(formatarHora(ISO_UTC)).toBe("23:30");
  });

  it("Date e string ISO dão o mesmo resultado", () => {
    expect(formatarDataHora(new Date(ISO_UTC))).toBe(formatarDataHora(ISO_UTC));
    expect(formatarData(new Date(ISO_UTC))).toBe(formatarData(ISO_UTC));
    expect(formatarHora(new Date(ISO_UTC))).toBe(formatarHora(ISO_UTC));
  });

  it("devolve travessão para vazio ou inválido", () => {
    for (const fn of [formatarDataHora, formatarData, formatarHora]) {
      expect(fn(null)).toBe("—");
      expect(fn(undefined)).toBe("—");
      expect(fn("")).toBe("—");
      expect(fn("não é data")).toBe("—");
      expect(fn(new Date("inválida"))).toBe("—");
    }
  });
});
