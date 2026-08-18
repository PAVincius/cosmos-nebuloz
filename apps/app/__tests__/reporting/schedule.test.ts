import { describe, expect, it } from "vitest";
import { isDue, previousFireTime } from "@/lib/reporting/schedule";

// Relatório diário às 08:00. Todas as datas abaixo são UTC salvo indicação.
const DIARIO_8H = "0 8 * * *";

describe("previousFireTime", () => {
  it("resolve o disparo anterior no timezone do relatório", () => {
    // 2026-03-10T12:00Z é 09:00 em São Paulo (UTC-3), então o disparo das
    // 08:00 locais já passou hoje: 2026-03-10T11:00Z.
    const now = new Date("2026-03-10T12:00:00Z");

    const anterior = previousFireTime(
      { cronExpression: DIARIO_8H, timezone: "America/Sao_Paulo" },
      now
    );

    expect(anterior?.toISOString()).toBe("2026-03-10T11:00:00.000Z");
  });

  it("resolve o mesmo cron em UTC num instante diferente", () => {
    const now = new Date("2026-03-10T12:00:00Z");

    const anterior = previousFireTime(
      { cronExpression: DIARIO_8H, timezone: "UTC" },
      now
    );

    expect(anterior?.toISOString()).toBe("2026-03-10T08:00:00.000Z");
  });

  it("devolve null para expressão inválida em vez de lançar", () => {
    const anterior = previousFireTime(
      { cronExpression: "isto não é cron", timezone: "UTC" },
      new Date("2026-03-10T12:00:00Z")
    );

    expect(anterior).toBeNull();
  });

  it("devolve null para timezone inválido em vez de lançar", () => {
    const anterior = previousFireTime(
      { cronExpression: DIARIO_8H, timezone: "Marte/Olympus" },
      new Date("2026-03-10T12:00:00Z")
    );

    expect(anterior).toBeNull();
  });
});

describe("isDue", () => {
  const now = new Date("2026-03-10T12:00:00Z");
  const base = { cronExpression: DIARIO_8H, timezone: "UTC" };

  it("vence quando nunca rodou", () => {
    expect(isDue({ ...base, lastRunAt: null }, now)).toBe(true);
  });

  it("vence quando a última execução é anterior ao disparo mais recente", () => {
    const ontem = new Date("2026-03-09T08:00:00Z");
    expect(isDue({ ...base, lastRunAt: ontem }, now)).toBe(true);
  });

  it("NÃO vence quando já rodou depois do disparo mais recente", () => {
    // Disparo mais recente: 2026-03-10T08:00Z. Já rodou 08:01.
    const hoje = new Date("2026-03-10T08:01:00Z");
    expect(isDue({ ...base, lastRunAt: hoje }, now)).toBe(false);
  });

  it("NÃO vence quando lastRunAt é exatamente o disparo", () => {
    const exato = new Date("2026-03-10T08:00:00Z");
    expect(isDue({ ...base, lastRunAt: exato }, now)).toBe(false);
  });

  it("NÃO vence quando a expressão é inválida", () => {
    expect(
      isDue(
        { cronExpression: "quebrado", timezone: "UTC", lastRunAt: null },
        now
      )
    ).toBe(false);
  });
});
