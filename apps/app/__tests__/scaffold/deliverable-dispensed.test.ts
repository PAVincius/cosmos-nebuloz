import { describe, expect, it } from "vitest";
import {
  availableActions,
  type DeliverableActor,
  type DeliverableSubject,
  decideAttach,
  decideEdit,
  decideLink,
  decideTransition,
} from "@/lib/scaffold/deliverable-machine";

// Entregável DISPENSADO não tem ação (Crivo, #331). Dispensado — pelo sistema,
// por módulo não contratado ou A2 sem eixo de confiança baixa, ou pelo overlay do
// consultor — é um entregável que NÃO vale para esta trilha: não se inicia, não se
// edita, não se anexa, não se vincula. A tela escondia o botão "Iniciar" só no
// estado, mas o servidor aceitava a transição: a regra mora na máquina.

const ACTOR: DeliverableActor = {
  userId: "u1",
  grants: { work: "any", review: "any" } as never,
};

const base: DeliverableSubject = {
  status: "NOT_STARTED",
  ownerId: "u1",
  approverId: null,
  phaseState: "OPEN",
  hasFile: false,
};

describe("entregável dispensado", () => {
  const dispensado = { ...base, dispensed: true };

  it("recusa iniciar, com código e motivo próprios", () => {
    const r = decideTransition("START", dispensado, ACTOR);
    expect(r).toMatchObject({ ok: false, code: "DISPENSED" });
    if (!r.ok) {
      expect(r.message).toMatch(/dispensado/i);
    }
  });

  it("recusa toda transição, em qualquer estado em que ele tenha ficado", () => {
    for (const status of [
      "NOT_STARTED",
      "IN_PROGRESS",
      "IN_REVIEW",
      "ADJUSTMENT_REQUESTED",
      "APPROVED",
      "REOPENED",
    ] as const) {
      for (const t of [
        "START",
        "SUBMIT",
        "APPROVE",
        "REQUEST_ADJUSTMENT",
        "REOPEN",
      ] as const) {
        const r = decideTransition(
          t,
          { ...dispensado, status },
          ACTOR,
          "x".repeat(40)
        );
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.code).toBe("DISPENSED");
        }
      }
    }
  });

  it("recusa editar, anexar e vincular", () => {
    for (const d of [
      decideEdit(dispensado, ACTOR),
      decideAttach({ ...dispensado, status: "IN_PROGRESS" }, ACTOR),
      decideLink(dispensado, ACTOR),
    ]) {
      expect(d).toMatchObject({ ok: false, code: "DISPENSED" });
    }
  });

  it("availableActions nega todas as ações, com o motivo", () => {
    const todas = Object.values(availableActions(dispensado, ACTOR));
    expect(todas.every((a) => !a.allowed)).toBe(true);
    expect(todas.every((a) => /dispensado/i.test(a.reason ?? ""))).toBe(true);
  });
});

describe("entregável não dispensado", () => {
  it("segue como sempre: sem a marca, ou com dispensed falso", () => {
    expect(decideTransition("START", base, ACTOR).ok).toBe(true);
    expect(
      decideTransition("START", { ...base, dispensed: false }, ACTOR).ok
    ).toBe(true);
    expect(decideLink(base, ACTOR).ok).toBe(true);
  });
});
