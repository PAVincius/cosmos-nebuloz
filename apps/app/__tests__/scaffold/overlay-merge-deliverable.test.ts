import { describe, expect, it } from "vitest";
import {
  applyOverlay,
  detectConflicts,
  type OverlayOp,
  type TemplateShape,
  validateOverlay,
} from "@/lib/scaffold/overlay-merge";

// Overlay de entregável (trilha AI_READINESS_FOUNDATION).
//
// D-24 §7.7: REMOVE de entregável nunca o faz sumir — a instância nasce
// dispensada, com o motivo. Em entregável obrigatório só o CONSULTANT remove.
//
// O entregável entra como terceiro alvo do overlay, ao lado de passo e critério.
// A chave do entregável é o código ("B1.1"). A regra nova existe porque o
// entregável obrigatório é o que trava o gate: um overlay que o remove — ou o
// afrouxa para opcional — desliga o gate por outra porta, em silêncio.

const BASE: TemplateShape = {
  steps: [
    { key: "B1", statement: "Fundação mínima de Dados e Infra" },
    { key: "B2", statement: "AI Adopt: personas e papéis" },
  ],
  criteria: [],
  deliverables: [
    {
      key: "B1.1",
      statement: "Catálogo inicial de dados para IA",
      stepCode: "B1",
      required: true,
    },
    {
      key: "B2.1",
      statement: "Trilhas de capacitação por persona",
      stepCode: "B2",
      required: true,
    },
    {
      key: "B2.2",
      statement: "Papéis formais de IA e dados",
      stepCode: "B2",
      required: false,
    },
  ],
};

describe("applyOverlay — alvo deliverable", () => {
  it("REPLACE muda o título e preserva o resto", () => {
    const out = applyOverlay(BASE, [
      {
        op: "REPLACE",
        target: "deliverable",
        key: "B1.1",
        patch: { statement: "Catálogo de dados no DataHub" },
      },
    ]);
    const d = out.deliverables?.find((x) => x.key === "B1.1");
    expect(d?.statement).toBe("Catálogo de dados no DataHub");
    expect(d?.stepCode).toBe("B1");
    expect(d?.required).toBe(true);
  });

  it("REMOVE não some com o entregável: vira dispensado, com o motivo", () => {
    const out = applyOverlay(BASE, [
      {
        op: "REMOVE",
        target: "deliverable",
        key: "B2.2",
        reason: "Os papéis de dado já existem no cliente",
      },
    ]);
    expect(out.deliverables?.map((d) => d.key)).toEqual([
      "B1.1",
      "B2.1",
      "B2.2",
    ]);
    const d = out.deliverables?.find((x) => x.key === "B2.2");
    expect(d?.required).toBe(false);
    expect(d?.dispensedReason).toBe("Os papéis de dado já existem no cliente");
    expect(out.steps).toHaveLength(2);
  });

  it("REMOVE de obrigatório também dispensa (o gate deixa de esperar por ele)", () => {
    const out = applyOverlay(BASE, [
      {
        op: "REMOVE",
        target: "deliverable",
        key: "B1.1",
        reason: "x".repeat(12),
      },
    ]);
    const d = out.deliverables?.find((x) => x.key === "B1.1");
    expect(d?.required).toBe(false);
    expect(d?.dispensedReason).toBeTruthy();
  });

  it("não muta a base", () => {
    applyOverlay(BASE, [
      {
        op: "REMOVE",
        target: "deliverable",
        key: "B1.1",
        reason: "x".repeat(12),
      },
    ]);
    expect(BASE.deliverables?.[0]?.required).toBe(true);
    expect(BASE.deliverables?.[0]?.dispensedReason).toBeUndefined();
  });

  it("base sem entregáveis continua valendo (forma antiga)", () => {
    const out = applyOverlay({ steps: [], criteria: [] }, []);
    expect(out.deliverables).toBeUndefined();
  });
});

describe("validateOverlay", () => {
  const consultant = { role: "CONSULTANT" };
  const owner = { role: "PROCESS_OWNER" };
  const remove = (key: string, reason?: string): OverlayOp => ({
    op: "REMOVE",
    target: "deliverable",
    key,
    reason,
  });
  const codes = (r: ReturnType<typeof validateOverlay>) =>
    r.blocking.map((v) => v.code);

  it("consultor remove entregável obrigatório, com motivo", () => {
    const r = validateOverlay(
      BASE,
      [remove("B1.1", "Cliente já mantém catálogo no DataHub")],
      consultant
    );
    expect(r.blocking).toEqual([]);
  });

  it("quem não é consultor não remove obrigatório", () => {
    const r = validateOverlay(
      BASE,
      [remove("B1.1", "Cliente já mantém catálogo no DataHub")],
      owner
    );
    expect(codes(r)).toEqual(["REQUIRED_DELIVERABLE_REMOVAL_NOT_CONSULTANT"]);
    expect(r.blocking[0]?.key).toBe("B1.1");
  });

  it("afrouxar obrigatório para opcional é a mesma coisa que remover: só consultor", () => {
    const op: OverlayOp = {
      op: "REPLACE",
      target: "deliverable",
      key: "B1.1",
      patch: { required: false },
    };
    expect(codes(validateOverlay(BASE, [op], owner))).toEqual([
      "REQUIRED_DELIVERABLE_REMOVAL_NOT_CONSULTANT",
    ]);
    expect(validateOverlay(BASE, [op], consultant).blocking).toEqual([]);
  });

  it("qualquer papel remove opcional, com motivo", () => {
    const r = validateOverlay(
      BASE,
      [remove("B2.2", "Papéis de dado já existem no cliente")],
      owner
    );
    expect(r.blocking).toEqual([]);
  });

  it("remover sem motivo, ou com motivo curto, é recusado até para consultor", () => {
    expect(codes(validateOverlay(BASE, [remove("B2.2")], consultant))).toEqual([
      "REMOVAL_WITHOUT_REASON",
    ]);
    expect(
      codes(validateOverlay(BASE, [remove("B2.2", "  curto  ")], consultant))
    ).toEqual(["REMOVAL_WITHOUT_REASON"]);
  });

  it("entregável que o overlay acrescenta e depois remove é do cliente: qualquer papel", () => {
    const r = validateOverlay(
      BASE,
      [
        {
          op: "ADD",
          target: "deliverable",
          key: "X9.1",
          patch: { statement: "Extra", required: true },
        },
        remove("X9.1", "Acrescentado por engano, desfaz"),
      ],
      owner
    );
    expect(r.blocking).toEqual([]);
  });

  it("recusa remover passo que é o único produtor de entregável obrigatório", () => {
    const r = validateOverlay(
      BASE,
      [{ op: "REMOVE", target: "step", key: "B2" }],
      consultant
    );
    expect(codes(r)).toEqual(["STEP_ORPHANS_REQUIRED_DELIVERABLE"]);
    expect(r.blocking[0]).toMatchObject({ key: "B2", deliverables: ["B2.1"] });
  });

  it("aceita remover o passo quando o mesmo overlay dispensa o entregável (pela regra do consultor)", () => {
    const ops: OverlayOp[] = [
      { op: "REMOVE", target: "step", key: "B2" },
      remove("B2.1", "Cliente já tem trilhas de capacitação"),
    ];
    expect(validateOverlay(BASE, ops, consultant).blocking).toEqual([]);
    expect(codes(validateOverlay(BASE, ops, owner))).toEqual([
      "REQUIRED_DELIVERABLE_REMOVAL_NOT_CONSULTANT",
    ]);
  });

  it("recusa operação de critério, de qualquer papel: o gate lê a versão, não o overlay", () => {
    const op: OverlayOp = {
      op: "REPLACE",
      target: "criterion",
      key: "beats-baseline",
      patch: { statement: "Afrouxado" },
    };
    for (const actor of [consultant, owner]) {
      const r = validateOverlay(BASE, [op], actor);
      expect(codes(r)).toEqual(["CRITERION_OVERLAY_NOT_EFFECTIVE"]);
      expect(r.blocking[0]?.note).toContain("versão nova do template");
    }
  });

  it("remover passo sem entregável obrigatório é livre", () => {
    const shape: TemplateShape = {
      ...BASE,
      deliverables: BASE.deliverables?.filter((d) => d.key !== "B2.1"),
    };
    const r = validateOverlay(
      shape,
      [{ op: "REMOVE", target: "step", key: "B2" }],
      owner
    );
    expect(r.blocking).toEqual([]);
  });
});

describe("detectConflicts — alvo deliverable", () => {
  const next: TemplateShape = {
    ...BASE,
    deliverables: [
      {
        key: "B1.1",
        statement: "Catálogo mínimo de dados, com dono e sensibilidade",
        stepCode: "B1",
        required: true,
      },
      ...(BASE.deliverables ?? []).filter(
        (d) => d.key !== "B1.1" && d.key !== "B2.2"
      ),
    ],
  };

  it("levanta BOTH_EDITED quando método e overlay mudaram o título", () => {
    const c = detectConflicts(BASE, next, [
      {
        op: "REPLACE",
        target: "deliverable",
        key: "B1.1",
        patch: { statement: "Catálogo de dados no DataHub" },
      },
    ]);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({
      target: "deliverable",
      targetKey: "B1.1",
      field: "statement",
      reason: "BOTH_EDITED",
    });
    expect(c[0]?.note).toContain("entregável");
  });

  it("levanta TARGET_REMOVED quando a versão nova tirou o entregável", () => {
    const c = detectConflicts(BASE, next, [
      {
        op: "REPLACE",
        target: "deliverable",
        key: "B2.2",
        patch: { statement: "Papéis no Okta" },
      },
    ]);
    expect(c.map((x) => x.reason)).toEqual(["TARGET_REMOVED"]);
  });

  it("REMOVE concordante não é conflito", () => {
    const c = detectConflicts(BASE, next, [
      {
        op: "REMOVE",
        target: "deliverable",
        key: "B2.2",
        reason: "Papéis de dado já existem",
      },
    ]);
    expect(c).toEqual([]);
  });
});
