// velocity.test.ts — story-032 AC-001/AC-003 (FR-011). Predictability em SAFe
// é aceito/comprometido, não entregue/capacidade: o ponto que o PO aceitou na
// review sobre a capacidade comprometida no planejamento. Estes testes fixam
// isso e o "N/A" com denominador zero.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  sprintFindMany: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: { sprint: { findMany: h.sprintFindMany } },
}));

import {
  listRecentSprints,
  listTeamPredictability,
} from "../../app/(cosmos)/actions/velocity";

beforeEach(() => {
  vi.clearAllMocks();
  h.requireTenantSession.mockResolvedValue(tenantCtx);
});

describe("listRecentSprints", () => {
  it("deriva predictability de aceito/comprometido, não de entregue/capacidade (AC-001)", async () => {
    h.sprintFindMany.mockResolvedValue([
      {
        id: "s1",
        name: "Sprint 12",
        capacity: 40,
        velocity: 38,
        review: { completedPoints: 38, acceptedPoints: 32 },
      },
    ]);

    const r = await listRecentSprints();
    expect(r.ok).toBe(true);
    expect(h.sprintFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId, status: "CLOSED" },
      })
    );
    if (r.ok) {
      expect(r.data[0].completedPoints).toBe(38);
      expect(r.data[0].acceptedPoints).toBe(32);
      // 32 aceitos / 40 comprometidos = 80%, e não 38/40 = 95%
      expect(r.data[0].predictabilityPct).toBe(80);
    }
  });

  it("mostra predictability nula quando o comprometido é zero — sem divisão por zero (AC-001)", async () => {
    h.sprintFindMany.mockResolvedValue([
      {
        id: "s1",
        name: "Sprint 0",
        capacity: 0,
        velocity: 10,
        review: { completedPoints: 10, acceptedPoints: 10 },
      },
    ]);

    const r = await listRecentSprints();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0].predictabilityPct).toBeNull();
    }
  });

  it("não infere ponto aceito a partir de velocity quando não há review", async () => {
    h.sprintFindMany.mockResolvedValue([
      {
        id: "s1",
        name: "Sprint 11",
        capacity: 40,
        velocity: 36,
        review: null,
      },
    ]);

    const r = await listRecentSprints();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0].acceptedPoints).toBeNull();
      expect(r.data[0].completedPoints).toBeNull();
      expect(r.data[0].predictabilityPct).toBeNull();
      // velocity continua sendo lida — é outra métrica, não um proxy de aceito
      expect(r.data[0].velocity).toBe(36);
    }
  });
});

describe("listTeamPredictability", () => {
  it("só conta sprint fechada que tem ponto aceito registrado na review", async () => {
    h.sprintFindMany.mockResolvedValue([]);

    const r = await listTeamPredictability();
    expect(r.ok).toBe(true);
    expect(h.sprintFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: tenantCtx.tenantId,
          status: "CLOSED",
          capacity: { not: null },
          review: { acceptedPoints: { not: null } },
        },
      })
    );
  });

  it("faz a média de aceito/comprometido por time, melhor primeiro", async () => {
    h.sprintFindMany.mockResolvedValue([
      {
        teamId: "team-1",
        capacity: 40,
        team: { name: "Squad Atlas" },
        review: { acceptedPoints: 40 },
      },
      {
        teamId: "team-1",
        capacity: 40,
        team: { name: "Squad Atlas" },
        review: { acceptedPoints: 20 },
      },
      {
        teamId: "team-2",
        capacity: 30,
        team: { name: "Squad Orion" },
        review: { acceptedPoints: 30 },
      },
    ]);

    const r = await listTeamPredictability();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toHaveLength(2);
      const atlas = r.data.find((t) => t.teamId === "team-1");
      // (100% + 50%) / 2 = 75%
      expect(atlas?.predictabilityPct).toBe(75);
      expect(atlas?.sprintCount).toBe(2);
      expect(r.data[0].teamId).toBe("team-2");
    }
  });
});
