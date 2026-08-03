// epic-lifecycle-reachability.test.ts — prova executável da regra da
// story-063 AC-001: o lifecycleStatus gravado de um épico precisa ser
// ALCANÇÁVEL pela própria máquina com os dados da própria linha.
//
// Por que isso importa e por que o teste vive aqui: transitionEpicStatus
// (app/actions/epics/transition-status.ts) não hidrata o ator no estado
// persistido — ele reconstrói a máquina do zero e reproduz o caminho canônico
// até o estado atual (fastForwardToState), passando pelos MESMOS guards. Um
// épico gravado em PORTFOLIO_BACKLOG sem investScore/hipótese nunca chega lá
// no replay: o ator trava em ANALYZING e o evento real vira
// INVALID_TRANSITION, uma mensagem sobre o estado errado. O board estoura no
// drag e parece bug de UI.
//
// O teste do seed (packages/database/scripts/__tests__/seed-cosmos.test.ts)
// nunca roda — @repo/database não tem script `test`. Então a regra que o seed
// honra é provada aqui, contra a máquina de verdade.
import { epicLifecycleMachine } from "@repo/safe-engine";
import { describe, expect, it } from "vitest";
import { createActor } from "xstate";

type SeedContext = {
  investScore: number | null;
  hypothesis: string | null;
  leanBudgetAllocation: number | null;
  hasGovernanceApproval: boolean;
};

// Mesmo caminho canônico de FAST_FORWARD_PATH em transition-status.ts.
const CANONICAL_PATH = {
  FUNNEL: [],
  ANALYZING: ["ANALYZE"],
  PORTFOLIO_BACKLOG: ["ANALYZE", "MOVE_TO_BACKLOG"],
  IMPLEMENTING: ["ANALYZE", "MOVE_TO_BACKLOG", "START_IMPLEMENTING"],
  DONE: ["ANALYZE", "MOVE_TO_BACKLOG", "START_IMPLEMENTING", "COMPLETE"],
} as const;

function reachedState(
  target: keyof typeof CANONICAL_PATH,
  context: SeedContext
): string {
  const actor = createActor(epicLifecycleMachine, {
    input: { ...context, rejectionReason: null },
  });
  actor.start();
  for (const event of CANONICAL_PATH[target]) {
    actor.send({ type: event } as never);
  }
  return String(actor.getSnapshot().value);
}

// Exatamente o que o seed grava para um épico em ANALYZING ou além.
const ANALYZED: SeedContext = {
  investScore: 40,
  // >= 50 caracteres, que é o guard hasHypothesis
  hypothesis:
    "Hipótese de valor com tamanho suficiente para o guard da máquina.",
  leanBudgetAllocation: null,
  hasGovernanceApproval: false,
};

// O que o seed grava para um épico em IMPLEMENTING ou além.
const FUNDED: SeedContext = {
  ...ANALYZED,
  leanBudgetAllocation: 1,
  hasGovernanceApproval: true,
};

const BARE: SeedContext = {
  investScore: null,
  hypothesis: null,
  leanBudgetAllocation: null,
  hasGovernanceApproval: false,
};

describe("alcançabilidade do estado semeado (story-063 AC-001)", () => {
  it("FUNNEL é alcançável sem dado nenhum — é o estado inicial", () => {
    expect(reachedState("FUNNEL", BARE)).toBe("FUNNEL");
  });

  it("ANALYZING é alcançável sem dado nenhum — ANALYZE não tem guard", () => {
    expect(reachedState("ANALYZING", BARE)).toBe("ANALYZING");
  });

  it("PORTFOLIO_BACKLOG NÃO é alcançável sem INVEST score e hipótese", () => {
    // o ator trava em ANALYZING: é o estado que o seed antigo produzia e a
    // razão de todo arraste a partir do backlog falhar
    expect(reachedState("PORTFOLIO_BACKLOG", BARE)).toBe("ANALYZING");
  });

  it("PORTFOLIO_BACKLOG é alcançável com INVEST score >= 40 e hipótese >= 50 chars", () => {
    expect(reachedState("PORTFOLIO_BACKLOG", ANALYZED)).toBe(
      "PORTFOLIO_BACKLOG"
    );
  });

  it("IMPLEMENTING NÃO é alcançável só com INVEST score e hipótese", () => {
    expect(reachedState("IMPLEMENTING", ANALYZED)).toBe("PORTFOLIO_BACKLOG");
  });

  it("IMPLEMENTING é alcançável com aprovação de governança e alocação de orçamento", () => {
    expect(reachedState("IMPLEMENTING", FUNDED)).toBe("IMPLEMENTING");
  });

  it("DONE é alcançável com o mesmo conjunto de IMPLEMENTING — COMPLETE não tem guard", () => {
    expect(reachedState("DONE", FUNDED)).toBe("DONE");
  });

  it("INVEST score abaixo de 40 não abre o Portfolio Backlog", () => {
    expect(
      reachedState("PORTFOLIO_BACKLOG", { ...ANALYZED, investScore: 39 })
    ).toBe("ANALYZING");
  });

  it("hipótese com menos de 50 caracteres não abre o Portfolio Backlog", () => {
    expect(
      reachedState("PORTFOLIO_BACKLOG", {
        ...ANALYZED,
        hypothesis: "curta demais",
      })
    ).toBe("ANALYZING");
  });

  it("alocação de orçamento zero não abre Implementando", () => {
    expect(
      reachedState("IMPLEMENTING", { ...FUNDED, leanBudgetAllocation: 0 })
    ).toBe("PORTFOLIO_BACKLOG");
  });
});
