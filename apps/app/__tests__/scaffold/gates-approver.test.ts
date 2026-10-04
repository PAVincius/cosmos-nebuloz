import { beforeEach, describe, expect, it, vi } from "vitest";

// SG-03: quem decide vem da sessão, nunca do payload. No fechamento normal o
// aprovador é distinto do ator (quem opera a tela registra o aceite de quem
// decidiu), mas o id que o cliente manda só vale se for gente do tenant com
// poder de fechar gate. Qualquer outro cuid, inclusive de outro tenant, viraria
// "quem assinou" no registro append-only.

const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  membershipFindFirst: vi.fn(),
  gateResultCreate: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/inngest/emit-product-event", () => ({
  emitProductEvent: vi.fn(),
}));
vi.mock("@/lib/scaffold/guards", () => ({
  requireScaffoldPermissionContext: h.requirePerm,
  requireScaffoldContext: h.requirePerm,
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      scaffoldPhaseInstance: {
        findFirst: async () => ({
          id: "clx00000000000000000pi001",
          phase: "PILOT",
          state: "GATE_READY",
          reopenCount: 0,
          observationEndsAt: null,
          charterPolicyAckAt: null,
          trackId: "trk1",
          steps: [
            { id: "s1", required: true, state: "DONE", statement: "Rodar" },
          ],
          track: {
            id: "trk1",
            code: "TR-104",
            processName: "Triagem",
            tenantId: "t1",
            templateVersionId: "ver1",
            businessCase: null,
          },
        }),
        updateMany: async () => ({ count: 1 }),
        update: async () => ({}),
      },
      scaffoldGateCriterion: {
        findMany: async () => [
          {
            key: "k1",
            statement: "Piloto vence",
            phase: "PILOT",
            seq: 1,
            evaluationType: "MANUAL",
          },
        ],
      },
      scaffoldGateResult: {
        create: h.gateResultCreate,
        findFirst: async () => null,
      },
      scaffoldMembership: { findFirst: h.membershipFindFirst },
      scaffoldDeliverableInstance: { findMany: async () => [] },
      scaffoldTrack: { update: async () => ({}) },
      tenantModule: { findFirst: async () => null },
      processRegistry: { findFirst: async () => null },
      auditLog: { create: h.auditCreate },
    }),
}));

import { closePhase } from "@/app/(scaffold)/actions/gates";

const PI = "clx00000000000000000pi001";
const ACTOR = "clx0000000000000000actor1";
const OWNER = "clx0000000000000000owner1";
const CTX = {
  tenantId: "t1",
  userId: ACTOR,
  role: "ADMIN",
  scaffoldRole: "TRANSFORMATION_LEAD",
  user: { name: "Marina", email: "m@x.com" },
};

const close = (approverId: string) =>
  closePhase({
    phaseInstanceId: PI,
    approverId,
    criteriaFacts: { k1: { met: true } },
  });

const recorded = () => h.gateResultCreate.mock.calls[0]?.[0].data.approverId;

beforeEach(() => {
  vi.clearAllMocks();
  h.requirePerm.mockResolvedValue(CTX);
  h.gateResultCreate.mockResolvedValue({ id: "gr1" });
  h.auditCreate.mockResolvedValue({});
});

describe("closePhase — quem aparece como aprovador", () => {
  it("o dono do processo do tenant (papel com gate.close) é registrado como aprovador", async () => {
    h.membershipFindFirst.mockResolvedValue({ role: "PROCESS_OWNER" });
    expect((await close(OWNER)).ok).toBe(true);
    expect(recorded()).toBe(OWNER);
  });

  it("a consulta é do tenant da sessão", async () => {
    h.membershipFindFirst.mockResolvedValue({ role: "PROCESS_OWNER" });
    await close(OWNER);
    expect(h.membershipFindFirst.mock.calls[0]?.[0].where).toMatchObject({
      tenantId: "t1",
      userId: OWNER,
    });
  });

  it("cuid que não é membro do tenant (inclusive de outro tenant) vira o ator da sessão", async () => {
    h.membershipFindFirst.mockResolvedValue(null);
    expect((await close("clx0000000000000000outro01")).ok).toBe(true);
    expect(recorded()).toBe(ACTOR);
  });

  it("membro sem gate.close (leitor, membro do time, admin) não assina o gate de ninguém: vira o ator", async () => {
    for (const role of ["SPONSOR", "TEAM_MEMBER", "TEAM_LEAD", "ADMIN"]) {
      h.gateResultCreate.mockClear();
      h.membershipFindFirst.mockResolvedValue({ role });
      await close(OWNER);
      expect(recorded()).toBe(ACTOR);
    }
  });

  it("o próprio ator como aprovador não precisa de consulta", async () => {
    await close(ACTOR);
    expect(recorded()).toBe(ACTOR);
    expect(h.membershipFindFirst).not.toHaveBeenCalled();
  });

  it("quando o aprovador informado é trocado, a auditoria diz", async () => {
    h.membershipFindFirst.mockResolvedValue(null);
    await close("clx0000000000000000outro01");
    const entry = h.auditCreate.mock.calls
      .map((c) => c[0].data)
      .find((d) => d.action === "scaffold.gate.close");
    expect(JSON.stringify(entry)).toMatch(/aprovador informado/i);
  });
});
