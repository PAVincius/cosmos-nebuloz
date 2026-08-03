// cosmos-integrations.test.ts — actions da tela /cosmos/integrations
// (story-060). Cobre o ciclo de vida do FR-018 (pausar/retomar, que é o que
// torna alcançável o caminho de DLQ já implementado nas rotas de ingestão) e
// o teste de conexão sobre a credencial guardada, sem nenhuma entrada de
// segredo na tela.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  integrationFindMany: vi.fn(),
  integrationFindFirst: vi.fn(),
  integrationUpdate: vi.fn(),
  logAudit: vi.fn(),
  decryptConfigSecrets: vi.fn(),
  linearTestConnection: vi.fn(),
  githubTestConnection: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: h.headers }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSession,
  requireRole: h.requireRole,
  AuthError: MockAuthError,
}));
vi.mock("@repo/database", () => ({
  database: {
    integration: {
      findMany: h.integrationFindMany,
      findFirst: h.integrationFindFirst,
      update: h.integrationUpdate,
    },
  },
}));
vi.mock("@repo/security/encrypt", () => ({
  decryptConfigSecrets: h.decryptConfigSecrets,
}));
vi.mock("../../app/actions/audit/log-audit", () => ({ logAudit: h.logAudit }));
vi.mock("../../app/actions/integrations/connectors/linear", () => ({
  linearTestConnection: h.linearTestConnection,
}));
vi.mock("../../app/actions/integrations/connectors/github", () => ({
  githubTestConnection: h.githubTestConnection,
}));

import {
  listIntegrations,
  setIntegrationPaused,
  testIntegrationConnection,
} from "../../app/(cosmos)/actions/integrations";

const ID = "clxxxxxxxxxxxxxxxxxxxxxxx";

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
  h.decryptConfigSecrets.mockImplementation((c: Record<string, unknown>) => c);
  h.integrationUpdate.mockResolvedValue({ id: ID, status: "ACTIVE" });
});

describe("listIntegrations", () => {
  it("returns tenant-scoped integrations without config/mapping fields (AC-005)", async () => {
    h.integrationFindMany.mockResolvedValue([
      {
        id: "i1",
        source: "github",
        name: "GitHub Corp",
        status: "ACTIVE",
        lastSyncAt: new Date("2026-02-01"),
        syncLogs: [],
      },
    ]);

    const r = await listIntegrations();

    expect(r.ok).toBe(true);
    const args = h.integrationFindMany.mock.calls[0][0];
    expect(args.where).toEqual({ tenantId: tenantCtx.tenantId });
    expect(args.select.config).toBeUndefined();
    expect(args.select.mapping).toBeUndefined();
    if (r.ok) {
      expect(typeof r.data[0].lastSyncAt).toBe("string");
    }
  });

  it("expõe o resultado da última sincronização vindo de SyncLog (AC-004)", async () => {
    h.integrationFindMany.mockResolvedValue([
      {
        id: "i1",
        source: "linear",
        name: "Linear Squad",
        status: "ACTIVE",
        lastSyncAt: new Date("2026-02-01"),
        syncLogs: [
          {
            id: "l1",
            type: "snapshot",
            status: "partial",
            itemsCreated: 3,
            itemsUpdated: 2,
            itemsSkipped: 1,
            createdAt: new Date("2026-02-01"),
          },
        ],
      },
    ]);

    const r = await listIntegrations();

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0].lastSync).toEqual(
        expect.objectContaining({
          status: "partial",
          itemsCreated: 3,
          itemsUpdated: 2,
          itemsSkipped: 1,
        })
      );
    }
  });

  it("diz que nunca sincronizou quando não há SyncLog — sem contador zerado (AC-004)", async () => {
    h.integrationFindMany.mockResolvedValue([
      {
        id: "i1",
        source: "github",
        name: "GitHub Corp",
        status: "PAUSED",
        lastSyncAt: null,
        syncLogs: [],
      },
    ]);

    const r = await listIntegrations();

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0].lastSync).toBeNull();
    }
  });
});

describe("setIntegrationPaused", () => {
  it("fecha para papel sem permissão (AC-003)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await setIntegrationPaused({ id: ID, paused: true });

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN", "STE"], tenantCtx);
    expect(h.integrationUpdate).not.toHaveBeenCalled();
  });

  it("recusa integração de outro tenant (IDOR, AC-003)", async () => {
    h.integrationFindFirst.mockResolvedValue(null);

    const res = await setIntegrationPaused({ id: ID, paused: true });

    expect(res.ok).toBe(false);
    expect(h.integrationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ID, tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.integrationUpdate).not.toHaveBeenCalled();
  });

  it("grava PAUSED sem tocar em config, mapping ou lastSyncAt (AC-001)", async () => {
    h.integrationFindFirst.mockResolvedValue({
      id: ID,
      source: "linear",
      status: "ACTIVE",
    });
    h.integrationUpdate.mockResolvedValue({ id: ID, status: "PAUSED" });

    const res = await setIntegrationPaused({ id: ID, paused: true });

    expect(res.ok).toBe(true);
    expect(h.integrationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ID },
        data: { status: "PAUSED" },
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "status_changed",
        entityType: "integration",
        entityId: ID,
        diff: { status: "PAUSED", from: "ACTIVE" },
      })
    );
    expect(h.revalidatePath).toHaveBeenCalled();
  });

  it("retoma para ACTIVE (AC-001)", async () => {
    h.integrationFindFirst.mockResolvedValue({
      id: ID,
      source: "linear",
      status: "PAUSED",
    });
    h.integrationUpdate.mockResolvedValue({ id: ID, status: "ACTIVE" });

    const res = await setIntegrationPaused({ id: ID, paused: false });

    expect(res.ok).toBe(true);
    expect(h.integrationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ACTIVE" } })
    );
  });
});

describe("testIntegrationConnection", () => {
  it("fecha para papel sem permissão (AC-003)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await testIntegrationConnection({ id: ID });

    expect(res.ok).toBe(false);
    expect(h.linearTestConnection).not.toHaveBeenCalled();
    expect(h.integrationUpdate).not.toHaveBeenCalled();
  });

  it("recusa integração de outro tenant (IDOR, AC-003)", async () => {
    h.integrationFindFirst.mockResolvedValue(null);

    const res = await testIntegrationConnection({ id: ID });

    expect(res.ok).toBe(false);
    expect(h.linearTestConnection).not.toHaveBeenCalled();
  });

  it("usa a credencial guardada e não devolve nem audita nenhum pedaço dela (AC-002)", async () => {
    h.integrationFindFirst.mockResolvedValue({
      id: ID,
      source: "linear",
      status: "ACTIVE",
      config: { apiKey: "cifrado" },
    });
    h.decryptConfigSecrets.mockReturnValue({ apiKey: "lin_api_segredo" });
    h.linearTestConnection.mockResolvedValue({ ok: true, name: "Squad" });

    const res = await testIntegrationConnection({ id: ID });

    expect(res.ok).toBe(true);
    expect(h.linearTestConnection).toHaveBeenCalledWith("lin_api_segredo");
    expect(JSON.stringify(res)).not.toContain("lin_api_segredo");
    expect(JSON.stringify(h.logAudit.mock.calls)).not.toContain(
      "lin_api_segredo"
    );
  });

  it("recusa sem chamar o conector quando não há credencial gravada (AC-002)", async () => {
    h.integrationFindFirst.mockResolvedValue({
      id: ID,
      source: "linear",
      status: "ACTIVE",
      config: {},
    });
    h.decryptConfigSecrets.mockReturnValue({});

    const res = await testIntegrationConnection({ id: ID });

    expect(res.ok).toBe(false);
    expect(h.linearTestConnection).not.toHaveBeenCalled();
    expect(h.integrationUpdate).not.toHaveBeenCalled();
  });

  it("marca ERROR quando o conector recusa a credencial (AC-002)", async () => {
    h.integrationFindFirst.mockResolvedValue({
      id: ID,
      source: "github",
      status: "ACTIVE",
      config: { token: "cifrado" },
    });
    h.decryptConfigSecrets.mockReturnValue({ token: "ghp_segredo" });
    h.githubTestConnection.mockResolvedValue({ ok: false, error: "401" });

    const res = await testIntegrationConnection({ id: ID });

    expect(res.ok).toBe(false);
    expect(h.integrationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ERROR" } })
    );
  });

  it("não despausa uma integração pausada, mesmo com o teste passando (AC-002)", async () => {
    h.integrationFindFirst.mockResolvedValue({
      id: ID,
      source: "linear",
      status: "PAUSED",
      config: { apiKey: "cifrado" },
    });
    h.decryptConfigSecrets.mockReturnValue({ apiKey: "lin_api_segredo" });
    h.linearTestConnection.mockResolvedValue({ ok: true, name: "Squad" });

    const res = await testIntegrationConnection({ id: ID });

    expect(res.ok).toBe(true);
    // testar não é retomar: quem pausou conteve um estrago, e um teste que
    // despausasse sozinho reabriria a ingestão sem decisão humana
    expect(h.integrationUpdate).not.toHaveBeenCalled();
  });

  it("recusa fonte sem conector de teste, sem gravar status (AC-002)", async () => {
    h.integrationFindFirst.mockResolvedValue({
      id: ID,
      source: "billing_aws",
      status: "ACTIVE",
      config: { token: "cifrado" },
    });
    h.decryptConfigSecrets.mockReturnValue({ token: "aws" });

    const res = await testIntegrationConnection({ id: ID });

    expect(res.ok).toBe(false);
    expect(h.integrationUpdate).not.toHaveBeenCalled();
  });
});
