import { describe, expect, it } from "vitest";
import {
  COMMENT_REQUIRED,
  countsInVerdict,
  filterPlan,
  formatMetricValue,
  nextStateFor,
  PLAN_STATE_META,
  planActionDenial,
  targetEditable,
} from "@/lib/signal/plan";

// Regras do plano de medição (SG-PO-02/03/05 do Norte, 2026-09-29).
// A matriz de quem transita vive aqui, pura, para a action e a tela lerem a
// mesma resposta.

describe("nextStateFor — máquina de estados", () => {
  it("aprovar leva Proposta a Sem fonte", () => {
    expect(nextStateFor("PROPOSED", "approve")).toBe("NO_SOURCE");
  });

  it("pausar só vale para Medindo e retomar só para Pausada", () => {
    expect(nextStateFor("MEASURING", "pause")).toBe("PAUSED");
    expect(nextStateFor("PAUSED", "resume")).toBe("MEASURING");
    expect(nextStateFor("NO_SOURCE", "pause")).toBeNull();
    expect(nextStateFor("FROZEN", "pause")).toBeNull();
    expect(nextStateFor("MEASURING", "resume")).toBeNull();
  });

  it("aprovar métrica que não é proposta é inválido", () => {
    for (const s of ["NO_SOURCE", "MEASURING", "PAUSED", "FROZEN"] as const) {
      expect(nextStateFor(s, "approve")).toBeNull();
    }
  });

  it("pedir revisão de meta só existe para métrica congelada", () => {
    expect(nextStateFor("FROZEN", "requestTargetReview")).toBe("FROZEN");
    expect(nextStateFor("MEASURING", "requestTargetReview")).toBeNull();
  });
});

describe("planActionDenial — quem transita", () => {
  it("OWNER e ANALYST decidem; VIEWER e ADMIN não", () => {
    for (const action of ["approve", "pause", "resume"] as const) {
      expect(planActionDenial("OWNER", action)).toBeNull();
      expect(planActionDenial("ANALYST", action)).toBeNull();
      expect(planActionDenial("VIEWER", action)).not.toBeNull();
      // administrar acesso não é decidir (SG-PO-03)
      expect(planActionDenial("ADMIN", action)).not.toBeNull();
    }
  });

  it("propor e editar seguem a mesma regra de quem decide", () => {
    expect(planActionDenial("ADMIN", "propose")).not.toBeNull();
    expect(planActionDenial("OWNER", "edit")).toBeNull();
  });

  it("o motivo da negativa nomeia o papel", () => {
    expect(planActionDenial("ADMIN", "approve")).toMatch(/Administrador/);
  });
});

describe("regras de conteúdo", () => {
  it("pausar, retomar e pedir revisão exigem comentário", () => {
    expect(COMMENT_REQUIRED).toEqual(
      expect.arrayContaining(["pause", "resume", "requestTargetReview"])
    );
    expect(COMMENT_REQUIRED).not.toContain("approve");
  });

  it("congelada não edita meta; as outras editam", () => {
    expect(targetEditable("FROZEN")).toBe(false);
    for (const s of ["PROPOSED", "NO_SOURCE", "MEASURING", "PAUSED"] as const) {
      expect(targetEditable(s)).toBe(true);
    }
  });

  it("proposta fica fora do veredito até ser aprovada", () => {
    expect(countsInVerdict("PROPOSED")).toBe(false);
    expect(countsInVerdict("NO_SOURCE")).toBe(true);
    expect(countsInVerdict("MEASURING")).toBe(true);
    expect(countsInVerdict("FROZEN")).toBe(true);
  });

  it("todo estado tem rótulo e tom", () => {
    for (const s of [
      "PROPOSED",
      "NO_SOURCE",
      "MEASURING",
      "PAUSED",
      "FROZEN",
    ] as const) {
      expect(PLAN_STATE_META[s].label.length).toBeGreaterThan(0);
      expect(PLAN_STATE_META[s].tone.length).toBeGreaterThan(0);
    }
  });
});

describe("filterPlan", () => {
  const rows = [
    { id: "a", role: "PRIMARY", state: "MEASURING" },
    { id: "b", role: "GUARD", state: "NO_SOURCE" },
    { id: "c", role: "GUARD", state: "PROPOSED" },
  ] as const;

  it("sem filtro devolve tudo", () => {
    expect(filterPlan(rows, {})).toHaveLength(3);
  });

  it("filtra por papel, por estado e pelos dois", () => {
    expect(filterPlan(rows, { role: "GUARD" }).map((r) => r.id)).toEqual([
      "b",
      "c",
    ]);
    expect(filterPlan(rows, { state: "PROPOSED" }).map((r) => r.id)).toEqual([
      "c",
    ]);
    expect(
      filterPlan(rows, { role: "GUARD", state: "NO_SOURCE" }).map((r) => r.id)
    ).toEqual(["b"]);
  });
});

describe("formatMetricValue", () => {
  it("nulo vira traço; número usa vírgula decimal", () => {
    expect(formatMetricValue(null)).toBe("—");
    expect(formatMetricValue(0.72)).toBe("0,72");
    expect(formatMetricValue(1500)).toBe("1.500");
  });
});
