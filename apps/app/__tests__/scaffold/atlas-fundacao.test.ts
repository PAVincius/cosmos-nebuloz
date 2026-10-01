import { describe, expect, it } from "vitest";
import { assessReadiness } from "@/lib/meridian/readiness-bands";
import {
  applyOverlay,
  type OverlayOp,
  type TemplateShape,
  validateOverlay,
} from "@/lib/scaffold/overlay-merge";
import {
  ATLAS_DEMO,
  applyDemoOverlay,
  FUNDACAO,
} from "../../../../packages/database/scripts/scaffold-templates-fundacao";

// O cliente fictício Atlas de ponta a ponta, na Fundação de Prontidão de IA
// (D-24): o diagnóstico dá o arquétipo, o overlay do cliente passa pelas regras
// do overlay e a demonstração aplica o mesmo que o produto aplicaria.

const V1 = FUNDACAO.versions[0];
const passos = (V1?.phases ?? []).flatMap((f) => f.steps);
const entregaveis = (V1?.phases ?? []).flatMap((f) => f.deliverables ?? []);

const BASE: TemplateShape = {
  steps: passos.map((s) => ({
    key: s.key,
    statement: s.statement,
    required: s.required ?? true,
    expectedArtefact: s.expectedArtefact,
  })),
  criteria: [],
  deliverables: entregaveis.map((d) => ({
    key: d.code,
    statement: d.title,
    stepCode: d.stepCode,
    required: d.required ?? true,
  })),
};

const OPS = ATLAS_DEMO.overlay.ops as unknown as OverlayOp[];

describe("Atlas: diagnóstico do Meridian", () => {
  const perfil = assessReadiness(
    ATLAS_DEMO.readings.map((r) => ({
      axis: r.axis as "DATA",
      score: r.score,
      confidence: r.confidence,
    }))
  );

  it("é Piloto sem chão com traço de Campeão isolado, como no briefing", () => {
    expect(perfil.dominant).toBe("PILOT_NO_GROUND");
    expect(perfil.secondary).toBe("ISOLATED_CHAMPION");
  });

  it("Pessoas é o único eixo não confiável, então o workshop A2 vale", () => {
    expect(perfil.unreliableAxes).toEqual(["PEOPLE"]);
    const a2 = entregaveis.find((d) => d.code === "A2.1");
    expect(a2?.required ?? true).toBe(true);
  });

  it("Dados e Infra estão em Inicial: é por eles que a trilha começa", () => {
    const faixa = (axis: string) =>
      perfil.axes.find((a) => a.axis === axis)?.band;
    expect(faixa("DATA")).toBe("INITIAL");
    expect(faixa("INFRASTRUCTURE")).toBe("INITIAL");
  });
});

describe("Atlas: overlay do cliente", () => {
  it("o consultor pode salvá-lo: a dispensa do P3.2 (obrigatório) é ato dele, com motivo", () => {
    expect(validateOverlay(BASE, OPS, { role: "CONSULTANT" }).blocking).toEqual(
      []
    );
  });

  it("quem não é consultor não consegue dispensar o P3.2", () => {
    const r = validateOverlay(BASE, OPS, { role: "PROCESS_OWNER" });
    expect(r.blocking.map((v) => v.code)).toEqual([
      "REQUIRED_DELIVERABLE_REMOVAL_NOT_CONSULTANT",
    ]);
    expect(r.blocking[0]?.key).toBe("P3.2");
  });

  it("não recusa por passo órfão: o overlay não remove nenhum passo", () => {
    expect(OPS.some((o) => o.op === "REMOVE" && o.target === "step")).toBe(
      false
    );
  });
});

describe("Atlas: a demonstração aplica o mesmo que o produto", () => {
  it("applyDemoOverlay (seed) e applyOverlay (app) dão o mesmo resultado", () => {
    const seed = applyDemoOverlay(
      passos.map((s) => ({ key: s.key, statement: s.statement })),
      entregaveis.map((d) => ({
        code: d.code,
        title: d.title,
        required: d.required ?? true,
      })),
      ATLAS_DEMO.overlay.ops
    );
    const app = applyOverlay(BASE, OPS);

    expect(seed.steps.map((s) => [s.key, s.statement])).toEqual(
      app.steps.map((s) => [s.key, s.statement])
    );
    expect(
      seed.deliverables.map((d) => [
        d.code,
        d.title,
        d.required,
        d.dispensedReason,
      ])
    ).toEqual(
      (app.deliverables ?? []).map((d) => [
        d.key,
        d.statement,
        d.required ?? true,
        d.dispensedReason ?? null,
      ])
    );
  });
});
