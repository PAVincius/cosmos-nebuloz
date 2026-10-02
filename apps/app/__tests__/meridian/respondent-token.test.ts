import { describe, expect, it } from "vitest";
import { formatarPrazo, prazoDoDia } from "@/lib/meridian/prazo";
import { calcularExpiracaoDaReemissao } from "@/lib/meridian/respondent-token";

// calcularExpiracaoDaReemissao — spec 006, FR-006. Fixa a expiração do token
// reemitido em min(agora + 14 dias, deadline do assessment), sem recalcular
// depois. Achado P2 do Vigia (atrito.md:42): `assignRespondent` copia
// `assessment.deadline`, então estender o prazo depois dá vida extra
// silenciosa aos tokens já emitidos — a reemissão fixa na hora pra não
// repetir o mesmo problema.

const DIA_MS = 24 * 60 * 60 * 1000;

describe("calcularExpiracaoDaReemissao", () => {
  it("usa agora + 14 dias quando o deadline está mais longe que isso", () => {
    const agora = new Date("2026-09-26T00:00:00.000Z");
    const deadline = new Date("2026-12-31T00:00:00.000Z");
    const result = calcularExpiracaoDaReemissao(deadline, agora);
    expect(result.getTime()).toBe(agora.getTime() + 14 * DIA_MS);
  });

  it("usa o deadline quando ele chega antes dos 14 dias", () => {
    const agora = new Date("2026-09-26T00:00:00.000Z");
    const deadline = new Date("2026-09-30T00:00:00.000Z");
    const result = calcularExpiracaoDaReemissao(deadline, agora);
    expect(result.getTime()).toBe(deadline.getTime());
  });

  it("no empate exato, o valor é o mesmo (min é idempotente)", () => {
    const agora = new Date("2026-09-26T00:00:00.000Z");
    const deadline = new Date(agora.getTime() + 14 * DIA_MS);
    const result = calcularExpiracaoDaReemissao(deadline, agora);
    expect(result.getTime()).toBe(deadline.getTime());
  });
});

// Atrito A1, lado do respondente: o token expira no deadline do assessment. Com o
// prazo gravado como meia-noite UTC, o link morria às 21h de Brasília do dia
// ANTERIOR ao prazo digitado. O deadline de "01/11" vale até o fim de 01/11.
describe("expiração do token com o prazo do assessment em Brasília", () => {
  it("o token do último dia ainda vale às 23h do dia do prazo", () => {
    const agora = new Date("2026-10-30T12:00:00.000Z");
    const deadline = prazoDoDia("2026-11-01");
    const expira = calcularExpiracaoDaReemissao(deadline, agora);
    // 01/11 23:00 em Brasília = 02/11 02:00Z
    expect(expira.getTime()).toBeGreaterThan(
      new Date("2026-11-02T02:00:00.000Z").getTime()
    );
    expect(formatarPrazo(expira)).toBe("01/11/2026");
  });
});
