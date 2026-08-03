import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  gitHubDeploymentEventFindMany: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: h.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    gitHubDeploymentEvent: { findMany: h.gitHubDeploymentEventFindMany },
  },
}));

import { getDoraMetrics } from "../../app/(cosmos)/actions/dora";

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue({ tenantId: "t1" });
  h.gitHubDeploymentEventFindMany.mockResolvedValue([]);
});

describe("getDoraMetrics", () => {
  it("is tenant-scoped and filtered to production deployments (fails if the where were dropped)", async () => {
    await getDoraMetrics();

    expect(h.gitHubDeploymentEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "t1",
          environment: "production",
        }),
      })
    );
  });

  it("returns an honest empty result when the tenant has no production deployments — not a fabricated cadence", async () => {
    h.gitHubDeploymentEventFindMany.mockResolvedValue([]);

    const r = await getDoraMetrics();

    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.data.hasProductionDeployments).toBe(false);
    expect(r.data.deploymentFrequency).toEqual({
      status: "unavailable",
      reason: expect.any(String),
    });
    expect(r.data.leadTimeHours.status).toBe("unavailable");
  });

  it("computes a real deployment frequency and lead time from successful production deployments", async () => {
    h.gitHubDeploymentEventFindMany.mockResolvedValue([
      {
        deployedAt: new Date("2026-07-20T12:00:00.000Z"),
        firstCommitAt: new Date("2026-07-20T10:00:00.000Z"), // 2h lead time
        state: "success",
      },
      {
        deployedAt: new Date("2026-07-21T12:00:00.000Z"),
        firstCommitAt: new Date("2026-07-21T08:00:00.000Z"), // 4h lead time
        state: "success",
      },
    ]);

    const r = await getDoraMetrics();

    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.data.hasProductionDeployments).toBe(true);
    expect(r.data.totalProductionDeployments).toBe(2);
    expect(r.data.successfulProductionDeployments).toBe(2);
    expect(r.data.deploymentFrequency).toEqual({
      status: "measured",
      value: 2 / 30,
    });
    expect(r.data.leadTimeHours).toEqual({ status: "measured", value: 3 }); // avg(2h, 4h)
  });

  it("marks lead time unavailable (not a fabricated 0) when no deployment has a linked commit", async () => {
    h.gitHubDeploymentEventFindMany.mockResolvedValue([
      {
        deployedAt: new Date("2026-07-20T12:00:00.000Z"),
        firstCommitAt: null,
        state: "success",
      },
    ]);

    const r = await getDoraMetrics();

    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.data.deploymentFrequency).toEqual({
      status: "measured",
      value: 1 / 30,
    });
    expect(r.data.leadTimeHours.status).toBe("unavailable");
  });

  it("marks deployment frequency unavailable (not a fabricated 0) when production events exist but none has a recognized GitHub state", async () => {
    h.gitHubDeploymentEventFindMany.mockResolvedValue([
      {
        deployedAt: new Date("2026-07-20T12:00:00.000Z"),
        firstCommitAt: new Date("2026-07-20T10:00:00.000Z"),
        state: "pending", // not in VALID_DEPLOYMENT_STATES
      },
      {
        deployedAt: new Date("2026-07-21T12:00:00.000Z"),
        firstCommitAt: new Date("2026-07-21T08:00:00.000Z"),
        state: "queued", // not in VALID_DEPLOYMENT_STATES
      },
    ]);

    const r = await getDoraMetrics();

    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.data.deploymentFrequency).toEqual({
      status: "unavailable",
      reason: expect.any(String),
    });
    expect(r.data.totalProductionDeployments).toBe(0);
  });

  it("deriva change failure rate do estado do deployment, com o denominador visível", async () => {
    h.gitHubDeploymentEventFindMany.mockResolvedValue([
      {
        deployedAt: new Date("2026-07-20T12:00:00.000Z"),
        firstCommitAt: null,
        state: "success",
      },
      {
        deployedAt: new Date("2026-07-21T12:00:00.000Z"),
        firstCommitAt: null,
        state: "success",
      },
      {
        deployedAt: new Date("2026-07-22T12:00:00.000Z"),
        firstCommitAt: null,
        state: "failure",
      },
      {
        deployedAt: new Date("2026-07-23T12:00:00.000Z"),
        firstCommitAt: null,
        state: "error",
      },
    ]);

    const r = await getDoraMetrics();

    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    // failure + error = 2 de 4 deployments reconhecidos
    expect(r.data.changeFailureRate).toEqual({
      status: "measured",
      value: 0.5,
    });
    expect(r.data.failedProductionDeployments).toBe(2);
    // o denominador vai junto: 50% sobre 4 e 50% sobre 400 não se leem igual
    expect(r.data.totalProductionDeployments).toBe(4);
  });

  it("não coloca deployment de estado não reconhecido no denominador do change failure rate", async () => {
    h.gitHubDeploymentEventFindMany.mockResolvedValue([
      {
        deployedAt: new Date("2026-07-20T12:00:00.000Z"),
        firstCommitAt: null,
        state: "success",
      },
      {
        deployedAt: new Date("2026-07-21T12:00:00.000Z"),
        firstCommitAt: null,
        state: "failure",
      },
      {
        deployedAt: new Date("2026-07-22T12:00:00.000Z"),
        firstCommitAt: null,
        state: "pending",
      },
      {
        deployedAt: new Date("2026-07-23T12:00:00.000Z"),
        firstCommitAt: null,
        state: "in_progress",
      },
    ]);

    const r = await getDoraMetrics();

    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    // 1 de 2, não 1 de 4 — deployment em voo não é deployment concluído
    expect(r.data.changeFailureRate).toEqual({
      status: "measured",
      value: 0.5,
    });
    expect(r.data.totalProductionDeployments).toBe(2);
  });

  it("marca change failure rate indisponível quando nenhum deployment tem estado reconhecido", async () => {
    h.gitHubDeploymentEventFindMany.mockResolvedValue([
      {
        deployedAt: new Date("2026-07-20T12:00:00.000Z"),
        firstCommitAt: null,
        state: "pending",
      },
    ]);

    const r = await getDoraMetrics();

    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.data.changeFailureRate.status).toBe("unavailable");
    expect(r.data.failedProductionDeployments).toBe(0);
  });

  it("mantém change failure rate indisponível quando o tenant não tem deployment de produção", async () => {
    h.gitHubDeploymentEventFindMany.mockResolvedValue([]);

    const r = await getDoraMetrics();

    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.data.changeFailureRate.status).toBe("unavailable");
  });

  it("nunca estima MTTR — sem fonte de incidente ele fica indisponível com o motivo", async () => {
    h.gitHubDeploymentEventFindMany.mockResolvedValue([
      {
        deployedAt: new Date("2026-07-20T12:00:00.000Z"),
        firstCommitAt: new Date("2026-07-20T10:00:00.000Z"),
        state: "failure",
      },
    ]);

    const r = await getDoraMetrics();

    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    // deployment com falha existe, e ainda assim MTTR não é inferido dele:
    // "tempo até restaurar" precisa de início e fim do incidente, que não têm
    // fonte alguma no repo
    expect(r.data.mttrHours).toEqual({
      status: "unavailable",
      reason: "sem fonte de incidente",
    });
  });
});
