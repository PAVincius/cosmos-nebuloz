import { beforeEach, describe, expect, it, vi } from "vitest";

// Vigia, item 3 BAIXO — reissuePendingLinks gira o tokenHash de N
// respondentes num loop dentro do callback de withTenantDb. Se o
// respondente do meio falhar, nenhum tokenHash já girado antes dele pode
// sobreviver: senão o consultor manda pra fora uma lista "reemitida" com
// links que na verdade não bateram no banco.
//
// packages/database/tenant-db.ts:20 já embrulha esse callback inteiro em
// `database.$transaction(async (tx) => {...})`: se o callback lança, o
// Prisma manda ROLLBACK e nenhuma escrita feita através de `tx` até ali
// persiste — mesmo que a promise de cada `update` individual já tivesse
// resolvido. Este teste não muda `reissuePendingLinks` (já é transacional
// por herdar isso de `withTenantDb`); ele simula esse contrato — estado
// "staging" que só vira "committed" se o callback inteiro resolver — pra
// provar que o loop não faz nada que quebre essa garantia (ex.: chamar
// withTenantDb mais de uma vez, ou engolir o erro no meio do lote).

const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
}));

vi.mock("@/lib/meridian/guards", () => ({
  requireMeridianPermissionContext: h.requirePerm,
  requireMeridianContext: h.requirePerm,
  MeridianRuleError: class extends Error {
    rule: string;
    status = 422;
    constructor(rule: string, message: string) {
      super(message);
      this.rule = rule;
    }
  },
  StateConflictError: class extends Error {
    rule: string;
    status = 409;
    blockers: string[];
    constructor(rule: string, message: string, blockers: string[] = []) {
      super(message);
      this.rule = rule;
      this.blockers = blockers;
    }
  },
}));
vi.mock("@/app/(meridian)/actions/scoring", () => ({
  runScoringInTx: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const AS_ID = "clx0000000000000000000as1";

type FakeRespondent = {
  id: string;
  name: string;
  axis: string;
  tokenHash: string;
};

const committed = new Map<string, FakeRespondent>([
  ["r1", { id: "r1", name: "Ana", axis: "DATA", tokenHash: "old-hash-r1" }],
  ["r2", { id: "r2", name: "Bia", axis: "PROCESS", tokenHash: "old-hash-r2" }],
  ["r3", { id: "r3", name: "Caio", axis: "PEOPLE", tokenHash: "old-hash-r3" }],
]);

/** Respondente cujo update explode no meio do lote — simula falha real
 *  (ex.: violação de constraint) a caminho do banco. */
let failOnRespondentId: string | null = null;

vi.mock("@repo/database", () => ({
  withTenantDb: async (
    _tenantId: string,
    fn: (db: unknown) => Promise<unknown>
  ) => {
    // staging: cópia isolada — só migra pra `committed` se `fn` resolver.
    const staging = new Map([...committed].map(([id, r]) => [id, { ...r }]));
    const db = {
      meridianAssessment: {
        findFirst: async () => ({
          id: AS_ID,
          deadline: new Date("2026-12-01"),
        }),
      },
      meridianRespondent: {
        findMany: async () => [...staging.values()],
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { tokenHash: string };
        }) => {
          if (where.id === failOnRespondentId) {
            throw new Error(`falha simulada no update de ${where.id}`);
          }
          const current = staging.get(where.id);
          if (!current) {
            throw new Error(`respondente ${where.id} não existe no staging`);
          }
          const updated = { ...current, ...data };
          staging.set(where.id, updated);
          return updated;
        },
      },
      auditLog: { create: async () => ({}) },
    };

    const result = await fn(db); // se lançar, staging nunca migra — "rollback"
    for (const [id, r] of staging) {
      committed.set(id, r);
    }
    return result;
  },
}));

import { reissuePendingLinks } from "@/app/(meridian)/actions/collection";

const CTX = {
  tenantId: "t1",
  userId: "u1",
  role: "ADMIN",
  meridianRole: "CONSULTANT",
  user: { name: "Marina", email: "m@x.com" },
};

beforeEach(() => {
  vi.clearAllMocks();
  h.requirePerm.mockResolvedValue(CTX);
  failOnRespondentId = null;
  committed.set("r1", {
    id: "r1",
    name: "Ana",
    axis: "DATA",
    tokenHash: "old-hash-r1",
  });
  committed.set("r2", {
    id: "r2",
    name: "Bia",
    axis: "PROCESS",
    tokenHash: "old-hash-r2",
  });
  committed.set("r3", {
    id: "r3",
    name: "Caio",
    axis: "PEOPLE",
    tokenHash: "old-hash-r3",
  });
});

describe("reissuePendingLinks — atomicidade do lote (Vigia, item 3)", () => {
  it("falha no meio do lote não gira nenhum tokenHash — rollback completo", async () => {
    failOnRespondentId = "r2"; // segundo de três

    const res = await reissuePendingLinks({ assessmentId: AS_ID });

    expect(res.ok).toBe(false);
    // r1 foi atualizado ANTES de r2 explodir — se não fosse transacional,
    // esse tokenHash teria "vazado" pro committed mesmo com o lote falho.
    expect(committed.get("r1")?.tokenHash).toBe("old-hash-r1");
    expect(committed.get("r2")?.tokenHash).toBe("old-hash-r2");
    expect(committed.get("r3")?.tokenHash).toBe("old-hash-r3");
  });

  it("sem falha, o lote inteiro é confirmado", async () => {
    const res = await reissuePendingLinks({ assessmentId: AS_ID });

    expect(res.ok).toBe(true);
    expect(committed.get("r1")?.tokenHash).not.toBe("old-hash-r1");
    expect(committed.get("r2")?.tokenHash).not.toBe("old-hash-r2");
    expect(committed.get("r3")?.tokenHash).not.toBe("old-hash-r3");
  });
});
