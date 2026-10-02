import { describe, expect, it } from "vitest";
import { formatarPrazo, prazoDoDia } from "@/lib/meridian/prazo";

// Prazo do assessment (atrito A1 do dogfood, 02/10): o consultor digita
// 01/11/2026 e a tela mostra 31/10/2026. O `<input type="date">` entrega
// "2026-11-01" e o servidor gravava meia-noite UTC, que em Brasília é 21h do dia
// anterior. O prazo é um dia do calendário de Brasília: vale até o fim dele.

describe("prazoDoDia", () => {
  it("é o último instante do dia em Brasília (UTC-3), não a meia-noite UTC", () => {
    expect(prazoDoDia("2026-11-01").toISOString()).toBe(
      "2026-11-02T02:59:59.999Z"
    );
  });

  it("o dia digitado é o dia exibido, no calendário de Brasília", () => {
    expect(formatarPrazo(prazoDoDia("2026-11-01"))).toBe("01/11/2026");
    expect(formatarPrazo(prazoDoDia("2026-12-31"))).toBe("31/12/2026");
    expect(formatarPrazo(prazoDoDia("2027-01-01"))).toBe("01/01/2027");
  });

  it("recusa o que não é uma data de calendário", () => {
    for (const ruim of ["", "01/11/2026", "2026-13-01", "2026-02-30", "x"]) {
      expect(() => prazoDoDia(ruim)).toThrow();
    }
  });
});

describe("formatarPrazo", () => {
  it("mostra o dia de Brasília qualquer que seja o fuso de quem olha", () => {
    const original = process.env.TZ;
    try {
      for (const tz of ["UTC", "America/Sao_Paulo", "Asia/Tokyo"]) {
        process.env.TZ = tz;
        expect(formatarPrazo("2026-11-02T02:59:59.999Z")).toBe("01/11/2026");
      }
    } finally {
      process.env.TZ = original;
    }
  });
});
