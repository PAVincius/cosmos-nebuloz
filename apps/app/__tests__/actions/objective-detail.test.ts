import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  oKRFindFirst: vi.fn(),
  userFindFirst: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: h.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    oKR: { findFirst: h.oKRFindFirst },
    user: { findFirst: h.userFindFirst },
  },
}));

import { database } from "@repo/database";
import { getObjectiveDetail } from "../../app/(cosmos)/actions/objective-detail";

const BASE_OKR = {
  id: "okr-1",
  title: "Reduzir churn em 20%",
  description: "Foco em retenção do segmento enterprise",
  status: "ON_TRACK",
  ownerId: "user-1",
  keyResults: [
    {
      id: "kr-1",
      title: "Churn mensal",
      current: 8,
      target: 20,
      unit: "%",
      snapshots: [{ note: "Progresso consistente nas últimas 2 sprints." }],
    },
    {
      id: "kr-2",
      title: "NPS enterprise",
      current: 0,
      target: 10,
      unit: "pts",
      snapshots: [],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.oKRFindFirst.mockResolvedValue(BASE_OKR);
  h.userFindFirst.mockResolvedValue({ name: "Ana Souza" });
});

describe("getObjectiveDetail", () => {
  it("is tenant-scoped when reading the OKR", async () => {
    await getObjectiveDetail("okr-1");
    expect(database.oKR.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "okr-1", tenantId: tenantCtx.tenantId },
      })
    );
  });

  it("returns null (not an error) when the OKR does not belong to the tenant", async () => {
    h.oKRFindFirst.mockResolvedValue(null);
    const res = await getObjectiveDetail("okr-other-tenant");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toBeNull();
    }
  });

  it("computes each Key Result's progress and surfaces the latest snapshot note as the why note", async () => {
    const res = await getObjectiveDetail("okr-1");
    expect(res.ok).toBe(true);
    if (res.ok && res.data) {
      expect(res.data.ownerName).toBe("Ana Souza");
      expect(res.data.keyResults[0].progressPct).toBe(40);
      expect(res.data.keyResults[0].whyNote).toBe(
        "Progresso consistente nas últimas 2 sprints."
      );
      expect(res.data.keyResults[1].progressPct).toBe(0);
      expect(res.data.keyResults[1].whyNote).toBeNull();
    }
  });

  it("does not look up an owner when the OKR has none", async () => {
    h.oKRFindFirst.mockResolvedValue({ ...BASE_OKR, ownerId: null });
    const res = await getObjectiveDetail("okr-1");
    expect(database.user.findFirst).not.toHaveBeenCalled();
    if (res.ok && res.data) {
      expect(res.data.ownerName).toBeNull();
    }
  });
});
