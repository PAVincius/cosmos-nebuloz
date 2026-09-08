import { beforeEach, describe, expect, it, vi } from "vitest";

// Override append-only — FR-017/FR-018.
//
// As três regras que este arquivo trava: rationale curto é recusado, override
// sem mudança de score é recusado, e o computado nunca é reescrito. As duas
// primeiras impedem decisão sem justificativa; a terceira é o que faz a trilha
// responder "por que o número mudou?".

const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  scoreFindFirst: vi.fn(),
  scoreUpdate: vi.fn(),
  overrideCreate: vi.fn(),
  overrideFindMany: vi.fn(),
  auditCreate: vi.fn(),
  sequenceUpsert: vi.fn(),
}));

// Mock total do módulo de guards: ele importa "server-only", que estoura fora
// de um request Next. As classes de erro são redefinidas aqui porque a action
// as instancia — importActual traria o "server-only" junto.
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
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      meridianAxisScore: {
        findFirst: h.scoreFindFirst,
        update: h.scoreUpdate,
      },
      meridianOverride: {
        create: h.overrideCreate,
        findMany: h.overrideFindMany,
      },
      meridianSequence: { upsert: h.sequenceUpsert },
      auditLog: { create: h.auditCreate },
    }),
}));

import {
  listOverrides,
  registerOverride,
} from "@/app/(meridian)/actions/overrides";

const CTX = {
  tenantId: "t1",
  userId: "u1",
  role: "ADMIN",
  meridianRole: "CONSULTANT",
  user: { name: "Marina Duarte", email: "marina@x.com" },
};

const SCORE = {
  id: "sc1",
  computed: 74,
  final: null,
  status: "CONTESTED",
  assessment: { code: "AS-104", orgName: "Vanta Saúde" },
};

const VALID_RATIONALE =
  "Política existe mas nunca passou por ciclo real de enforcement.";

beforeEach(() => {
  vi.clearAllMocks();
  h.requirePerm.mockResolvedValue(CTX);
  h.scoreFindFirst.mockResolvedValue(SCORE);
  h.sequenceUpsert.mockResolvedValue({ next: 12 });
  h.overrideCreate.mockResolvedValue({ id: "ov1", code: "OV-11" });
  h.scoreUpdate.mockResolvedValue({});
  h.auditCreate.mockResolvedValue({});
});

describe("registerOverride", () => {
  it("registra override válido e devolve o código legível", async () => {
    const res = await registerOverride({
      assessmentId: "clx0000000000000000000as1",
      axis: "GOVERNANCE",
      toScore: 66,
      rationale: VALID_RATIONALE,
    });
    expect(res.ok).toBe(true);
    expect(res.ok && res.data.code).toBe("OV-11");
  });

  it("recusa rationale abaixo do mínimo de 20 caracteres", async () => {
    const res = await registerOverride({
      assessmentId: "clx0000000000000000000as1",
      axis: "GOVERNANCE",
      toScore: 66,
      rationale: "curto",
    });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/20 caracteres/);
    expect(h.overrideCreate).not.toHaveBeenCalled();
  });

  it("recusa override que não muda o score — não é decisão", async () => {
    const res = await registerOverride({
      assessmentId: "clx0000000000000000000as1",
      axis: "GOVERNANCE",
      toScore: 74,
      rationale: VALID_RATIONALE,
    });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/sem mudança/i);
    expect(h.overrideCreate).not.toHaveBeenCalled();
  });

  it("nunca reescreve o computado — só grava final e status", async () => {
    await registerOverride({
      assessmentId: "clx0000000000000000000as1",
      axis: "GOVERNANCE",
      toScore: 66,
      rationale: VALID_RATIONALE,
    });
    const update = h.scoreUpdate.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(update.data).toEqual({ final: 66, status: "OVERRIDDEN" });
    expect(update.data).not.toHaveProperty("computed");
  });

  it("parte do final vigente quando já existe override — encadeia decisões", async () => {
    h.scoreFindFirst.mockResolvedValue({ ...SCORE, final: 66 });
    await registerOverride({
      assessmentId: "clx0000000000000000000as1",
      axis: "GOVERNANCE",
      toScore: 71,
      rationale: VALID_RATIONALE,
    });
    const created = h.overrideCreate.mock.calls[0]?.[0] as {
      data: { fromScore: number; toScore: number };
    };
    expect(created.data.fromScore).toBe(66);
    expect(created.data.toScore).toBe(71);
  });

  it("só cria — nunca atualiza linha de override existente", async () => {
    await registerOverride({
      assessmentId: "clx0000000000000000000as1",
      axis: "GOVERNANCE",
      toScore: 66,
      rationale: VALID_RATIONALE,
    });
    expect(h.overrideCreate).toHaveBeenCalledTimes(1);
    // O stub não expõe update/delete de override: se a implementação tentasse
    // usá-los, quebraria aqui em vez de apagar histórico em produção.
  });

  it("grava a trilha na mesma transação da escrita", async () => {
    await registerOverride({
      assessmentId: "clx0000000000000000000as1",
      axis: "GOVERNANCE",
      toScore: 66,
      rationale: VALID_RATIONALE,
    });
    expect(h.auditCreate).toHaveBeenCalledTimes(1);
    const audit = h.auditCreate.mock.calls[0]?.[0] as {
      data: { entityType: string; tenantId: string; metadata: unknown };
    };
    expect(audit.data.entityType).toBe("meridian.override");
    expect(audit.data.tenantId).toBe("t1");
  });

  it("recusa quando o eixo ainda não tem score computado", async () => {
    h.scoreFindFirst.mockResolvedValue(null);
    const res = await registerOverride({
      assessmentId: "clx0000000000000000000as1",
      axis: "DATA",
      toScore: 50,
      rationale: VALID_RATIONALE,
    });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/coleta/i);
  });

  it("propaga a negação de permissão em vez de gravar", async () => {
    h.requirePerm.mockRejectedValue(new Error("Requer papel Consultor"));
    const res = await registerOverride({
      assessmentId: "clx0000000000000000000as1",
      axis: "DATA",
      toScore: 50,
      rationale: VALID_RATIONALE,
    });
    expect(res.ok).toBe(false);
    expect(h.overrideCreate).not.toHaveBeenCalled();
  });
});

describe("listOverrides", () => {
  it("devolve em ordem cronológica crescente — a trilha se lê de cima para baixo", async () => {
    h.overrideFindMany.mockResolvedValue([]);
    await listOverrides({ assessmentId: "clx0000000000000000000as1" });
    const args = h.overrideFindMany.mock.calls[0]?.[0] as {
      orderBy: { createdAt: string };
      where: { tenantId: string };
    };
    expect(args.orderBy).toEqual({ createdAt: "asc" });
    expect(args.where.tenantId).toBe("t1");
  });
});
