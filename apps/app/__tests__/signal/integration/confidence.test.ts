import { beforeEach, describe, expect, it, vi } from "vitest";

// Confiança — US2.
//
// O que estes testes protegem: o score NUNCA é gravado, só os fatores. Guardar
// o total ao lado das partes é o defeito que o protótipo tinha (86 gravado,
// fatores somando 93), e é o tipo de divergência que só aparece quando alguém
// contesta o número em reunião.

const h = vi.hoisted(() => ({
  requireSignalPermissionContext: vi.fn(),
  withTenantDb: vi.fn(),
  logSignalAudit: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@repo/database", () => ({ withTenantDb: h.withTenantDb }));
vi.mock("@/lib/signal/guards", async () => {
  const errors = await vi.importActual<typeof import("@/lib/signal/errors")>(
    "../../../lib/signal/errors"
  );
  return {
    ...errors,
    requireSignalPermissionContext: h.requireSignalPermissionContext,
  };
});
vi.mock("@/app/(signal)/actions/_shared", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/(signal)/actions/_shared")
  >("../../../app/(signal)/actions/_shared");
  return { ...actual, logSignalAudit: h.logSignalAudit };
});

import {
  getConfidence,
  setConfidenceRules,
  setConfidenceScores,
} from "@/app/(signal)/actions/confidence";

const CTX = {
  tenantId: "tnt_1",
  userId: "usr_1",
  signalRole: "ADMIN",
  user: { id: "usr_1", name: "Marina", email: "m@vanta.test" },
};

/** Catálogo do handoff: quatro fatores, pesos somando 100. */
const RULES = [
  { id: "r1", key: "baseline.signed", label: "Baseline assinado", weight: 30 },
  { id: "r2", key: "sources.fresh", label: "Fontes sincronizando", weight: 25 },
  { id: "r3", key: "formula.reviewed", label: "Fórmula revisada", weight: 20 },
  { id: "r4", key: "sample.size", label: "Amostra suficiente", weight: 25 },
];

type Db = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
let db: Db;

beforeEach(() => {
  vi.clearAllMocks();
  h.requireSignalPermissionContext.mockResolvedValue(CTX);
  h.logSignalAudit.mockResolvedValue(undefined);

  db = {
    signalInitiative: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: "ini_1", code: "IN-014", name: "Triagem" }),
    },
    signalConfidenceRule: {
      findMany: vi.fn().mockResolvedValue(RULES),
      upsert: vi.fn().mockResolvedValue({}),
    },
    signalConfidenceScore: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
    },
  };
  h.withTenantDb.mockImplementation((_t: string, fn: (d: unknown) => unknown) =>
    fn(db)
  );
});

describe("gravar avaliação", () => {
  const FULL = {
    initiativeCode: "IN-014",
    scores: [
      { key: "baseline.signed", got: 30 },
      { key: "sources.fresh", got: 18, note: "Zendesk desconectado" },
      { key: "formula.reviewed", got: 20 },
      { key: "sample.size", got: 25 },
    ],
  };

  it("grava os fatores e devolve o score DERIVADO", async () => {
    const res = await setConfidenceScores(FULL);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.score).toBe(93);
      expect(res.data.band).toBe("HIGH");
    }
  });

  it("NÃO grava o total em lugar nenhum — só os fatores", async () => {
    await setConfidenceScores(FULL);
    const written = db.signalConfidenceScore?.upsert.mock.calls.map(
      (c) => c[0].create ?? c[0].update
    );
    for (const w of written ?? []) {
      expect(w).not.toHaveProperty("score");
      expect(w).toHaveProperty("got");
    }
  });

  it("preserva a nota do desconto", async () => {
    await setConfidenceScores(FULL);
    const withNote = db.signalConfidenceScore?.upsert.mock.calls.find(
      (c) => c[0].create?.note
    );
    expect(withNote?.[0].create.note).toBe("Zendesk desconectado");
  });

  it("recusa fator acima do próprio peso ANTES de gravar qualquer linha", async () => {
    // Validar depois deixaria o banco com um score impossível se a validação
    // falhasse no meio do laço.
    const res = await setConfidenceScores({
      initiativeCode: "IN-014",
      scores: [
        { key: "baseline.signed", got: 40 },
        { key: "sources.fresh", got: 25 },
        { key: "formula.reviewed", got: 20 },
        { key: "sample.size", got: 25 },
      ],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("confidence.got.range");
    }
    expect(db.signalConfidenceScore?.upsert).not.toHaveBeenCalled();
  });

  it("recusa fator que não existe no catálogo do tenant", async () => {
    const res = await setConfidenceScores({
      initiativeCode: "IN-014",
      scores: [{ key: "inventado", got: 10 }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("confidence.rule.unknown");
    }
  });

  it("recusa avaliação parcial cujos pesos não somam 100", async () => {
    const res = await setConfidenceScores({
      initiativeCode: "IN-014",
      scores: [{ key: "baseline.signed", got: 30 }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("confidence.weights.sum");
    }
  });

  it("grava a trilha com o score resultante", async () => {
    await setConfidenceScores(FULL);
    expect(h.logSignalAudit).toHaveBeenCalledWith(
      db,
      CTX,
      expect.objectContaining({
        action: "Confiança reavaliada",
        diff: [["Score de confiança", "—", "93"]],
      })
    );
  });
});

describe("catálogo de fatores", () => {
  it("aceita pesos somando 100", async () => {
    const res = await setConfidenceRules({
      rules: RULES.map(({ key, label, weight }, order) => ({
        key,
        label,
        weight,
        order,
      })),
    });
    expect(res.ok).toBe(true);
    expect(db.signalConfidenceRule?.upsert).toHaveBeenCalledTimes(4);
  });

  it("recusa pesos que não somam 100 e diz quanto deu", async () => {
    const res = await setConfidenceRules({
      rules: [
        { key: "a", label: "A", weight: 30, order: 0 },
        { key: "b", label: "B", weight: 50, order: 1 },
      ],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("confidence.weights.sum");
      expect(res.error).toContain("80");
    }
    expect(db.signalConfidenceRule?.upsert).not.toHaveBeenCalled();
  });

  it("mexer no catálogo exige permissão de configuração do tenant", async () => {
    // Peso de fator vale para TODAS as iniciativas — é decisão de método.
    await setConfidenceRules({
      rules: [{ key: "a", label: "A", weight: 100, order: 0 }],
    });
    expect(h.requireSignalPermissionContext).toHaveBeenCalledWith(
      "signal.settings.write"
    );
  });
});

describe("leitura", () => {
  it("devolve score, faixa e o quanto cada fator perdeu", async () => {
    db.signalConfidenceScore!.findMany = vi.fn().mockResolvedValue([
      { got: 30, note: null, rule: RULES[0] },
      { got: 18, note: "Zendesk fora", rule: RULES[1] },
      { got: 20, note: null, rule: RULES[2] },
      { got: 25, note: null, rule: RULES[3] },
    ]);
    const res = await getConfidence({ initiativeCode: "IN-014" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.score).toBe(93);
      const sources = res.data.factors.find((f) => f.key === "sources.fresh");
      expect(sources?.lost).toBe(7);
      expect(sources?.note).toBe("Zendesk fora");
    }
  });

  it("iniciativa sem avaliação devolve 'sem dado', não zero-como-nota", async () => {
    const res = await getConfidence({ initiativeCode: "IN-042" });
    expect(res.ok && res.data.band).toBe("NONE");
  });

  it("exige só leitura", async () => {
    await getConfidence({ initiativeCode: "IN-014" });
    expect(h.requireSignalPermissionContext).toHaveBeenCalledWith(
      "signal.read"
    );
  });
});
