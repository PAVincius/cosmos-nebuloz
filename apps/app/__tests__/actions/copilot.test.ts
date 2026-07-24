import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: h.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSession,
  AuthError: MockAuthError,
}));

import { getCopilotBootstrap } from "../../app/(cosmos)/actions/copilot";

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
});

describe("getCopilotBootstrap", () => {
  it("is scoped by the authenticated tenant session — must fail if that check were dropped", async () => {
    h.requireTenantSession.mockResolvedValue(tenantCtx);

    const res = await getCopilotBootstrap();

    expect(h.requireTenantSession).toHaveBeenCalledTimes(1);
    expect(res.ok).toBe(true);
  });

  it("returns an error instead of leaking data when there is no valid session", async () => {
    h.requireTenantSession.mockImplementation(() => {
      throw new MockAuthError("UNAUTHORIZED", "no session");
    });

    const res = await getCopilotBootstrap();

    expect(res.ok).toBe(false);
  });

  it("maps the tenant member's role to the matching SAFe role and its suggested chips", async () => {
    h.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "RTE" });

    const res = await getCopilotBootstrap();

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.role).toBe("RTE");
      expect(res.data.chips.length).toBeGreaterThan(0);
      expect(res.data.chips[0]).toHaveProperty("label");
      expect(res.data.chips[0]).toHaveProperty("prompt");
    }
  });

  it("falls back to DEV for a role with no direct SAFe mapping", async () => {
    h.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      role: "SOME_UNMAPPED_ROLE",
    });

    const res = await getCopilotBootstrap();

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.role).toBe("DEV");
    }
  });
});
