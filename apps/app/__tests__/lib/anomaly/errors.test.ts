import { describe, expect, it } from "vitest";
import { safeAction } from "@/app/actions/_base";
import { AnomalyRuleError } from "@/lib/anomaly/errors";

// `UNKNOWN_RULE` e `CRITICAL_RULE_NON_DISABLABLE` eram `new Error(...)` soltos
// (achado do Vigia, #326): agora são erro de domínio nomeado, com a regra no
// code para o cliente distinguir a recusa sem ler o texto.
describe("AnomalyRuleError", () => {
  it("mantém a mensagem e expõe a regra no code do Result", async () => {
    const result = await safeAction(() =>
      Promise.reject(
        new AnomalyRuleError("UNKNOWN_RULE: R-X-99", "anomaly.unknown-rule")
      )
    );
    expect(result).toEqual({
      ok: false,
      error: "UNKNOWN_RULE: R-X-99",
      code: "anomaly.unknown-rule",
    });
  });

  it("é um Error com nome próprio", () => {
    const e = new AnomalyRuleError("m", "anomaly.critical-non-disablable");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("AnomalyRuleError");
  });
});
