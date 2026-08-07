// epic-lifecycle-guards.test.ts — os portões de um épico, no valor exato do limiar.
//
// Cada guard aqui é uma regra de negócio com número redondo: INVEST ≥ 40,
// hipótese com ≥ 50 caracteres, motivo de rejeição com ≥ 20. Número redondo é
// onde o off-by-one mora, e um teste que só usa 10 e 90 nunca encosta nele.
//
// Não são testes de cobertura: um épico que passa do funil sem hipótese, ou é
// rejeitado com "não gostei", é exatamente o que a máquina existe para impedir.

import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import {
  type EpicLifecycleContext,
  epicLifecycleMachine,
} from "../machines/epic-lifecycle";

const HIPOTESE_49 = "x".repeat(49);
const HIPOTESE_50 = "x".repeat(50);
const MOTIVO_19 = "y".repeat(19);
const MOTIVO_20 = "y".repeat(20);

function ator(input: Partial<EpicLifecycleContext> = {}) {
  const a = createActor(epicLifecycleMachine, { input });
  a.start();
  return a;
}

function emAnalise(input: Partial<EpicLifecycleContext> = {}) {
  const a = ator(input);
  a.send({ type: "ANALYZE" });
  return a;
}

describe("saída do funil", () => {
  it("qualquer épico entra em análise — o funil não filtra", () => {
    const a = ator();
    a.send({ type: "ANALYZE" });

    expect(a.getSnapshot().value).toBe("ANALYZING");
  });
});

describe("canTransitionToBacklog — INVEST e hipótese", () => {
  it("INVEST 40 com hipótese de 50 passa", () => {
    const a = emAnalise({ investScore: 40, hypothesis: HIPOTESE_50 });
    a.send({ type: "MOVE_TO_BACKLOG" });

    expect(a.getSnapshot().value).toBe("PORTFOLIO_BACKLOG");
  });

  it("INVEST 39 não passa — o limiar é inclusivo só em 40", () => {
    const a = emAnalise({ investScore: 39, hypothesis: HIPOTESE_50 });
    a.send({ type: "MOVE_TO_BACKLOG" });

    expect(a.getSnapshot().value).toBe("ANALYZING");
  });

  it("hipótese de 49 caracteres não passa", () => {
    const a = emAnalise({ investScore: 90, hypothesis: HIPOTESE_49 });
    a.send({ type: "MOVE_TO_BACKLOG" });

    expect(a.getSnapshot().value).toBe("ANALYZING");
  });

  it("sem INVEST e sem hipótese, fica onde está", () => {
    // `null` precisa cair no mesmo lado que zero: um épico sem nota não é um
    // épico com nota alta.
    const a = emAnalise();
    a.send({ type: "MOVE_TO_BACKLOG" });

    expect(a.getSnapshot().value).toBe("ANALYZING");
  });
});

describe("canTransitionToImplementing — aprovação e orçamento", () => {
  const PRONTO = { investScore: 90, hypothesis: HIPOTESE_50 };

  function noBacklog(extra: Partial<EpicLifecycleContext>) {
    const a = emAnalise({ ...PRONTO, ...extra });
    a.send({ type: "MOVE_TO_BACKLOG" });
    return a;
  }

  it("com aprovação e verba, implementa", () => {
    const a = noBacklog({
      hasGovernanceApproval: true,
      leanBudgetAllocation: 1,
    });
    a.send({ type: "START_IMPLEMENTING" });

    expect(a.getSnapshot().value).toBe("IMPLEMENTING");
  });

  it("com verba e sem aprovação, não implementa", () => {
    const a = noBacklog({
      hasGovernanceApproval: false,
      leanBudgetAllocation: 1000,
    });
    a.send({ type: "START_IMPLEMENTING" });

    expect(a.getSnapshot().value).toBe("PORTFOLIO_BACKLOG");
  });

  it("verba zero não é verba", () => {
    // O guard é `> 0`, não `!= null`. Épico aprovado com alocação zerada não
    // tem dinheiro, e deixar passar é como um épico começa sem orçamento.
    const a = noBacklog({
      hasGovernanceApproval: true,
      leanBudgetAllocation: 0,
    });
    a.send({ type: "START_IMPLEMENTING" });

    expect(a.getSnapshot().value).toBe("PORTFOLIO_BACKLOG");
  });

  it("completar leva a DONE, que é final", () => {
    const a = noBacklog({
      hasGovernanceApproval: true,
      leanBudgetAllocation: 5,
    });
    a.send({ type: "START_IMPLEMENTING" });
    a.send({ type: "COMPLETE" });

    const snap = a.getSnapshot();
    expect(snap.value).toBe("DONE");
    expect(snap.status).toBe("done");
  });
});

describe("hasValidRejectionReason — rejeitar exige motivo escrito", () => {
  it("motivo de 20 caracteres rejeita", () => {
    const a = ator();
    a.send({ type: "REJECT", reason: MOTIVO_20 });

    expect(a.getSnapshot().value).toBe("REJECTED");
  });

  it("motivo de 19 não rejeita — 'não gostei' não é motivo", () => {
    const a = ator();
    a.send({ type: "REJECT", reason: MOTIVO_19 });

    expect(a.getSnapshot().value).toBe("FUNNEL");
  });

  it("motivo vazio não rejeita", () => {
    const a = ator();
    a.send({ type: "REJECT", reason: "" });

    expect(a.getSnapshot().value).toBe("FUNNEL");
  });

  it("dá para rejeitar de qualquer estado não final", () => {
    const a = emAnalise({ investScore: 90, hypothesis: HIPOTESE_50 });
    a.send({ type: "MOVE_TO_BACKLOG" });
    a.send({ type: "REJECT", reason: MOTIVO_20 });

    expect(a.getSnapshot().value).toBe("REJECTED");
  });
});
