import { describe, expect, it } from "vitest";
import {
  applyOverlay,
  detectConflicts,
  type OverlayOp,
  type TemplateShape,
} from "@/lib/scaffold/overlay-merge";

// ST-02 — overlay de cliente sobrevive ao upgrade da base, ou levanta conflito
// explícito.
//
// O overlay é uma LISTA DE OPERAÇÕES contra uma versão base, não uma cópia da
// árvore. Cópia seria fork, e fork é exatamente o que o SRD §5 manda não fazer:
// um fork não sabe dizer o que mudou, então publicar uma versão nova do método
// nunca chegaria a quem customizou.
//
// O caso de referência é o do protótipo: a Vanta afrouxa, sobre a v3, o mesmo
// critério de rollback que a v4 endureceu. Não há resposta certa automática —
// afrouxar por decisão do cliente e endurecer por decisão do método são as duas
// legítimas. Por isso o resultado é conflito, e não merge.

const V3: TemplateShape = {
  steps: [
    {
      key: "define-metric",
      statement: "Definir a métrica de comparação",
      required: true,
    },
    {
      key: "rollback-plan",
      statement: "Configurar o caminho de rollback",
      required: true,
    },
    {
      key: "run-pilot",
      statement: "Rodar o piloto em 20% do volume",
      required: true,
    },
  ],
  criteria: [
    {
      key: "beats-baseline",
      statement: "Piloto vence o baseline na métrica acordada",
    },
    { key: "no-new-risk", statement: "Nenhum risco novo introduzido" },
  ],
};

/** v4 endurece: acrescenta o critério de rollback em produção. */
const V4: TemplateShape = {
  steps: V3.steps,
  criteria: [
    ...V3.criteria,
    {
      key: "rollback-tested-prod",
      statement: "Rollback testado em produção ao menos uma vez",
    },
  ],
};

/** Overlay da Vanta sobre a v3: acrescenta o rollback, mas em staging. */
const VANTA: OverlayOp[] = [
  {
    op: "ADD",
    target: "criterion",
    key: "rollback-tested-prod",
    patch: { statement: "Rollback validado em staging com volume espelhado" },
  },
];

describe("applyOverlay — ADD", () => {
  it("acrescenta critério que a base não tem", () => {
    const out = applyOverlay(V3, VANTA);
    expect(out.criteria.map((c) => c.key)).toEqual([
      "beats-baseline",
      "no-new-risk",
      "rollback-tested-prod",
    ]);
    expect(out.criteria[2]?.statement).toMatch(/staging/);
  });

  it("acrescenta passo ao fim, preservando a ordem da base", () => {
    const out = applyOverlay(V3, [
      {
        op: "ADD",
        target: "step",
        key: "notify-compliance",
        patch: { statement: "Avisar compliance antes de ligar o piloto" },
      },
    ]);
    expect(out.steps.map((s) => s.key)).toEqual([
      "define-metric",
      "rollback-plan",
      "run-pilot",
      "notify-compliance",
    ]);
  });
});

describe("applyOverlay — REPLACE e REMOVE", () => {
  it("substitui o enunciado sem mover o item de lugar", () => {
    const out = applyOverlay(V3, [
      {
        op: "REPLACE",
        target: "step",
        key: "run-pilot",
        patch: { statement: "Rodar o piloto em 10% do volume" },
      },
    ]);
    expect(out.steps[2]).toMatchObject({
      key: "run-pilot",
      statement: "Rodar o piloto em 10% do volume",
    });
  });

  it("REPLACE mescla o patch — campo não citado fica como na base", () => {
    const out = applyOverlay(V3, [
      {
        op: "REPLACE",
        target: "step",
        key: "run-pilot",
        patch: { required: false },
      },
    ]);
    expect(out.steps[2]).toMatchObject({
      statement: "Rodar o piloto em 20% do volume",
      required: false,
    });
  });

  it("remove o item da base", () => {
    const out = applyOverlay(V3, [
      { op: "REMOVE", target: "criterion", key: "no-new-risk" },
    ]);
    expect(out.criteria.map((c) => c.key)).toEqual(["beats-baseline"]);
  });

  it("não muta a base — aplicar duas vezes dá o mesmo resultado", () => {
    const antes = JSON.stringify(V3);
    applyOverlay(V3, VANTA);
    applyOverlay(V3, VANTA);
    expect(JSON.stringify(V3)).toBe(antes);
  });

  it("overlay vazio devolve a base intacta", () => {
    expect(applyOverlay(V3, [])).toEqual(V3);
  });
});

describe("detectConflicts — o caso da Vanta", () => {
  it("ADD sobre chave que a versão nova passou a definir é conflito", () => {
    // O overlay afrouxa; a v4 endurece. Escolher automaticamente seria decidir
    // por alguém: quem afrouxou tinha razão comercial, quem endureceu tinha
    // razão de método.
    const c = detectConflicts(V3, V4, VANTA);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({
      targetKey: "rollback-tested-prod",
      target: "criterion",
      op: "ADD",
    });
  });

  it("a nota do conflito nomeia os dois lados", () => {
    const [c] = detectConflicts(V3, V4, VANTA);
    expect(c?.note).toMatch(/overlay/i);
    expect(c?.note).toMatch(/vers[ãa]o nova/i);
  });
});

describe("detectConflicts — as outras formas", () => {
  it("REPLACE sobre item que a versão nova removeu é conflito", () => {
    const semRollback: TemplateShape = {
      steps: V3.steps.filter((s) => s.key !== "rollback-plan"),
      criteria: V3.criteria,
    };
    const c = detectConflicts(V3, semRollback, [
      {
        op: "REPLACE",
        target: "step",
        key: "rollback-plan",
        patch: { statement: "Rollback só em staging" },
      },
    ]);
    expect(c).toHaveLength(1);
    expect(c[0]?.reason).toBe("TARGET_REMOVED");
  });

  it("REMOVE sobre item que a versão nova removeu NÃO é conflito", () => {
    // As duas pontas concordam. Levantar conflito aqui obrigaria alguém a
    // resolver uma discordância que não existe.
    const semRisco: TemplateShape = {
      steps: V3.steps,
      criteria: V3.criteria.filter((c) => c.key !== "no-new-risk"),
    };
    expect(
      detectConflicts(V3, semRisco, [
        { op: "REMOVE", target: "criterion", key: "no-new-risk" },
      ])
    ).toEqual([]);
  });

  it("REPLACE sobre campo que a versão nova também mudou é conflito", () => {
    const v4Mudou: TemplateShape = {
      steps: V3.steps.map((s) =>
        s.key === "run-pilot"
          ? { ...s, statement: "Rodar o piloto em 30% do volume" }
          : s
      ),
      criteria: V3.criteria,
    };
    const c = detectConflicts(V3, v4Mudou, [
      {
        op: "REPLACE",
        target: "step",
        key: "run-pilot",
        patch: { statement: "Rodar o piloto em 10% do volume" },
      },
    ]);
    expect(c).toHaveLength(1);
    expect(c[0]?.reason).toBe("BOTH_EDITED");
    expect(c[0]?.field).toBe("statement");
  });

  it("REPLACE sobre campo que a versão nova NÃO tocou reaplica limpo", () => {
    // É o caso que ST-02 chama de "sobrevive ao upgrade": a customização
    // continua valendo sem intervenção.
    const v4Outro: TemplateShape = {
      steps: V3.steps.map((s) =>
        s.key === "define-metric"
          ? { ...s, statement: "Definir métrica E limiar de vitória" }
          : s
      ),
      criteria: V3.criteria,
    };
    expect(
      detectConflicts(V3, v4Outro, [
        {
          op: "REPLACE",
          target: "step",
          key: "run-pilot",
          patch: { statement: "Rodar o piloto em 10% do volume" },
        },
      ])
    ).toEqual([]);
  });

  it("ADD de chave que a versão nova continua sem ter reaplica limpo", () => {
    expect(
      detectConflicts(V3, V3, [
        {
          op: "ADD",
          target: "step",
          key: "notify-compliance",
          patch: { statement: "Avisar compliance" },
        },
      ])
    ).toEqual([]);
  });

  it("acumula um conflito por operação, não um por versão", () => {
    const c = detectConflicts(V3, V4, [
      ...VANTA,
      {
        op: "REPLACE",
        target: "criterion",
        key: "sumido",
        patch: { statement: "x" },
      },
    ]);
    expect(c).toHaveLength(2);
    expect(c.map((x) => x.targetKey).sort()).toEqual([
      "rollback-tested-prod",
      "sumido",
    ]);
  });
});
