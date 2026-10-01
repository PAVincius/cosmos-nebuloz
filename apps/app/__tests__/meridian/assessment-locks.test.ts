import { beforeEach, describe, expect, it, vi } from "vitest";

// D-29 (Norte, 30/09) — travas por estado do assessment:
//  · FINALISED recusa override, confirmação, gap (criar, editar, apagar,
//    ligar, desligar dependência), plano e novo scoring;
//  · promover gap (e revogar a promoção) continua permitido;
//  · respostas travam no fechamento da coleta (ver respondent.test.ts).
// Banco de mentira que registra TODA escrita: o que importa aqui é provar que
// nada é gravado quando a trava vale.

const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  status: { current: "FINALISED" as string },
  writes: [] as string[],
}));

vi.mock("@/lib/meridian/guards", () => ({
  requireMeridianPermissionContext: h.requirePerm,
  requireMeridianContext: h.requirePerm,
  MeridianRuleError: class extends Error {
    rule: string;
    constructor(rule: string, message: string) {
      super(message);
      this.rule = rule;
    }
  },
  StateConflictError: class extends Error {
    rule: string;
    blockers: string[];
    constructor(rule: string, message: string, blockers: string[] = []) {
      super(message);
      this.rule = rule;
      this.blockers = blockers;
    }
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const WRITE =
  /^(create|createMany|update|updateMany|upsert|delete|deleteMany)$/;
const ASSESSMENT_ID = "clx0000000000000000000as1";
const GAP_ID = "clx0000000000000000000gp1";
const GAP2_ID = "clx0000000000000000000gp2";

function fakeDb() {
  const reads: Record<string, Record<string, unknown>> = {
    meridianAssessment: {
      findFirst: () => ({
        id: ASSESSMENT_ID,
        code: "AS-1",
        orgName: "Vanta",
        status: h.status.current,
      }),
    },
    meridianGap: {
      findFirst: () => ({
        id: GAP_ID,
        code: "G-01",
        assessmentId: ASSESSMENT_ID,
        promotions: [],
        state: "OPEN",
        severity: "HIGH",
        costOfDelay: 10,
        statement: "x",
      }),
      findMany: () => [
        { id: GAP_ID, code: "G-01", assessmentId: ASSESSMENT_ID },
        { id: GAP2_ID, code: "G-02", assessmentId: ASSESSMENT_ID },
      ],
    },
    meridianAxisScore: {
      findFirst: () => ({
        id: "s1",
        computed: 50,
        final: null,
        assessment: {
          code: "AS-1",
          orgName: "Vanta",
          status: h.status.current,
        },
      }),
    },
  };
  return new Proxy(
    {},
    {
      get: (_t, model: string) =>
        new Proxy(
          {},
          {
            get:
              (_m, method: string) =>
              (..._args: unknown[]) => {
                if (WRITE.test(method)) {
                  h.writes.push(`${model}.${method}`);
                  return Promise.resolve({ id: "x", code: "X", next: 1 });
                }
                const reader = reads[model]?.[method] as
                  | (() => unknown)
                  | undefined;
                if (reader) {
                  return Promise.resolve(reader());
                }
                return Promise.resolve(method === "findMany" ? [] : null);
              },
          }
        ),
    }
  );
}

vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) => fn(fakeDb()),
  database: {},
}));

import {
  deleteGap,
  linkGapDependency,
  promoteGap,
  revokePromotion,
  unlinkGapDependency,
  upsertGap,
} from "@/app/(meridian)/actions/gaps";
import { registerOverride } from "@/app/(meridian)/actions/overrides";
import { generatePlan } from "@/app/(meridian)/actions/plan";
import { runScoring } from "@/app/(meridian)/actions/scoring";

const CTX = {
  tenantId: "t1",
  userId: "u1",
  role: "ADMIN",
  meridianRole: "CONSULTANT",
  user: { name: "Marina", email: "m@x.com" },
};

const LONG = "justificativa com mais de vinte caracteres";

const ACTIONS: [string, () => Promise<{ ok: boolean; code?: string }>][] = [
  [
    "registerOverride",
    () =>
      registerOverride({
        assessmentId: ASSESSMENT_ID,
        axis: "DATA",
        toScore: 70,
        rationale: LONG,
      }),
  ],
  [
    "upsertGap (criar)",
    () =>
      upsertGap({
        assessmentId: ASSESSMENT_ID,
        axis: "DATA",
        statement: "Sem catálogo",
        severity: "HIGH",
        effort: "M",
        costOfDelay: 50,
        confidence: "ESTIMATED",
        ownerLabel: "Dados",
      } as never),
  ],
  [
    "upsertGap (editar)",
    () =>
      upsertGap({
        id: GAP_ID,
        assessmentId: ASSESSMENT_ID,
        axis: "DATA",
        statement: "Sem catálogo",
        severity: "HIGH",
        effort: "M",
        costOfDelay: 50,
        confidence: "ESTIMATED",
        ownerLabel: "Dados",
      } as never),
  ],
  ["deleteGap", () => deleteGap({ id: GAP_ID })],
  [
    "linkGapDependency",
    () => linkGapDependency({ gapId: GAP_ID, dependsOnGapId: GAP2_ID }),
  ],
  [
    "unlinkGapDependency",
    () => unlinkGapDependency({ gapId: GAP_ID, dependsOnGapId: GAP2_ID }),
  ],
  ["generatePlan", () => generatePlan({ assessmentId: ASSESSMENT_ID })],
  ["runScoring", () => runScoring({ assessmentId: ASSESSMENT_ID })],
];

beforeEach(() => {
  vi.clearAllMocks();
  h.writes.length = 0;
  h.status.current = "FINALISED";
  h.requirePerm.mockResolvedValue(CTX);
});

describe("FINALISED trava as decisões", () => {
  it.each(
    ACTIONS
  )("%s recusa, nomeia a regra e não grava nada", async (_n, run) => {
    const res = await run();
    expect(res.ok).toBe(false);
    expect(res.code).toBe("assessment.finalised");
    expect(h.writes).toEqual([]);
  });
});

describe("promover gap continua permitido em FINALISED", () => {
  it("promoteGap não é barrado pela trava", async () => {
    const res = await promoteGap({
      gapId: GAP_ID,
      targetProduct: "COSMOS",
      targetLabel: "Iniciativa",
    });
    expect(res.code).not.toBe("assessment.finalised");
  });

  it("revokePromotion não é barrado pela trava", async () => {
    const res = await revokePromotion({ gapId: GAP_ID } as never);
    expect(res.code).not.toBe("assessment.finalised");
  });
});
