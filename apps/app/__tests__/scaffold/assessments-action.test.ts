import { beforeEach, describe, expect, it, vi } from "vitest";

// A "Nova trilha" lista os assessments do Meridian do próprio tenant. O Scaffold
// só lê (o diagnóstico é do Meridian, mapa de fronteiras): a leitura pede
// `track.manage`, vai pelo tenant da sessão e só devolve o que tem pontuação nos
// cinco eixos.

const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/scaffold/guards", () => ({
  requireScaffoldPermissionContext: h.requirePerm,
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({ meridianAssessment: { findMany: h.findMany } }),
}));

import { listScaffoldAssessments } from "@/app/(scaffold)/actions/assessments";

const eixos = (n: number) =>
  ["DATA", "PROCESS", "PEOPLE", "GOVERNANCE", "INFRASTRUCTURE"]
    .slice(0, n)
    .map((axis) => ({ axis }));

const linha = (id: string, code: string, scores: number) => ({
  id,
  code,
  orgName: "Atlas",
  status: "FINALISED",
  openedAt: new Date("2026-09-01"),
  closedAt: new Date("2026-09-10"),
  scores: eixos(scores),
});

beforeEach(() => {
  vi.clearAllMocks();
  h.requirePerm.mockResolvedValue({ tenantId: "t1", userId: "u1" });
});

describe("listScaffoldAssessments", () => {
  it("pede track.manage e lê pelo tenant da sessão", async () => {
    h.findMany.mockResolvedValue([]);
    await listScaffoldAssessments();
    expect(h.requirePerm).toHaveBeenCalledWith("track.manage");
    expect(h.findMany.mock.calls[0]?.[0].where).toEqual({ tenantId: "t1" });
  });

  it("só devolve assessment com os cinco eixos pontuados, e a data é a de fechamento", async () => {
    h.findMany.mockResolvedValue([
      linha("a1", "AS-120", 5),
      linha("a2", "AS-121", 3),
      { ...linha("a3", "AS-122", 5), closedAt: null },
    ]);
    const res = await listScaffoldAssessments();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.map((a) => a.code)).toEqual(["AS-120", "AS-122"]);
      expect(res.data[0]?.date).toEqual(new Date("2026-09-10"));
      // Sem fechamento, vale a abertura.
      expect(res.data[1]?.date).toEqual(new Date("2026-09-01"));
    }
  });

  it("não devolve os scores nem o resto da linha, só o que o seletor mostra", async () => {
    h.findMany.mockResolvedValue([linha("a1", "AS-120", 5)]);
    const res = await listScaffoldAssessments();
    if (res.ok) {
      expect(Object.keys(res.data[0] ?? {}).sort()).toEqual([
        "code",
        "date",
        "id",
        "orgName",
        "status",
      ]);
    }
  });

  it("sem permissão, recusa e não consulta o banco", async () => {
    h.requirePerm.mockRejectedValue(new Error("FORBIDDEN"));
    const res = await listScaffoldAssessments();
    expect(res.ok).toBe(false);
    expect(h.findMany).not.toHaveBeenCalled();
  });
});
