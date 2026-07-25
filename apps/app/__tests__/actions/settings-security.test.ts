import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const dbMocks = vi.hoisted(() => ({
  ssoFindUnique: vi.fn(),
  policyFindUnique: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    tenantSSOConfig: { findUnique: dbMocks.ssoFindUnique },
    tenantSecurityPolicy: { findUnique: dbMocks.policyFindUnique },
  },
}));

const authMocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  headers: vi.fn(),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: authMocks.requireTenantSession,
  requireRole: authMocks.requireRole,
}));
vi.mock("next/headers", () => ({ headers: authMocks.headers }));

const matureMocks = vi.hoisted(() => ({
  saveSSOConfig: vi.fn(),
  upsertSecurityPolicy: vi.fn(),
}));
vi.mock("../../app/actions/settings/sso", () => ({
  saveSSOConfig: matureMocks.saveSSOConfig,
}));
vi.mock("../../app/actions/settings/admin-settings", () => ({
  upsertSecurityPolicy: matureMocks.upsertSecurityPolicy,
}));

import {
  getSecurityTab,
  saveSecurityPolicyAction,
  toggleSsoEnabled,
} from "../../app/(cosmos)/actions/settings-security";

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.headers.mockResolvedValue(new Headers());
  authMocks.requireTenantSession.mockResolvedValue(tenantCtx);
});

describe("getSecurityTab", () => {
  beforeEach(() => {
    authMocks.requireRole.mockReturnValue(undefined);
  });

  it("rejects non-ADMIN callers before ever reading the SSO/security rows (admin-only tab)", async () => {
    authMocks.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "Role MEMBER not permitted");
    });

    const r = await getSecurityTab();

    expect(r.ok).toBe(false);
    expect(dbMocks.ssoFindUnique).not.toHaveBeenCalled();
    expect(dbMocks.policyFindUnique).not.toHaveBeenCalled();
  });

  it("never selects idpMetadataUrl/idpEntityId/idpCertificate — status fields only", async () => {
    dbMocks.ssoFindUnique.mockResolvedValue({
      enabled: true,
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    dbMocks.policyFindUnique.mockResolvedValue(null);

    await getSecurityTab();

    const selectArg = dbMocks.ssoFindUnique.mock.calls[0][0].select;
    expect(selectArg).toEqual({ enabled: true, updatedAt: true });
    expect(selectArg.idpMetadataUrl).toBeUndefined();
    expect(selectArg.idpEntityId).toBeUndefined();
    expect(selectArg.idpCertificate).toBeUndefined();
  });

  it("scopes both reads to the caller's tenant", async () => {
    dbMocks.ssoFindUnique.mockResolvedValue(null);
    dbMocks.policyFindUnique.mockResolvedValue(null);

    await getSecurityTab();

    expect(dbMocks.ssoFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: tenantCtx.tenantId } })
    );
    expect(dbMocks.policyFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: tenantCtx.tenantId } })
    );
  });

  it("defaults ssoEnabled to false and securityPolicy to null when no rows exist", async () => {
    dbMocks.ssoFindUnique.mockResolvedValue(null);
    dbMocks.policyFindUnique.mockResolvedValue(null);

    const r = await getSecurityTab();

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.ssoEnabled).toBe(false);
      expect(r.data.securityPolicy).toBeNull();
    }
  });
});

describe("toggleSsoEnabled", () => {
  it("rejects non-ADMIN roles before ever reading the current SSO row", async () => {
    authMocks.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "Role PO not permitted");
    });

    const r = await toggleSsoEnabled(true);

    expect(r.ok).toBe(false);
    expect(dbMocks.ssoFindUnique).not.toHaveBeenCalled();
    expect(matureMocks.saveSSOConfig).not.toHaveBeenCalled();
  });

  it("round-trips the existing sensitive fields unchanged so the toggle can't wipe a configured IdP", async () => {
    authMocks.requireRole.mockReturnValue(undefined);
    dbMocks.ssoFindUnique.mockResolvedValue({
      idpMetadataUrl: "https://idp.example.com/metadata",
      idpEntityId: "urn:example:sp",
      idpCertificate: "-----BEGIN CERTIFICATE-----abc-----END CERTIFICATE-----",
      spEntityId: "urn:cosmos:sp",
    });
    matureMocks.saveSSOConfig.mockResolvedValue({
      ok: true,
      data: {
        enabled: true,
        idpMetadataUrl: null,
        idpEntityId: null,
        idpCertificate: null,
        spEntityId: null,
      },
    });

    const r = await toggleSsoEnabled(true);

    expect(matureMocks.saveSSOConfig).toHaveBeenCalledWith({
      enabled: true,
      idpMetadataUrl: "https://idp.example.com/metadata",
      idpEntityId: "urn:example:sp",
      idpCertificate: "-----BEGIN CERTIFICATE-----abc-----END CERTIFICATE-----",
      spEntityId: "urn:cosmos:sp",
    });
    expect(r.ok).toBe(true);
    // The Result the caller gets back never carries the certificate/metadata.
    if (r.ok) {
      expect(r.data).toEqual({ enabled: true });
    }
  });

  it("returns a Result error when the underlying saveSSOConfig call fails", async () => {
    authMocks.requireRole.mockReturnValue(undefined);
    dbMocks.ssoFindUnique.mockResolvedValue(null);
    matureMocks.saveSSOConfig.mockResolvedValue({ ok: false, error: "boom" });

    const r = await toggleSsoEnabled(false);

    expect(r.ok).toBe(false);
  });
});

describe("saveSecurityPolicyAction", () => {
  it("returns a Result error (not a throw) when the ADMIN gate rejects", async () => {
    matureMocks.upsertSecurityPolicy.mockRejectedValue(
      new Error("Role MEMBER not permitted. Required: ADMIN")
    );

    const r = await saveSecurityPolicyAction({ require2FA: true });

    expect(r.ok).toBe(false);
  });

  it("returns ok on a successful save", async () => {
    matureMocks.upsertSecurityPolicy.mockResolvedValue(undefined);

    const r = await saveSecurityPolicyAction({ require2FA: true });

    expect(r.ok).toBe(true);
  });
});
