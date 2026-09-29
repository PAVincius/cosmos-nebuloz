import { beforeEach, describe, expect, it, vi } from "vitest";

// "Nova trilha" lê os gaps ranqueados do Meridian (X-03). O gap é do Meridian:
// o Scaffold só lê, com a permissão de conduzir trilha, e nunca por MeridianRole.

const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  listRankedGaps: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/scaffold/guards", () => ({
  requireScaffoldPermissionContext: h.requirePerm,
}));
vi.mock("@/lib/meridian/ranked-gaps", () => ({
  listRankedGaps: h.listRankedGaps,
}));

import { listScaffoldGaps } from "@/app/(scaffold)/actions/gaps";

const CTX = {
  tenantId: "t1",
  userId: "u1",
  scaffoldRole: "CONSULTANT",
  user: { name: "Marina", email: "m@x.com" },
};

const GAP = {
  rank: 1,
  id: "g1",
  code: "G-01",
  statement: "Triagem de autorizações volta por dado faltante.",
  axis: "PROCESS",
  severity: "HIGH",
  effort: "S",
  costOfDelay: 80,
  confidence: "MEASURED",
  state: "OPEN",
  assessmentId: "a1",
  assessmentCode: "AS-1",
  promotion: { id: "p1", product: "SCAFFOLD", landed: false },
};

beforeEach(() => {
  vi.clearAllMocks();
  h.requirePerm.mockResolvedValue(CTX);
  h.listRankedGaps.mockResolvedValue([GAP]);
});

describe("listScaffoldGaps", () => {
  it("exige track.manage e entrega o contexto ao Meridian, sem tenant de parâmetro", async () => {
    const r = await listScaffoldGaps();
    expect(h.requirePerm).toHaveBeenCalledWith("track.manage");
    expect(h.listRankedGaps).toHaveBeenCalledWith(CTX);
    expect(r).toEqual({ ok: true, data: [GAP] });
  });

  it("sem a permissão, recusa antes de tocar no Meridian", async () => {
    h.requirePerm.mockRejectedValue(
      Object.assign(new Error("Requer papel Consultor — criar trilhas"), {
        code: "FORBIDDEN",
      })
    );
    const r = await listScaffoldGaps();
    expect(r.ok).toBe(false);
    expect(h.listRankedGaps).not.toHaveBeenCalled();
  });

  it("falha do Meridian (módulo não contratado) vira erro tipado, não exceção", async () => {
    h.listRankedGaps.mockRejectedValue(
      Object.assign(new Error("Módulo MERIDIAN não contratado."), {
        code: "FORBIDDEN",
      })
    );
    const r = await listScaffoldGaps();
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/MERIDIAN/);
    }
  });

  it("lista vazia é resposta válida", async () => {
    h.listRankedGaps.mockResolvedValue([]);
    expect(await listScaffoldGaps()).toEqual({ ok: true, data: [] });
  });
});
