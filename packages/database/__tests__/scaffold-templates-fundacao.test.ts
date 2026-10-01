import { describe, expect, it } from "vitest";
import { CORPORA } from "../scripts/regulacao-corpora";
import { findInvalidRequirementRefs } from "../scripts/scaffold-requirement-refs";
import {
  ATLAS_DEMO,
  applyDemoOverlay,
  FUNDACAO,
  FUNDACAO_KEY,
} from "../scripts/scaffold-templates-fundacao";

// Fundação de Prontidão de IA (D-24, revisão do Atlas de 2026-09-30).
//
// O molde tem 13 passos e 16 entregáveis, 4 por fase. O teste fixa a estrutura
// que a revisão decidiu — reavaliação do Meridian DENTRO da fase cujo gate lê o
// score, política mínima na ASSESS, catálogo e ambiente separados no PILOT — e
// que cada referência a uma norma existe no catálogo do Charter.

const V1 = FUNDACAO.versions[0];
const FASES = ["ASSESS", "PILOT", "SCALE", "EMBED"] as const;
const fase = (p: (typeof FASES)[number]) => {
  const f = V1?.phases.find((x) => x.phase === p);
  if (!f) {
    throw new Error(`sem fase ${p}`);
  }
  return f;
};
const entregaveis = FASES.flatMap((p) => fase(p).deliverables ?? []);

describe("identidade do molde", () => {
  it("chave minúscula com hífen, nome, uma versão v1.0 do método Nebuloz", () => {
    expect(FUNDACAO.key).toBe("ai-readiness-foundation");
    expect(FUNDACAO_KEY).toBe(FUNDACAO.key);
    expect(FUNDACAO.name).toBe("Fundação de Prontidão de IA");
    expect(FUNDACAO.versions).toHaveLength(1);
    expect(V1?.label).toBe("v1.0");
    expect(V1?.authorLabel).toBe("método Nebuloz");
  });

  it("não tem forma de trabalho: a trilha cobre a organização, não uma forma", () => {
    expect(FUNDACAO.archetype).toBeUndefined();
  });
});

describe("passos", () => {
  it("são 13, com os códigos da revisão, em ordem de fase", () => {
    expect(FASES.map((p) => fase(p).steps.map((s) => s.key))).toEqual([
      ["A1", "A2", "A3", "A4"],
      ["P1", "P2", "P3"],
      ["S1", "S2", "S3"],
      ["E1", "E2", "E3"],
    ]);
  });

  it("só o A2 é dispensável: workshop sem eixo de confiança baixa não tem o que fazer", () => {
    const naoObrigatorios = FASES.flatMap((p) =>
      fase(p)
        .steps.filter((s) => s.required === false)
        .map((s) => s.key)
    );
    expect(naoObrigatorios).toEqual(["A2"]);
  });

  it("a reavaliação do Meridian é passo da fase cujo gate lê o score: S3 no SCALE, E3 no EMBED", () => {
    expect(fase("SCALE").steps.map((s) => s.key)).toContain("S3");
    expect(fase("EMBED").steps.map((s) => s.key)).toContain("E3");
    // O gate do PILOT não olha score: nenhuma reavaliação lá.
    expect(fase("PILOT").steps.some((s) => /reavali/i.test(s.statement))).toBe(
      false
    );
  });

  it("a política mínima de uso de IA (A4) fica na ASSESS, antes de o PILOT subir dado", () => {
    expect(fase("ASSESS").steps.map((s) => s.key)).toContain("A4");
  });

  it("não tem passo de PILOT sem entregável nem entregável sem passo da mesma fase", () => {
    for (const p of FASES) {
      const f = fase(p);
      const chaves = new Set(f.steps.map((s) => s.key));
      for (const d of f.deliverables ?? []) {
        expect(chaves.has(d.stepCode)).toBe(true);
      }
      for (const s of f.steps) {
        expect((f.deliverables ?? []).some((d) => d.stepCode === s.key)).toBe(
          true
        );
      }
    }
  });
});

describe("prazos (estimateMinutes)", () => {
  const passosTodos = FASES.flatMap((p) => fase(p).steps);
  const minutos = (key: string) =>
    passosTodos.find((s) => s.key === key)?.estimateMinutes;

  it("todo passo tem estimativa, em minutos inteiros", () => {
    for (const s of passosTodos) {
      expect(Number.isInteger(s.estimateMinutes), s.key).toBe(true);
      expect(s.estimateMinutes ?? 0, s.key).toBeGreaterThan(0);
    }
  });

  it("os prazos da proposta do CEO viram a mediana da faixa, a 40 h por semana (2.400 min)", () => {
    expect(minutos("A1")).toBe(3600); // 1 a 2 semanas → 1,5
    expect(minutos("A2")).toBe(2400); // 1 semana
    expect(minutos("A3")).toBe(1920); // 3 a 5 dias → 4 dias de 8 h
    expect(minutos("P3")).toBe(10_800); // AI Adopt, 3 a 6 semanas → 4,5
    expect(minutos("S1")).toBe(14_400); // 4 a 8 semanas → 6
    expect(minutos("S2")).toBe(7200); // 2 a 4 semanas → 3
    expect(minutos("E1")).toBe(14_400); // 4 a 8 semanas → 6
    expect(minutos("E2")).toBe(10_800); // 3 a 6 semanas → 4,5
  });

  it("catálogo e ambiente dividem a faixa de 4 a 8 semanas da fundação mínima: cada um leva a mediana, em paralelo", () => {
    expect(minutos("P1")).toBe(14_400);
    expect(minutos("P2")).toBe(14_400);
  });

  it("A4, S3 e E3 são estimativa do CPO (A4 1 semana, S3 e E3 2 semanas) e o texto do passo diz que é a calibrar", () => {
    expect(minutos("A4")).toBe(2400);
    expect(minutos("S3")).toBe(4800);
    expect(minutos("E3")).toBe(4800);
    for (const key of ["A4", "S3", "E3"]) {
      const s = passosTodos.find((x) => x.key === key);
      expect(s?.statement, key).toMatch(/estimativa a calibrar/);
    }
  });

  it("a faixa original fica no texto do passo, onde a mediana a esconderia", () => {
    const texto = (k: string) =>
      passosTodos.find((s) => s.key === k)?.statement;
    expect(texto("A1")).toMatch(/1 a 2 semanas/);
    expect(texto("A3")).toMatch(/3 a 5 dias/);
    expect(texto("P3")).toMatch(/3 a 6 semanas/);
    expect(texto("S1")).toMatch(/4 a 8 semanas/);
    expect(texto("E2")).toMatch(/3 a 6 semanas/);
  });
});

describe("entregáveis", () => {
  it("são 16, 4 por fase, com código único no formato X1.1", () => {
    expect(entregaveis).toHaveLength(16);
    expect(FASES.map((p) => fase(p).deliverables?.length)).toEqual([
      4, 4, 4, 4,
    ]);
    expect(new Set(entregaveis.map((d) => d.code)).size).toBe(16);
    for (const d of entregaveis) {
      expect(d.code).toMatch(/^[APSE]\d\.\d$/);
      expect(d.code.split(".")[0]).toBe(d.stepCode);
      expect(d.title.length).toBeGreaterThan(3);
      expect(d.description.length).toBeGreaterThan(20);
    }
  });

  it("não reusa o A3.2, que é o caso de negócio assinado", () => {
    expect(entregaveis.map((d) => d.code)).not.toContain("A3.2");
  });

  it("nenhum exige módulo (ninguém compra esta trilha sem o Meridian)", () => {
    for (const d of entregaveis) {
      expect(d.requiresModule).toBeUndefined();
    }
  });

  it("todos são obrigatórios: só se dispensa com motivo, pelo consultor", () => {
    for (const d of entregaveis) {
      expect(d.required ?? true).toBe(true);
    }
  });

  it("catálogo é do OWNER, ambiente é TECHNICAL, AI Adopt é o P3 (separados no PILOT)", () => {
    const por = (code: string) => entregaveis.find((d) => d.code === code);
    expect(por("P1.1")?.producer).toBe("OWNER");
    expect(por("P2.1")?.producer).toBe("TECHNICAL");
    expect(por("P2.1")?.kind).toBe("CONFIGURATION");
    expect(por("P3.1")?.kind).toBe("TRAINING");
    expect(por("P3.2")?.producer).toBe("OWNER");
  });

  it("a política mínima (A4.1) é do dono do processo e não substitui o E1.1", () => {
    const a4 = entregaveis.find((d) => d.code === "A4.1");
    expect(a4?.producer).toBe("OWNER");
    expect(a4?.description).toMatch(/E1\.1/);
    expect(entregaveis.find((d) => d.code === "E1.1")).toBeDefined();
  });

  it("as reavaliações (S3.1, E3.1) são REPORT do consultor e citam o AS-xxx", () => {
    for (const code of ["S3.1", "E3.1"]) {
      const d = entregaveis.find((x) => x.code === code);
      expect(d?.kind).toBe("REPORT");
      expect(d?.producer).toBe("CONSULTANT");
      expect(d?.description).toMatch(/AS-xxx/);
      expect(d?.description).toMatch(/reassessmentOfId/);
    }
  });
});

describe("critérios de gate", () => {
  const chaves = (p: (typeof FASES)[number]) =>
    fase(p).criteria.map((c) => c.key);

  it("a ASSESS pede a política mínima aprovada e o baseline assinado (SG-04, derivado)", () => {
    expect(chaves("ASSESS")).toContain("minimum-policy-approved");
    const base = fase("ASSESS").criteria.find(
      (c) => c.key === "baseline-signed"
    );
    expect(base?.evaluationType).toBe("DERIVED");
    // O baseline são os scores do assessment, não quatro semanas de dado.
    expect(chaves("ASSESS")).not.toContain("baseline-measured");
  });

  it("dado só entra no ambiente depois que a fonte tem linha no catálogo: está no enunciado do P2 e no gate do PILOT", () => {
    const p2 = fase("PILOT").steps.find((s) => s.key === "P2");
    expect(p2?.statement).toMatch(/dado só entra no ambiente/i);
    expect(p2?.statement).toMatch(/catálogo \(P1\)/);
    expect(p2?.statement).toMatch(/dono e sensibilidade/);
    const criterio = fase("PILOT").criteria.find(
      (c) => c.key === "data-only-from-catalog"
    );
    expect(criterio?.statement).toMatch(/catálogo \(P1\)/);
    expect(criterio?.statement).toMatch(/dono e sensibilidade/);
    expect(criterio?.evaluationType ?? "MANUAL").toBe("MANUAL");
  });

  it("o gate do PILOT confere o baseline operacional como nova versão do caso", () => {
    expect(chaves("PILOT")).toContain("operational-baseline-recorded");
  });

  it("v1: todo critério é MANUAL, salvo SG-04, SG-05 e SG-06, que o sistema conhece", () => {
    const derivados = FASES.flatMap((p) =>
      fase(p)
        .criteria.filter((c) => c.evaluationType === "DERIVED")
        .map((c) => c.key)
    );
    expect(derivados.sort()).toEqual([
      "baseline-signed",
      "charter-policy-acked",
      "observation-window",
    ]);
  });

  it("os critérios que olham o Meridian citam o AS-xxx e a faixa exigida", () => {
    const scale = fase("SCALE").criteria.find(
      (c) => c.key === "data-infra-forming"
    );
    const embed = fase("EMBED").criteria.find(
      (c) => c.key === "data-governance-infra-structured"
    );
    expect(scale?.statement).toMatch(/AS-xxx/);
    expect(scale?.statement).toMatch(/Em formação/);
    expect(scale?.statement).toMatch(/S3/);
    expect(embed?.statement).toMatch(/AS-xxx/);
    expect(embed?.statement).toMatch(/Estruturado/);
    expect(embed?.statement).toMatch(/E3/);
  });

  it("chaves de critério únicas na versão inteira", () => {
    const todas = FASES.flatMap(chaves);
    expect(new Set(todas).size).toBe(todas.length);
  });
});

describe("requirementRefs (D-23 F1)", () => {
  const refs = entregaveis.flatMap((d) => d.requirementRefs ?? []);

  it("só os entregáveis de governança do EMBED citam normas", () => {
    const comRef = entregaveis
      .filter((d) => (d.requirementRefs?.length ?? 0) > 0)
      .map((d) => d.code);
    expect(comRef).toEqual(["E1.1", "E2.1", "E2.2"]);
  });

  it("referências finais do Norte (§7.7): AIA-09 e ISO-CL08 ficaram de fora", () => {
    const codigos = (code: string) =>
      entregaveis
        .find((d) => d.code === code)
        ?.requirementRefs?.map((r) => r.codigo);
    expect(codigos("E1.1")).toEqual([
      "ISO-CL05",
      "ISO-CL06",
      "NIST-GOVERN-1",
      "NIST-MANAGE-1",
    ]);
    expect(codigos("E2.1")).toEqual([
      "ISO-CL04",
      "NIST-MAP-1",
      "NIST-MAP-2",
      "LGPD-ART37",
    ]);
    expect(codigos("E2.2")).toEqual(["ISO-CL06"]);
    // O art. 9 do AI Act é obrigação do fornecedor de alto risco: só com perfil.
    expect(refs.map((r) => r.codigo)).not.toContain("AIA-09");
  });

  it("toda referência existe no catálogo do Charter (conjunto, versão e código)", () => {
    expect(refs.length).toBeGreaterThan(0);
    expect(findInvalidRequirementRefs(refs, CORPORA)).toEqual([]);
  });

  it("recusa referência a código, versão ou conjunto que o catálogo não tem", () => {
    const ruins = [
      { set: "NIST AI RMF 1.0", versao: "1.0", codigo: "NIST-GOVERN-99" },
      { set: "NIST AI RMF 1.0", versao: "9.9", codigo: "NIST-GOVERN-1" },
      { set: "PL 2338", versao: "2023", codigo: "PL-1" },
    ];
    const invalidas = findInvalidRequirementRefs(ruins, CORPORA);
    expect(invalidas).toHaveLength(3);
    expect(invalidas[0]?.motivo).toContain("NIST-GOVERN-99");
    expect(invalidas[2]?.motivo).toContain("PL 2338");
  });

  it("a ISO 42001 é só citada (licença REFERENCIA): a descrição não copia a norma", () => {
    const iso = CORPORA.find((c) => c.nome.startsWith("ISO/IEC 42001"));
    expect(iso?.licenca).toBe("REFERENCIA");
    const soa = entregaveis.find((d) => d.code === "E2.2");
    expect(soa?.description).toMatch(/texto próprio/);
  });
});

describe("Atlas (demonstração)", () => {
  const steps = FASES.flatMap((p) => fase(p).steps);
  const aplicado = applyDemoOverlay(
    steps.map((s) => ({ key: s.key, statement: s.statement })),
    entregaveis.map((d) => ({
      code: d.code,
      title: d.title,
      required: d.required ?? true,
    })),
    ATLAS_DEMO.overlay.ops
  );

  it("o overlay troca o enunciado do P2 e o título do P1.1", () => {
    expect(aplicado.steps.find((s) => s.key === "P2")?.statement).toMatch(
      /Databricks do Atlas/
    );
    expect(aplicado.deliverables.find((d) => d.code === "P1.1")?.title).toMatch(
      /DataHub do Atlas/
    );
  });

  it("o REMOVE do P3.2 não apaga: dispensa com o motivo e deixa de ser obrigatório", () => {
    expect(aplicado.deliverables).toHaveLength(16);
    const p32 = aplicado.deliverables.find((d) => d.code === "P3.2");
    expect(p32?.required).toBe(false);
    expect(p32?.dispensedReason).toMatch(/já existem no Atlas/);
    expect(
      aplicado.deliverables.filter((d) => d.dispensedReason).map((d) => d.code)
    ).toEqual(["P3.2"]);
  });

  it("não muda o que o overlay não toca", () => {
    const sem = applyDemoOverlay(
      steps.map((s) => ({ key: s.key, statement: s.statement })),
      entregaveis.map((d) => ({
        code: d.code,
        title: d.title,
        required: true,
      })),
      []
    );
    expect(sem.steps).toEqual(
      steps.map((s) => ({ key: s.key, statement: s.statement }))
    );
    expect(sem.deliverables.every((d) => d.dispensedReason === null)).toBe(
      true
    );
  });

  it("os scores são os do briefing, nos cinco eixos", () => {
    expect(
      Object.fromEntries(ATLAS_DEMO.readings.map((r) => [r.axis, r.score]))
    ).toEqual({
      DATA: 32,
      PROCESS: 58,
      PEOPLE: 47,
      GOVERNANCE: 41,
      INFRASTRUCTURE: 36,
    });
  });
});

import { vi } from "vitest";
import { TEMPLATES } from "../scripts/scaffold-templates";

describe("a Fundação no catálogo e no upsert do seed", () => {
  it("entra em TEMPLATES depois das cinco formas, sem forma de trabalho", () => {
    expect(TEMPLATES).toHaveLength(6);
    expect(TEMPLATES.map((t) => t.key)).toEqual([
      "triage",
      "docreview",
      "reporting",
      "conversational",
      "analysis",
      "ai-readiness-foundation",
    ]);
    expect(TEMPLATES.at(-1)?.archetype).toBeUndefined();
    for (const t of TEMPLATES.slice(0, 5)) {
      expect(t.archetype).toBeDefined();
    }
  });

  const fakeDb = () => {
    const calls = {
      templateUpsert: vi.fn().mockResolvedValue({ id: "tpl1" }),
      versionCreate: vi.fn().mockResolvedValue({ id: "ver1" }),
      stepCreateMany: vi.fn(),
      criterionCreateMany: vi.fn(),
      deliverableCreateMany: vi.fn(),
    };
    const db = {
      scaffoldTemplate: { upsert: calls.templateUpsert },
      scaffoldTemplateVersion: { findUnique: async () => null },
      $transaction: async (fn: (tx: unknown) => Promise<void>) =>
        fn({
          scaffoldTemplateVersion: { create: calls.versionCreate },
          scaffoldStepTemplate: { createMany: calls.stepCreateMany },
          scaffoldGateCriterion: { createMany: calls.criterionCreateMany },
          scaffoldDeliverableTemplate: {
            createMany: calls.deliverableCreateMany,
          },
        }),
    };
    return { db, calls };
  };

  it("grava o template com archetype nulo, não ausente", async () => {
    const { upsertTemplate } = await import("../scripts/seed-scaffold.mts");
    const { db, calls } = fakeDb();
    await upsertTemplate(db as never, FUNDACAO);
    expect(calls.templateUpsert.mock.calls[0]?.[0].create).toEqual({
      key: "ai-readiness-foundation",
      name: "Fundação de Prontidão de IA",
      archetype: null,
    });
  });

  it("grava os prazos dos passos e as referências finais dos entregáveis", async () => {
    const { upsertTemplate } = await import("../scripts/seed-scaffold.mts");
    const { db, calls } = fakeDb();
    const r = await upsertTemplate(db as never, FUNDACAO);
    expect(r).toEqual({ created: 1, skipped: 0 });

    const passos = calls.stepCreateMany.mock.calls.flatMap(
      (c) => c[0].data as { key: string; estimateMinutes: number }[]
    );
    expect(passos).toHaveLength(13);
    expect(passos.find((p) => p.key === "S3")?.estimateMinutes).toBe(4800);

    const entregas = calls.deliverableCreateMany.mock.calls.flatMap(
      (c) =>
        c[0].data as {
          code: string;
          requirementRefs?: { codigo: string }[];
        }[]
    );
    expect(entregas).toHaveLength(16);
    expect(entregas.find((d) => d.code === "E2.2")?.requirementRefs).toEqual([
      expect.objectContaining({ codigo: "ISO-CL06" }),
    ]);
    expect(
      entregas.find((d) => d.code === "A1.1")?.requirementRefs
    ).toBeUndefined();
  });

  it("recusa publicar entregável que cita exigência que o catálogo do Charter não tem", async () => {
    const { upsertTemplate } = await import("../scripts/seed-scaffold.mts");
    const { db, calls } = fakeDb();
    const ruim = structuredClone(FUNDACAO);
    const e1 = ruim.versions[0]?.phases
      .flatMap((f) => f.deliverables ?? [])
      .find((d) => d.code === "E1.1");
    e1?.requirementRefs?.push({
      set: "NIST AI RMF 1.0",
      versao: "1.0",
      codigo: "NIST-INEXISTENTE",
    });
    await expect(upsertTemplate(db as never, ruim)).rejects.toThrow(
      /NIST-INEXISTENTE/
    );
    expect(calls.versionCreate).not.toHaveBeenCalled();
  });
});

import { DEMO_TRACKS, seedDemoTrack } from "../scripts/seed-scaffold-demo.mts";

describe("seed de demonstração: o Atlas nasce ligado ao assessment dele (D-27)", () => {
  const v1 = FUNDACAO.versions[0];
  const passosDb = (v1?.phases ?? []).flatMap((f) =>
    f.steps.map((s, i) => ({
      phase: f.phase,
      seq: i + 1,
      key: s.key,
      statement: s.statement,
      expectedArtefact: s.expectedArtefact,
      required: s.required ?? true,
    }))
  );
  const entregasDb = (v1?.phases ?? []).flatMap((f) =>
    (f.deliverables ?? []).map((d, i) => ({
      phase: f.phase,
      seq: i + 1,
      requiresModule: null,
      required: true,
      ...d,
    }))
  );

  const setup = (assessmentExistente = false) => {
    const rec: {
      track?: Record<string, unknown>;
      assessment?: Record<string, unknown>;
      scores?: Record<string, unknown>[];
      instancias: Record<string, unknown>[];
    } = { instancias: [] };
    const db = {
      scaffoldTrack: {
        findFirst: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          rec.track = data;
          return { id: "trk" };
        },
      },
      scaffoldTemplate: {
        findUnique: async () => ({
          id: "tpl",
          archetype: null,
          versions: [{ id: "ver", steps: passosDb, deliverables: entregasDb }],
        }),
      },
      scaffoldTemplateOverlay: { upsert: async () => ({ id: "ovl" }) },
      meridianAssessment: {
        findFirst: async () => (assessmentExistente ? { id: "as-old" } : null),
        create: async ({ data }: { data: Record<string, unknown> }) => {
          rec.assessment = data;
          return { id: "as-novo" };
        },
      },
      meridianTemplate: { findFirst: async () => ({ id: "mt1" }) },
      meridianAxisScore: {
        createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
          rec.scores = data;
        },
      },
      scaffoldPhaseInstance: {
        findMany: async () =>
          ["ASSESS", "PILOT", "SCALE", "EMBED"].map((phase) => ({
            id: `ph-${phase}`,
            phase,
          })),
      },
      scaffoldBusinessCase: {
        create: async () => ({ id: "bc", versions: [{ id: "bcv" }] }),
        update: async () => ({}),
      },
      scaffoldDeliverableInstance: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          rec.instancias.push(data);
          return { id: `d-${data.code}` };
        },
      },
      scaffoldDeliverableEvent: { createMany: async () => ({}) },
      tenantModule: { findFirst: async () => null },
      scaffoldSequence: {
        findUnique: async () => ({ next: 2 }),
        upsert: async () => ({}),
      },
    };
    return { db, rec };
  };

  const ctx = { tenantId: "t1", ownerId: "u1", authorId: "u1" };
  const atlas = DEMO_TRACKS.find((t) => t.atlas)!;

  it("cria o assessment fictício com os cinco scores e confianças do briefing", async () => {
    const { db, rec } = setup();
    await seedDemoTrack(db as never, ctx, atlas);
    expect(rec.assessment).toMatchObject({
      tenantId: "t1",
      code: "AS-120",
      orgName: "Atlas (demonstração)",
      status: "FINALISED",
    });
    expect(
      Object.fromEntries(
        (rec.scores ?? []).map((s) => [s.axis, [s.computed, s.confidence]])
      )
    ).toEqual({
      DATA: [32, 0.72],
      PROCESS: [58, 0.65],
      PEOPLE: [47, 0.55],
      GOVERNANCE: [41, 0.61],
      INFRASTRUCTURE: [36, 0.8],
    });
  });

  it("a trilha nasce sem forma de trabalho, ligada ao assessment, com o overlay", async () => {
    const { db, rec } = setup();
    await seedDemoTrack(db as never, ctx, atlas);
    expect(rec.track).toMatchObject({
      archetype: null,
      sourceAssessmentId: "as-novo",
      overlayId: "ovl",
    });
  });

  it("reaproveita o assessment que já existe (idempotente)", async () => {
    const { db, rec } = setup(true);
    await seedDemoTrack(db as never, ctx, atlas);
    expect(rec.assessment).toBeUndefined();
    expect(rec.track).toMatchObject({ sourceAssessmentId: "as-old" });
  });

  it("A2.1 nasce obrigatório (Pessoas 0,55), P3.2 dispensado pelo overlay e 16 entregáveis", async () => {
    const { db, rec } = setup();
    await seedDemoTrack(db as never, ctx, atlas);
    expect(rec.instancias).toHaveLength(16);
    const por = (c: string) => rec.instancias.find((i) => i.code === c);
    expect(por("A2.1")).toMatchObject({
      required: true,
      dispensedReason: null,
    });
    expect(por("P3.2")).toMatchObject({ required: false });
    expect(por("P3.2")?.dispensedReason).toMatch(/já existem no Atlas/);
    expect(por("P1.1")?.title).toMatch(/DataHub do Atlas/);
  });
});
