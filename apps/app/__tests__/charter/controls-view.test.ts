import { describe, expect, it } from "vitest";
import {
  CONTROL_STATE_META,
  controlActionsFor,
  expiryWarning,
  filterControls,
  notApplicableLabel,
  progressLabel,
} from "@/lib/charter/controls-view";

// Leitura do plano de controles (CH-DEV-04). Puro: a tela e os testes leem a
// mesma resposta para "o que este papel pode fazer com este controle agora".

const NOW = new Date("2026-09-29T12:00:00Z");
const CAN = { submit: true, decide: true };

describe("rótulos", () => {
  it("os 8 estados têm rótulo e tom, e estado nunca é só cor", () => {
    const states = [
      "NO_EVIDENCE",
      "IN_PROGRESS",
      "IN_REVIEW",
      "ADJUSTMENT_REQUESTED",
      "ACCEPTED",
      "EXPIRED",
      "DISPENSED",
      "REOPENED",
    ] as const;
    for (const s of states) {
      expect(CONTROL_STATE_META[s].label.length).toBeGreaterThan(0);
      expect(CONTROL_STATE_META[s].tone.length).toBeGreaterThan(0);
    }
    expect(CONTROL_STATE_META.EXPIRED.label).toBe("Vencida");
  });

  it("progresso e contagem de fora da classe saem por extenso", () => {
    expect(progressLabel(3, 7)).toBe("3/7 com evidência aceita");
    expect(notApplicableLabel(2, "INTERNAL")).toBe(
      "2 controles não se aplicam à classe Interno"
    );
    expect(notApplicableLabel(1, "PUBLIC")).toBe(
      "1 controle não se aplica à classe Público"
    );
    expect(notApplicableLabel(0, "PUBLIC")).toBeNull();
  });
});

describe("filterControls", () => {
  const rows = [
    { code: "A", state: "ACCEPTED", blocksDecision: false },
    { code: "B", state: "NO_EVIDENCE", blocksDecision: true },
    { code: "C", state: "EXPIRED", blocksDecision: true },
  ] as const;

  it("sem filtro devolve tudo; por estado; só os que bloqueiam", () => {
    expect(filterControls(rows, {})).toHaveLength(3);
    expect(
      filterControls(rows, { state: "ACCEPTED" }).map((r) => r.code)
    ).toEqual(["A"]);
    expect(filterControls(rows, { blocking: true }).map((r) => r.code)).toEqual(
      ["B", "C"]
    );
    expect(
      filterControls(rows, { state: "EXPIRED", blocking: true }).map(
        (r) => r.code
      )
    ).toEqual(["C"]);
  });
});

describe("controlActionsFor — o que cada papel faz agora", () => {
  const byAction = (
    state: Parameters<typeof controlActionsFor>[0],
    can = CAN,
    dispensable = true
  ) =>
    Object.fromEntries(
      controlActionsFor(state, can, dispensable).map((a) => [a.action, a])
    );

  it("Sem evidência: anexar (submit) e dispensar (decide)", () => {
    const a = byAction("NO_EVIDENCE");
    expect(a.ATTACH.allowed).toBe(true);
    expect(a.DISPENSE.allowed).toBe(true);
    expect(a.ACCEPT).toBeUndefined();
  });

  it("Em revisão: só quem decide aceita ou pede ajuste", () => {
    expect(byAction("IN_REVIEW").ACCEPT.allowed).toBe(true);
    const sub = byAction("IN_REVIEW", { submit: true, decide: false });
    expect(sub.ACCEPT.allowed).toBe(false);
    expect(sub.ACCEPT.reason).toMatch(/quem decide o caso/i);
    expect(sub.REQUEST_ADJUSTMENT.allowed).toBe(false);
  });

  it("quem só decide não anexa nem envia", () => {
    const a = byAction("IN_PROGRESS", { submit: false, decide: true });
    expect(a.SUBMIT.allowed).toBe(false);
    expect(a.SUBMIT.reason).toMatch(/submete/i);
  });

  it("pedir ajuste, dispensar e reabrir exigem comentário", () => {
    expect(byAction("IN_REVIEW").REQUEST_ADJUSTMENT.needsComment).toBe(true);
    expect(byAction("NO_EVIDENCE").DISPENSE.needsComment).toBe(true);
    expect(byAction("ACCEPTED").REOPEN.needsComment).toBe(true);
    expect(byAction("IN_REVIEW").ACCEPT.needsComment).toBe(false);
  });

  it("controle não dispensável não oferece dispensa habilitada, com o motivo", () => {
    const a = byAction("NO_EVIDENCE", CAN, false);
    expect(a.DISPENSE.allowed).toBe(false);
    expect(a.DISPENSE.reason).toMatch(/não pode ser dispensado/i);
  });

  it("Vencida volta a anexar; Aceita e Dispensado só reabrem", () => {
    expect(byAction("EXPIRED").ATTACH.allowed).toBe(true);
    expect(Object.keys(byAction("ACCEPTED"))).toEqual(["REOPEN"]);
    expect(Object.keys(byAction("DISPENSED"))).toEqual(["REOPEN"]);
  });
});

describe("expiryWarning — evidência vencida", () => {
  it("vencida: avisa com a data e diz o que fazer", () => {
    const w = expiryWarning(
      { state: "EXPIRED", expiresAt: new Date("2026-08-01T00:00:00Z") },
      NOW
    );
    expect(w?.tone).toBe("red");
    expect(w?.text).toMatch(/venceu/i);
  });

  it("aceita perto de vencer (até 14 dias) avisa em âmbar", () => {
    const w = expiryWarning(
      { state: "ACCEPTED", expiresAt: new Date("2026-10-05T00:00:00Z") },
      NOW
    );
    expect(w?.tone).toBe("amber");
  });

  it("aceita longe do vencimento, ou sem prazo (por ciclo), não avisa", () => {
    expect(
      expiryWarning(
        { state: "ACCEPTED", expiresAt: new Date("2027-03-01T00:00:00Z") },
        NOW
      )
    ).toBeNull();
    expect(
      expiryWarning({ state: "ACCEPTED", expiresAt: null }, NOW)
    ).toBeNull();
    expect(
      expiryWarning({ state: "NO_EVIDENCE", expiresAt: null }, NOW)
    ).toBeNull();
  });
});
