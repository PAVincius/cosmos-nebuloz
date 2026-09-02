import { describe, expect, it } from "vitest";
import {
  canEnterGateReady,
  evaluateCriteria,
  GateTransitionError,
  isTerminalForTrack,
  nextState,
} from "@/lib/scaffold/gate-machine";

// SRD §4 — a máquina de fase, como lógica pura.
//
// Este arquivo não toca banco de propósito. A invariante do produto é uma regra
// de transição, e regra de transição testada só através do Prisma é regra
// testada através de três camadas de mock — o teste passa a medir os mocks.
//
// A suíte que prova o produto ponta a ponta é `gates-negative.test.ts`. Esta
// aqui prova que a regra existe antes de haver por onde contorná-la.

describe("canEnterGateReady — SG-01", () => {
  it("libera quando todo passo requerido está DONE", () => {
    expect(
      canEnterGateReady([
        { required: true, state: "DONE" },
        { required: true, state: "DONE" },
      ])
    ).toBe(true);
  });

  it("bloqueia com passo requerido em TODO", () => {
    expect(
      canEnterGateReady([
        { required: true, state: "DONE" },
        { required: true, state: "TODO" },
      ])
    ).toBe(false);
  });

  it("bloqueia com passo requerido em ACTIVE — em andamento não é concluído", () => {
    expect(canEnterGateReady([{ required: true, state: "ACTIVE" }])).toBe(
      false
    );
  });

  it("ignora passo opcional pendente", () => {
    expect(
      canEnterGateReady([
        { required: true, state: "DONE" },
        { required: false, state: "TODO" },
      ])
    ).toBe(true);
  });

  it("fase sem passo nenhum não fica travada", () => {
    // Um template pode não ter passo numa fase. Travar aqui deixaria a trilha
    // presa sem nada que a pessoa possa fazer para destravar.
    expect(canEnterGateReady([])).toBe(true);
  });
});

describe("evaluateCriteria — SG-02", () => {
  const CRITERIA = [
    {
      key: "beats-baseline",
      statement: "Piloto vence o baseline",
      evaluationType: "MANUAL" as const,
    },
    {
      key: "no-new-risk",
      statement: "Nenhum risco novo",
      evaluationType: "MANUAL" as const,
    },
    {
      key: "rollback-tested-prod",
      statement: "Rollback testado em produção",
      evaluationType: "MANUAL" as const,
    },
  ];

  it("permite fechar quando todos são atendidos", () => {
    const r = evaluateCriteria(CRITERIA, {
      "beats-baseline": { met: true, note: "46 → 31 min (−33%)" },
      "no-new-risk": { met: true },
      "rollback-tested-prod": { met: true },
    });
    expect(r.canClose).toBe(true);
    expect(r.blockers).toEqual([]);
  });

  it("bloqueia e nomeia o critério não atendido", () => {
    const r = evaluateCriteria(CRITERIA, {
      "beats-baseline": { met: true },
      "no-new-risk": { met: true },
      "rollback-tested-prod": {
        met: false,
        note: "teste agendado, não executado",
      },
    });
    expect(r.canClose).toBe(false);
    expect(r.blockers).toEqual(["rollback-tested-prod"]);
  });

  it("trata critério sem fato como NÃO atendido — ausência não é aprovação", () => {
    // O default importa: se ausência contasse como atendido, um critério novo
    // publicado numa versão de template passaria a fechar sozinho todo gate que
    // ainda não o avaliou.
    const r = evaluateCriteria(CRITERIA, { "beats-baseline": { met: true } });
    expect(r.canClose).toBe(false);
    expect(r.blockers).toEqual(["no-new-risk", "rollback-tested-prod"]);
  });

  it("devolve o enunciado junto do veredito, para a UI listar sem segunda consulta", () => {
    const r = evaluateCriteria(CRITERIA, {});
    expect(r.criteria[0]).toMatchObject({
      key: "beats-baseline",
      statement: "Piloto vence o baseline",
      met: false,
    });
  });

  it("preserva a nota do avaliador", () => {
    const r = evaluateCriteria(CRITERIA, {
      "rollback-tested-prod": {
        met: false,
        note: "janela regulatória de 6 semanas",
      },
    });
    expect(r.criteria[2]?.note).toBe("janela regulatória de 6 semanas");
  });

  it("fase sem critério fecha — mas isso é decisão do template, não do motor", () => {
    expect(evaluateCriteria([], {}).canClose).toBe(true);
  });
});

describe("nextState — transições permitidas", () => {
  it("IDLE → OPEN ao abrir", () => {
    expect(nextState("IDLE", "OPEN")).toBe("OPEN");
  });

  it("OPEN → GATE_READY quando os passos completam", () => {
    expect(nextState("OPEN", "STEPS_COMPLETE")).toBe("GATE_READY");
  });

  it("GATE_READY → OPEN quando um passo volta a ficar pendente", () => {
    // Regressão acontece: alguém marca DONE por engano e desmarca. O gate tem
    // de recuar junto, senão fica pronto sobre trabalho que não terminou.
    expect(nextState("GATE_READY", "STEPS_REGRESSED")).toBe("OPEN");
  });

  it("GATE_READY → CLOSED com critérios atendidos", () => {
    expect(nextState("GATE_READY", "CRITERIA_MET")).toBe("CLOSED");
  });

  it("GATE_READY → BLOCKED com critério não atendido", () => {
    expect(nextState("GATE_READY", "CRITERIA_UNMET")).toBe("BLOCKED");
  });

  it("BLOCKED → CLOSED por override atribuído", () => {
    expect(nextState("BLOCKED", "OVERRIDE")).toBe("CLOSED");
  });

  it("BLOCKED → GATE_READY quando o critério passa a ser atendido", () => {
    expect(nextState("BLOCKED", "CRITERIA_MET")).toBe("CLOSED");
    expect(nextState("BLOCKED", "STEPS_REGRESSED")).toBe("OPEN");
  });

  it("CLOSED → REOPENED, e REOPENED → OPEN", () => {
    expect(nextState("CLOSED", "REOPEN")).toBe("REOPENED");
    expect(nextState("REOPENED", "OPEN")).toBe("OPEN");
  });

  it("CLOSED → OBSERVING ao entrar na janela de 30 dias", () => {
    expect(nextState("CLOSED", "ENTER_OBSERVATION")).toBe("OBSERVING");
  });

  it("OBSERVING → REOPENED quando reabre dentro da janela", () => {
    expect(nextState("OBSERVING", "REOPEN")).toBe("REOPENED");
  });
});

describe("nextState — transições recusadas", () => {
  it("OPEN não fecha direto: pular GATE_READY é pular SG-01", () => {
    expect(() => nextState("OPEN", "CRITERIA_MET")).toThrow(
      GateTransitionError
    );
  });

  it("IDLE não fecha", () => {
    expect(() => nextState("IDLE", "CRITERIA_MET")).toThrow(
      GateTransitionError
    );
  });

  it("GATE_READY não aceita override — override só existe sobre bloqueio", () => {
    // Override sem critério não atendido é override sem o que justificar. Se
    // isto passasse, a justificativa viraria formulário decorativo.
    expect(() => nextState("GATE_READY", "OVERRIDE")).toThrow(
      GateTransitionError
    );
  });

  it("CLOSED não fecha de novo", () => {
    expect(() => nextState("CLOSED", "CRITERIA_MET")).toThrow(
      GateTransitionError
    );
  });

  it("OBSERVING não fecha — a janela termina sozinha ou reabre", () => {
    expect(() => nextState("OBSERVING", "CRITERIA_MET")).toThrow(
      GateTransitionError
    );
  });

  it("o erro nomeia estado e evento, para o log dizer o que foi tentado", () => {
    try {
      nextState("OPEN", "OVERRIDE");
      expect.unreachable("deveria ter lançado");
    } catch (e) {
      expect(e).toBeInstanceOf(GateTransitionError);
      expect((e as GateTransitionError).message).toContain("OPEN");
      expect((e as GateTransitionError).message).toContain("OVERRIDE");
    }
  });
});

describe("isTerminalForTrack — SG-06", () => {
  it("EMBED fechada NÃO entrega a trilha: abre observação", () => {
    expect(isTerminalForTrack("EMBED", "CLOSED")).toBe(false);
  });

  it("nenhuma outra fase entrega a trilha ao fechar", () => {
    expect(isTerminalForTrack("ASSESS", "CLOSED")).toBe(false);
    expect(isTerminalForTrack("SCALE", "CLOSED")).toBe(false);
  });

  it("OBSERVING também não entrega — só o fim da janela entrega", () => {
    expect(isTerminalForTrack("EMBED", "OBSERVING")).toBe(false);
  });
});
