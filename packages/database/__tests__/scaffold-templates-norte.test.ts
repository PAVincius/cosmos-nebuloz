import { describe, expect, it, vi } from "vitest";
import { TEMPLATES, type VersionSeed } from "../scripts/scaffold-templates";

// Catálogo do Scaffold conforme as decisões do Norte (2026-09-29, seções b e
// c): 5 formas de trabalho, 16 entregáveis por trilha, códigos A1…E3 estáveis.
// Testa o DADO, sem banco: o que se prova é o contrato do catálogo.

const NEW: Record<string, string> = {
  conversational: "v1",
  analysis: "v1",
  docreview: "v3",
  triage: "v5",
  reporting: "v4",
};

const versionOf = (key: string): VersionSeed => {
  const t = TEMPLATES.find((x) => x.key === key);
  const v = t?.versions.find((x) => x.label === NEW[key]);
  if (!v) {
    throw new Error(`versão nova de ${key} ausente`);
  }
  return v;
};

const deliverables = (v: VersionSeed) =>
  v.phases.flatMap((p) =>
    (p.deliverables ?? []).map((d) => ({ ...d, phase: p.phase }))
  );

const COMMON = [
  "A1.1",
  "A2.1",
  "A3.1",
  "A3.2",
  "B1.1",
  "B1.2",
  "B2.1",
  "B3.1",
  "C1.1",
  "C2.1",
  "C3.1",
  "D1.1",
  "E1.1",
  "E2.1",
  "E3.1",
];

describe("as 5 formas do trabalho", () => {
  it("cobre as cinco formas, uma por template", () => {
    const forms = Object.keys(NEW).map(
      (k) => TEMPLATES.find((t) => t.key === k)?.archetype
    );
    expect(forms.sort()).toEqual(
      ["ANALYSIS", "CONVERSATIONAL", "DOC_REVIEW", "REPORTING", "TRIAGE"].sort()
    );
  });

  it("não mexe nas versões existentes", () => {
    const labels = (k: string) =>
      TEMPLATES.find((t) => t.key === k)?.versions.map((v) => v.label);
    expect(labels("triage")).toEqual(["v3", "v4", "v5"]);
    expect(labels("docreview")).toEqual(["v1", "v2", "v3"]);
    expect(labels("reporting")).toEqual(["v2", "v3", "v4"]);
    const v4 = TEMPLATES.find((t) => t.key === "triage")?.versions[1];
    expect(v4?.phases[0]?.deliverables).toBeUndefined();
  });

  it("nomes dos templates existentes ficam como estão", () => {
    expect(TEMPLATES.find((t) => t.key === "triage")?.name).toBe(
      "Triagem de suporte"
    );
  });
});

describe.each(Object.keys(NEW))("%s — 16 entregáveis", (key) => {
  const v = versionOf(key);
  const all = deliverables(v);

  it("tem 16, todos obrigatórios, com código único no formato A1.1", () => {
    expect(all).toHaveLength(16);
    expect(new Set(all.map((d) => d.code)).size).toBe(16);
    for (const d of all) {
      expect(d.code).toMatch(/^[A-E]\d\.\d$/);
      expect(d.required ?? true).toBe(true);
      expect(d.title.length).toBeGreaterThan(3);
      expect(d.description.length).toBeGreaterThan(10);
    }
  });

  it("os 15 do esqueleto têm o mesmo código em toda trilha, mais 1 específico", () => {
    const codes = all.map((d) => d.code);
    for (const c of COMMON) {
      expect(codes).toContain(c);
    }
    expect(codes.filter((c) => !COMMON.includes(c))).toHaveLength(1);
  });

  it("por fase: ASSESS 4, PILOT 5, SCALE 3, EMBED 4", () => {
    const n = (p: string) => all.filter((d) => d.phase === p).length;
    expect([n("ASSESS"), n("PILOT"), n("SCALE"), n("EMBED")]).toEqual([
      4, 5, 3, 4,
    ]);
  });

  it("a letra do código bate com a fase (A ASSESS, B PILOT, C SCALE, D e E EMBED)", () => {
    const phaseOf: Record<string, string> = {
      A: "ASSESS",
      B: "PILOT",
      C: "SCALE",
      D: "EMBED",
      E: "EMBED",
    };
    for (const d of all) {
      expect(d.phase).toBe(phaseOf[d.code[0] as string]);
    }
  });

  it("todo entregável pertence a um passo da mesma fase, com código de passo", () => {
    for (const p of v.phases) {
      const stepKeys = new Set(p.steps.map((s) => s.key));
      for (const d of p.deliverables ?? []) {
        expect(d.stepCode).toBe(d.code.split(".")[0]);
        expect(stepKeys.has(d.stepCode)).toBe(true);
      }
    }
  });

  it("A3.2 é a assinatura do caso de negócio; C1.1 só vale com o Charter", () => {
    const by = (c: string) => all.find((d) => d.code === c);
    expect(by("A3.2")).toMatchObject({ kind: "SIGNATURE", producer: "OWNER" });
    expect(by("C1.1")).toMatchObject({
      kind: "SIGNATURE",
      producer: "LEGAL",
      requiresModule: "CHARTER",
    });
    for (const d of all) {
      if (d.code !== "C1.1") {
        expect(d.requiresModule).toBeUndefined();
      }
    }
  });

  it("passos A1…E3 estáveis, sem repetir", () => {
    const keys = v.phases.flatMap((p) => p.steps.map((s) => s.key));
    expect(keys).toEqual([
      "A1",
      "A2",
      "A3",
      "B1",
      "B2",
      "B3",
      "C1",
      "C2",
      "C3",
      "D1",
      "E1",
      "E2",
      "E3",
    ]);
  });

  it("critérios comuns (c.2), sem o genérico no-new-risk", () => {
    const keys = v.phases.flatMap((p) => p.criteria.map((c) => c.key));
    for (const k of [
      "baseline-measured",
      "baseline-signed",
      "beats-baseline",
      "guard-held",
      "rollback-tested-prod",
      "charter-policy-acked",
      "charter-controls-clear",
      "volume-migrated",
      "old-path-retired",
      "handover-delivered",
      "observation-window",
    ]) {
      expect(keys).toContain(k);
    }
    expect(keys).not.toContain("no-new-risk");
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("critérios derivados são os que o sistema sabe", () => {
    const derived = v.phases
      .flatMap((p) => p.criteria)
      .filter((c) => c.evaluationType === "DERIVED")
      .map((c) => c.key)
      .sort();
    expect(derived).toEqual(
      [
        "baseline-measured",
        "baseline-signed",
        "charter-controls-clear",
        "charter-policy-acked",
        "handover-delivered",
        "observation-window",
      ].sort()
    );
  });
});

describe("conteúdo específico por forma (c.3)", () => {
  const specific = (key: string) =>
    deliverables(versionOf(key)).filter((d) => !COMMON.includes(d.code));
  const crit = (key: string) =>
    versionOf(key).phases.flatMap((p) => p.criteria.map((c) => c.key));

  it("conversacional: B1.3 temas proibidos e RIPD, jurídico", () => {
    expect(specific("conversational")[0]).toMatchObject({
      code: "B1.3",
      producer: "LEGAL",
    });
    expect(crit("conversational")).toEqual(
      expect.arrayContaining(["contrafactual-held", "incorrect-rate"])
    );
  });
  it("análise: B1.3 explicabilidade (LGPD art. 20)", () => {
    expect(specific("analysis")[0]?.code).toBe("B1.3");
    expect(specific("analysis")[0]?.title).toMatch(/explicabilidade/i);
    expect(crit("analysis")).toEqual(
      expect.arrayContaining(["top-k-precision", "segment-parity"])
    );
  });
  it("revisão de documentos: B3.2 concordância em amostragem dupla", () => {
    expect(specific("docreview")[0]).toMatchObject({
      code: "B3.2",
      kind: "SPREADSHEET",
    });
    expect(crit("docreview")).toEqual(
      expect.arrayContaining(["sampling-agreement", "critical-fields"])
    );
  });
  it("triagem: B1.3 casos que sempre vão para humano", () => {
    expect(specific("triage")[0]).toMatchObject({
      code: "B1.3",
      producer: "OWNER",
    });
    expect(crit("triage")).toEqual(
      expect.arrayContaining(["holdout-held", "no-urgent-downgrade"])
    );
  });
  it("relatórios: B1.3 checklist e reconciliação na SCALE", () => {
    expect(specific("reporting")[0]?.code).toBe("B1.3");
    expect(crit("reporting")).toEqual(
      expect.arrayContaining(["parallel-cycles", "reconciliation-clean"])
    );
  });
});

// ── O seed: só insere, e roda quantas vezes precisar ─────────────────────────

vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: class {} }));
vi.mock("pg", () => ({ Pool: class {} }));
vi.mock("../generated/client", () => ({
  PrismaClient: class {
    $disconnect() {}
  },
}));

describe("upsertTemplate — só insere", () => {
  const fakeDb = (existing: Set<string>) => {
    const calls = {
      versionCreate: vi.fn().mockResolvedValue({ id: "ver-new" }),
      versionUpdate: vi.fn(),
      templateUpdate: undefined as unknown,
      deliverableCreateMany: vi.fn(),
      stepCreateMany: vi.fn(),
      criterionCreateMany: vi.fn(),
      templateUpsert: vi.fn().mockResolvedValue({ id: "tpl1" }),
    };
    const db = {
      scaffoldTemplate: { upsert: calls.templateUpsert },
      scaffoldTemplateVersion: {
        findUnique: async ({
          where,
        }: {
          where: { templateId_label: { label: string } };
        }) => (existing.has(where.templateId_label.label) ? { id: "x" } : null),
        create: calls.versionCreate,
        update: calls.versionUpdate,
      },
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

  it("cria a versão nova com os 16 entregáveis, na fase certa e em ordem", async () => {
    const { upsertTemplate } = await import("../scripts/seed-scaffold.mts");
    const seed = TEMPLATES.find((t) => t.key === "triage")!;
    const { db, calls } = fakeDb(new Set(["v3", "v4"]));
    const r = await upsertTemplate(db as never, seed);

    expect(r).toEqual({ created: 1, skipped: 2 });
    const rows = calls.deliverableCreateMany.mock.calls.flatMap(
      (c) => c[0].data
    );
    expect(rows).toHaveLength(16);
    expect(rows[0]).toMatchObject({
      versionId: "ver-new",
      phase: "ASSESS",
      code: "A1.1",
      seq: 1,
    });
    expect(rows.find((r: { code: string }) => r.code === "C1.1")).toMatchObject(
      { requiresModule: "CHARTER", required: true }
    );
  });

  it("segunda rodada não cria nem altera nada", async () => {
    const { upsertTemplate } = await import("../scripts/seed-scaffold.mts");
    for (const seed of TEMPLATES) {
      const all = new Set(seed.versions.map((v) => v.label));
      const { db, calls } = fakeDb(all);
      const r = await upsertTemplate(db as never, seed);
      expect(r.created).toBe(0);
      expect(calls.versionCreate).not.toHaveBeenCalled();
      expect(calls.versionUpdate).not.toHaveBeenCalled();
      expect(calls.deliverableCreateMany).not.toHaveBeenCalled();
    }
  });

  it("não reescreve template existente: upsert com update vazio", async () => {
    const { upsertTemplate } = await import("../scripts/seed-scaffold.mts");
    const seed = TEMPLATES.find((t) => t.key === "triage")!;
    const { db, calls } = fakeDb(new Set(["v3", "v4", "v5"]));
    await upsertTemplate(db as never, seed);
    expect(calls.templateUpsert.mock.calls[0]?.[0].update).toEqual({});
  });
});
