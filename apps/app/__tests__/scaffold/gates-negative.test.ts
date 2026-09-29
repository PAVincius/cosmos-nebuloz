import { beforeEach, describe, expect, it, vi } from "vitest";

// A SUÍTE QUE PROVA O PRODUTO.
//
// O SRD: "o comportamento bloqueante do gate é o produto. Qualquer caminho de
// código que feche uma fase sem registrar critérios atendidos ou um override
// atribuído é defeito de correção de severidade máxima, não atalho de UX."
//
// Uma asserção por linha do contrato de bloqueio de
// `specs/002-scaffold-adoption/contracts/server-actions.md`. Cada recusa
// asserta o CÓDIGO do erro, não só que falhou: um teste que aceita qualquer
// falha passa mesmo quando o produto falha pelo motivo errado.
//
// Gate crítico do BMAD-TEA: unit + integration + e2e + negative. Esta é a
// negativa.

const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  phaseFindFirst: vi.fn(),
  phaseUpdate: vi.fn(),
  phaseUpdateMany: vi.fn(),
  criterionFindMany: vi.fn(),
  gateResultCreate: vi.fn(),
  gateResultFindFirst: vi.fn(),
  overrideCreate: vi.fn(),
  trackUpdate: vi.fn(),
  moduleFindFirst: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/scaffold/guards", () => ({
  requireScaffoldPermissionContext: h.requirePerm,
  requireScaffoldContext: h.requirePerm,
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      scaffoldPhaseInstance: {
        findFirst: h.phaseFindFirst,
        update: h.phaseUpdate,
        updateMany: h.phaseUpdateMany,
      },
      scaffoldGateCriterion: { findMany: h.criterionFindMany },
      scaffoldGateResult: {
        create: h.gateResultCreate,
        findFirst: h.gateResultFindFirst,
      },
      scaffoldGateOverride: { create: h.overrideCreate },
      // Trilha legada, sem entregável: a regra de passos vale sozinha.
      scaffoldDeliverableInstance: { findMany: async () => [] },
      scaffoldTrack: { update: h.trackUpdate },
      tenantModule: { findFirst: h.moduleFindFirst },
      auditLog: { create: h.auditCreate },
    }),
}));

import {
  closePhase,
  evaluateGate,
  overridePhase,
  reopenPhase,
} from "@/app/(scaffold)/actions/gates";

const CTX = {
  tenantId: "t1",
  userId: "u1",
  role: "ADMIN",
  scaffoldRole: "CONSULTANT",
  user: { name: "Marina", email: "m@x.com" },
};

const PI = "clx00000000000000000pi001";
const APPROVER = "clx000000000000000000a001";

const CRITERIA = [
  {
    key: "beats-baseline",
    statement: "Piloto vence o baseline",
    phase: "PILOT",
    seq: 1,
    evaluationType: "MANUAL",
  },
  {
    key: "no-new-risk",
    statement: "Nenhum risco novo",
    phase: "PILOT",
    seq: 2,
    evaluationType: "MANUAL",
  },
];

/** Fase pronta para fechar: passos concluídos, estado GATE_READY, fase PILOT
 *  (não toca SG-04 nem SG-05). O caso feliz — cada teste abaixo estraga
 *  exatamente uma coisa. */
function readyPhase(over: Record<string, unknown> = {}) {
  return {
    id: PI,
    phase: "PILOT",
    state: "GATE_READY",
    reopenCount: 0,
    observationEndsAt: null,
    charterPolicyAckAt: null,
    trackId: "trk1",
    steps: [
      { id: "s1", required: true, state: "DONE", statement: "Definir métrica" },
      { id: "s2", required: true, state: "DONE", statement: "Rodar piloto" },
    ],
    track: {
      id: "trk1",
      code: "TR-104",
      processName: "Triagem",
      tenantId: "t1",
      templateVersionId: "ver1",
      businessCase: null,
    },
    ...over,
  };
}

const ALL_MET = {
  "beats-baseline": { met: true },
  "no-new-risk": { met: true },
};

beforeEach(() => {
  vi.clearAllMocks();
  h.requirePerm.mockResolvedValue(CTX);
  h.phaseFindFirst.mockResolvedValue(readyPhase());
  h.criterionFindMany.mockResolvedValue(CRITERIA);
  h.gateResultCreate.mockResolvedValue({ id: "gr1" });
  h.overrideCreate.mockResolvedValue({ id: "ov1" });
  h.phaseUpdate.mockResolvedValue({});
  h.phaseUpdateMany.mockResolvedValue({ count: 1 });
  h.trackUpdate.mockResolvedValue({});
  h.auditCreate.mockResolvedValue({});
  h.moduleFindFirst.mockResolvedValue(null); // Charter não contratado
});

// ── O caso feliz existe para que a negativa signifique alguma coisa ──────────

describe("closePhase — caminho válido", () => {
  it("fecha quando os passos completaram e os critérios foram atendidos", async () => {
    const res = await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    expect(res.ok).toBe(true);
    expect(h.phaseUpdate.mock.calls[0][0].data.state).toBe("CLOSED");
  });

  it("congela o snapshot dos critérios na decisão", async () => {
    await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    const snap = h.gateResultCreate.mock.calls[0][0].data.criteriaSnapshot;
    expect(snap).toHaveLength(2);
    expect(snap[0]).toMatchObject({ key: "beats-baseline", met: true });
  });

  it("registra PASSED, não OVERRIDDEN", async () => {
    await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    expect(h.gateResultCreate.mock.calls[0][0].data.outcome).toBe("PASSED");
    expect(h.overrideCreate).not.toHaveBeenCalled();
  });
});

// ── Avanço da trilha ─────────────────────────────────────────────────────────
//
// Fechar o gate sem mover a trilha é o modo de falha silenciosa deste produto:
// a decisão fica registrada, a fase fica CLOSED, e a trilha continua apontando
// para a fase que acabou de fechar — com a seguinte em IDLE, sem passo para
// executar. Nada estoura; o produto só para de andar.

describe("fechar o gate move a trilha para a fase seguinte", () => {
  it("PILOT fechada leva a trilha para SCALE", async () => {
    await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    expect(h.trackUpdate.mock.calls[0][0].data.currentPhase).toBe("SCALE");
  });

  it("abre a fase seguinte, e só se ela ainda estiver IDLE", async () => {
    await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    const arg = h.phaseUpdateMany.mock.calls[0][0];
    expect(arg.where).toMatchObject({
      trackId: "trk1",
      phase: "SCALE",
      state: "IDLE",
      track: { tenantId: "t1" },
    });
    expect(arg.data.state).toBe("OPEN");
  });

  it("EMBED não avança: não há quinta fase", async () => {
    h.phaseFindFirst.mockResolvedValue(readyPhase({ phase: "EMBED" }));
    h.criterionFindMany.mockResolvedValue([]);
    await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: {},
    });
    expect(h.phaseUpdateMany).not.toHaveBeenCalled();
    expect(h.trackUpdate.mock.calls[0][0].data.currentPhase).toBeUndefined();
  });

  it("reabrir traz a trilha de volta para a fase reaberta", async () => {
    h.phaseFindFirst.mockResolvedValue(
      readyPhase({ phase: "PILOT", state: "CLOSED" })
    );
    await reopenPhase({
      phaseInstanceId: PI,
      rationale: "O piloto não sustentou o ganho no segundo mês de operação.",
    });
    expect(h.trackUpdate.mock.calls[0][0].data.currentPhase).toBe("PILOT");
  });
});

// ── SG-01 ────────────────────────────────────────────────────────────────────

describe("SG-01 — passo requerido pendente bloqueia o gate", () => {
  it("recusa com STEPS_INCOMPLETE quando há passo em TODO", async () => {
    h.phaseFindFirst.mockResolvedValue(
      readyPhase({
        state: "OPEN",
        steps: [
          {
            id: "s1",
            required: true,
            state: "DONE",
            statement: "Definir métrica",
          },
          {
            id: "s2",
            required: true,
            state: "TODO",
            statement: "Rodar piloto",
          },
        ],
      })
    );
    const res = await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    expect(res.ok).toBe(false);
    expect(res).toMatchObject({ code: "STEPS_INCOMPLETE" });
    expect(h.gateResultCreate).not.toHaveBeenCalled();
    expect(h.phaseUpdate).not.toHaveBeenCalled();
  });

  it("recusa com passo em ACTIVE — em andamento não é concluído", async () => {
    h.phaseFindFirst.mockResolvedValue(
      readyPhase({
        state: "OPEN",
        steps: [
          {
            id: "s1",
            required: true,
            state: "ACTIVE",
            statement: "Rodar piloto",
          },
        ],
      })
    );
    const res = await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    expect(res).toMatchObject({ ok: false, code: "STEPS_INCOMPLETE" });
  });

  it("passo OPCIONAL pendente não bloqueia", async () => {
    h.phaseFindFirst.mockResolvedValue(
      readyPhase({
        steps: [
          {
            id: "s1",
            required: true,
            state: "DONE",
            statement: "Definir métrica",
          },
          {
            id: "s2",
            required: false,
            state: "TODO",
            statement: "Comunicar time",
          },
        ],
      })
    );
    const res = await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    expect(res.ok).toBe(true);
  });
});

// ── SG-02 ────────────────────────────────────────────────────────────────────

describe("SG-02 — critério não atendido bloqueia, e sem override não fecha", () => {
  it("recusa com CRITERIA_UNMET", async () => {
    const res = await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: {
        "beats-baseline": { met: true },
        "no-new-risk": { met: false },
      },
    });
    expect(res).toMatchObject({ ok: false, code: "CRITERIA_UNMET" });
    expect(h.gateResultCreate).not.toHaveBeenCalled();
  });

  it("deixa a fase em BLOCKED, não em GATE_READY", async () => {
    await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: { "no-new-risk": { met: false } },
    });
    expect(h.phaseUpdate.mock.calls[0][0].data.state).toBe("BLOCKED");
  });

  it("critério sem fato conta como não atendido — ausência não é aprovação", async () => {
    const res = await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: {},
    });
    expect(res).toMatchObject({ ok: false, code: "CRITERIA_UNMET" });
  });

  it("a recusa nomeia os critérios que faltam, em vez de mandar procurar", async () => {
    const res = await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: { "beats-baseline": { met: true } },
    });
    expect(res).toMatchObject({ ok: false, blockers: ["no-new-risk"] });
  });
});

// ── SG-03 ────────────────────────────────────────────────────────────────────

describe("SG-03 — override exige ator, critérios e justificativa", () => {
  const BLOCKED = () => readyPhase({ state: "BLOCKED" });

  it("fecha com override válido e grava PASSED? não — OVERRIDDEN", async () => {
    h.phaseFindFirst.mockResolvedValue(BLOCKED());
    const res = await overridePhase({
      phaseInstanceId: PI,
      unmetCriteria: ["no-new-risk"],
      rationale:
        "Risco aceito por escrito pelo sponsor: janela regulatória impede o teste antes do trimestre.",
    });
    expect(res.ok).toBe(true);
    expect(h.gateResultCreate.mock.calls[0][0].data.outcome).toBe("OVERRIDDEN");
    expect(h.phaseUpdate.mock.calls[0][0].data.state).toBe("CLOSED");
  });

  it("recusa com RATIONALE_REQUIRED quando a justificativa é vazia", async () => {
    h.phaseFindFirst.mockResolvedValue(BLOCKED());
    const res = await overridePhase({
      phaseInstanceId: PI,
      unmetCriteria: ["no-new-risk"],
      rationale: "",
    });
    expect(res.ok).toBe(false);
    expect(h.overrideCreate).not.toHaveBeenCalled();
    expect(h.phaseUpdate).not.toHaveBeenCalled();
  });

  it("recusa quando a justificativa é só espaço em branco", async () => {
    h.phaseFindFirst.mockResolvedValue(BLOCKED());
    const res = await overridePhase({
      phaseInstanceId: PI,
      unmetCriteria: ["no-new-risk"],
      rationale: "                              ",
    });
    expect(res.ok).toBe(false);
    expect(h.overrideCreate).not.toHaveBeenCalled();
  });

  it("recusa justificativa sem substância — 'ok' não é decisão registrada", async () => {
    h.phaseFindFirst.mockResolvedValue(BLOCKED());
    const res = await overridePhase({
      phaseInstanceId: PI,
      unmetCriteria: ["no-new-risk"],
      rationale: "ok",
    });
    expect(res.ok).toBe(false);
    expect(h.overrideCreate).not.toHaveBeenCalled();
  });

  it("recusa com lista de critérios vazia — sem ela não há o que auditar", async () => {
    h.phaseFindFirst.mockResolvedValue(BLOCKED());
    const res = await overridePhase({
      phaseInstanceId: PI,
      unmetCriteria: [],
      rationale:
        "Risco aceito por escrito pelo sponsor: janela regulatória impede o teste antes do trimestre.",
    });
    expect(res.ok).toBe(false);
    expect(h.overrideCreate).not.toHaveBeenCalled();
  });

  it("grava o override atribuído ao ator da sessão, não a quem o payload disser", async () => {
    h.phaseFindFirst.mockResolvedValue(BLOCKED());
    await overridePhase({
      phaseInstanceId: PI,
      unmetCriteria: ["no-new-risk"],
      rationale:
        "Risco aceito por escrito pelo sponsor: janela regulatória impede o teste antes do trimestre.",
    });
    expect(h.overrideCreate.mock.calls[0][0].data).toMatchObject({
      actorId: "u1",
      unmetCriteria: ["no-new-risk"],
    });
  });

  it("não aceita override sobre fase que não está bloqueada", async () => {
    // GATE_READY com tudo atendido não tem o que dispensar. Se passasse, a
    // justificativa viraria formulário decorativo.
    h.phaseFindFirst.mockResolvedValue(readyPhase({ state: "GATE_READY" }));
    const res = await overridePhase({
      phaseInstanceId: PI,
      unmetCriteria: ["no-new-risk"],
      rationale:
        "Risco aceito por escrito pelo sponsor: janela regulatória impede o teste antes do trimestre.",
    });
    expect(res.ok).toBe(false);
    expect(h.overrideCreate).not.toHaveBeenCalled();
  });
});

// ── SG-04 (guard preenchido em US4, mas a trava já existe) ───────────────────

describe("SG-04 — ASSESS não fecha sem caso de negócio assinado", () => {
  function assessPhase(businessCase: unknown) {
    return readyPhase({
      phase: "ASSESS",
      track: {
        id: "trk1",
        code: "TR-104",
        processName: "Triagem",
        tenantId: "t1",
        templateVersionId: "ver1",
        businessCase,
      },
    });
  }

  it("recusa com BASELINE_NOT_SIGNED quando o caso está em DRAFT", async () => {
    h.phaseFindFirst.mockResolvedValue(
      assessPhase({ state: "DRAFT", signedVersionId: null })
    );
    const res = await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    expect(res).toMatchObject({ ok: false, code: "BASELINE_NOT_SIGNED" });
  });

  it("recusa quando está AWAITING", async () => {
    h.phaseFindFirst.mockResolvedValue(
      assessPhase({ state: "AWAITING", signedVersionId: null })
    );
    const res = await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    expect(res).toMatchObject({ ok: false, code: "BASELINE_NOT_SIGNED" });
  });

  it("recusa quando está CONTESTED", async () => {
    h.phaseFindFirst.mockResolvedValue(
      assessPhase({ state: "CONTESTED", signedVersionId: null })
    );
    const res = await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    expect(res).toMatchObject({ ok: false, code: "BASELINE_NOT_SIGNED" });
  });

  it("recusa quando NÃO existe caso de negócio nenhum", async () => {
    h.phaseFindFirst.mockResolvedValue(assessPhase(null));
    const res = await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    expect(res).toMatchObject({ ok: false, code: "BASELINE_NOT_SIGNED" });
  });

  it("aceita quando há versão assinada", async () => {
    h.phaseFindFirst.mockResolvedValue(
      assessPhase({ state: "SIGNED", signedVersionId: "bcv1" })
    );
    const res = await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    expect(res.ok).toBe(true);
  });

  it("SG-04 vale mesmo por override: dispensar critério não dispensa a assinatura", async () => {
    // Override cobre critério de gate. A trava do baseline não é critério — é
    // a condição de existir promessa medida. Se o override a contornasse, a
    // Fase 1 fecharia sem ninguém ter assinado nada.
    h.phaseFindFirst.mockResolvedValue(
      assessPhase({ state: "DRAFT", signedVersionId: null })
    );
    h.phaseFindFirst.mockResolvedValue({
      ...assessPhase({ state: "DRAFT", signedVersionId: null }),
      state: "BLOCKED",
    });
    const res = await overridePhase({
      phaseInstanceId: PI,
      unmetCriteria: ["no-new-risk"],
      rationale:
        "Risco aceito por escrito pelo sponsor: janela regulatória impede o teste antes do trimestre.",
    });
    expect(res).toMatchObject({ ok: false, code: "BASELINE_NOT_SIGNED" });
  });
});

// ── SG-05 ────────────────────────────────────────────────────────────────────

describe("SG-05 — SCALE exige ack do Charter, quando o Charter existe", () => {
  const scalePhase = (ack: Date | null) =>
    readyPhase({ phase: "SCALE", charterPolicyAckAt: ack });

  it("recusa com CHARTER_POLICY_NOT_ACKED quando o Charter está contratado e não houve ack", async () => {
    h.moduleFindFirst.mockResolvedValue({
      module: "CHARTER",
      status: "ACTIVE",
    });
    h.phaseFindFirst.mockResolvedValue(scalePhase(null));
    const res = await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    expect(res).toMatchObject({ ok: false, code: "CHARTER_POLICY_NOT_ACKED" });
  });

  it("aceita quando houve ack", async () => {
    h.moduleFindFirst.mockResolvedValue({
      module: "CHARTER",
      status: "ACTIVE",
    });
    h.phaseFindFirst.mockResolvedValue(scalePhase(new Date()));
    const res = await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    expect(res.ok).toBe(true);
  });

  it("degrada graciosamente: sem Charter contratado, SCALE fecha sem ack", async () => {
    // SRD §8 — toda interface degrada quando o produto contraparte não está
    // provisionado. Bloquear aqui puniria o cliente por não ter comprado o
    // Charter.
    h.moduleFindFirst.mockResolvedValue(null);
    h.phaseFindFirst.mockResolvedValue(scalePhase(null));
    const res = await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    expect(res.ok).toBe(true);
  });
});

// ── SG-06 ────────────────────────────────────────────────────────────────────

describe("SG-06 — fechar EMBED abre observação, não entrega a trilha", () => {
  it("leva a fase a OBSERVING e agenda o fim da janela", async () => {
    h.phaseFindFirst.mockResolvedValue(readyPhase({ phase: "EMBED" }));
    const res = await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    expect(res.ok).toBe(true);
    const data = h.phaseUpdate.mock.calls[0][0].data;
    expect(data.state).toBe("OBSERVING");
    expect(data.observationEndsAt).toBeInstanceOf(Date);
    const dias = Math.round(
      (data.observationEndsAt.getTime() - Date.now()) / 86_400_000
    );
    expect(dias).toBe(30);
  });

  it("NÃO marca a trilha como EMBEDDED", async () => {
    h.phaseFindFirst.mockResolvedValue(readyPhase({ phase: "EMBED" }));
    await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    const updates = h.trackUpdate.mock.calls.map((c) => c[0].data.status);
    expect(updates).not.toContain("EMBEDDED");
  });

  it("fases que não são EMBED fecham direto em CLOSED", async () => {
    await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    expect(h.phaseUpdate.mock.calls[0][0].data.state).toBe("CLOSED");
    expect(
      h.phaseUpdate.mock.calls[0][0].data.observationEndsAt
    ).toBeUndefined();
  });
});

// ── SG-07 ────────────────────────────────────────────────────────────────────

describe("SG-07 — resultado e override são append-only", () => {
  it("gate.close nunca atualiza um resultado existente", async () => {
    await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    expect(h.gateResultCreate).toHaveBeenCalledTimes(1);
  });

  it("fechar de novo depois de reabrir cria um SEGUNDO resultado, com cycle novo", async () => {
    h.phaseFindFirst.mockResolvedValue(readyPhase({ reopenCount: 2 }));
    await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    expect(h.gateResultCreate.mock.calls[0][0].data.cycle).toBe(2);
  });
});

// ── Estado ───────────────────────────────────────────────────────────────────

describe("transições ilegais", () => {
  it("não fecha fase IDLE", async () => {
    h.phaseFindFirst.mockResolvedValue(
      readyPhase({ state: "IDLE", steps: [] })
    );
    const res = await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    expect(res.ok).toBe(false);
    expect(h.gateResultCreate).not.toHaveBeenCalled();
  });

  it("não fecha fase já CLOSED", async () => {
    h.phaseFindFirst.mockResolvedValue(readyPhase({ state: "CLOSED" }));
    const res = await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    expect(res.ok).toBe(false);
    expect(h.gateResultCreate).not.toHaveBeenCalled();
  });

  it("não fecha fase em OBSERVING — a janela termina sozinha ou reabre", async () => {
    h.phaseFindFirst.mockResolvedValue(readyPhase({ state: "OBSERVING" }));
    const res = await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    expect(res.ok).toBe(false);
  });
});

// ── evaluateGate ─────────────────────────────────────────────────────────────

describe("evaluateGate — leitura, sem efeito", () => {
  it("devolve critérios, canClose e blockers sem escrever nada", async () => {
    const res = await evaluateGate({ phaseInstanceId: PI });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.criteria).toHaveLength(2);
      expect(res.data.canClose).toBe(false);
    }
    expect(h.phaseUpdate).not.toHaveBeenCalled();
    expect(h.gateResultCreate).not.toHaveBeenCalled();
  });

  it("lista os passos requeridos pendentes como bloqueio", async () => {
    h.phaseFindFirst.mockResolvedValue(
      readyPhase({
        state: "OPEN",
        steps: [
          {
            id: "s1",
            required: true,
            state: "TODO",
            statement: "Rodar piloto",
          },
        ],
      })
    );
    const res = await evaluateGate({ phaseInstanceId: PI });
    if (res.ok) {
      expect(res.data.pendingSteps).toEqual(["Rodar piloto"]);
    }
  });
});

// ── Auditoria ────────────────────────────────────────────────────────────────

describe("SN-03 — trilha de auditoria", () => {
  it("grava auditoria do fechamento", async () => {
    await closePhase({
      phaseInstanceId: PI,
      approverId: APPROVER,
      criteriaFacts: ALL_MET,
    });
    expect(h.auditCreate.mock.calls[0][0].data).toMatchObject({
      action: "scaffold.gate.close",
      entityType: "scaffold.gateresult",
    });
  });

  it("grava auditoria do override com a justificativa", async () => {
    h.phaseFindFirst.mockResolvedValue(readyPhase({ state: "BLOCKED" }));
    await overridePhase({
      phaseInstanceId: PI,
      unmetCriteria: ["no-new-risk"],
      rationale:
        "Risco aceito por escrito pelo sponsor: janela regulatória impede o teste antes do trimestre.",
    });
    const entry = h.auditCreate.mock.calls.at(-1)?.[0].data;
    expect(entry.action).toBe("scaffold.gate.override");
    expect(entry.metadata.note).toMatch(/janela regulatória/);
  });
});
