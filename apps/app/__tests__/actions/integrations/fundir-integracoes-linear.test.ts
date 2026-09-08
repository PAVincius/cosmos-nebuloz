// fundir-integracoes-linear.test.ts — o modelo antigo criava uma Integration
// por project. Fundir tem que preservar o que aponta para as absorvidas:
// SyncLog tem FK com cascade, mas LinearSyncEvent e WebhookDlq guardam
// integrationId como coluna solta — apagar sem re-apontar deixaria histórico
// órfão em silêncio, não erro.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  logAudit: vi.fn(),
  integrationFindMany: vi.fn(),
  integrationUpdate: vi.fn(),
  integrationDelete: vi.fn(),
  syncLogUpdateMany: vi.fn(),
  linearSyncEventUpdateMany: vi.fn(),
  webhookDlqUpdateMany: vi.fn(),
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
      update: h.integrationUpdate,
      delete: h.integrationDelete,
      findFirst: vi.fn(),
    },
    syncLog: { updateMany: h.syncLogUpdateMany },
    linearSyncEvent: { updateMany: h.linearSyncEventUpdateMany },
    webhookDlq: { updateMany: h.webhookDlqUpdateMany },
  },
}));
vi.mock("@repo/security/encrypt", () => ({
  decryptConfigSecrets: vi.fn((c: unknown) => c),
  encryptConfigSecrets: vi.fn((c: unknown) => c),
}));
vi.mock("../../../app/actions/audit/log-audit", () => ({
  logAudit: h.logAudit,
}));
vi.mock("../../../app/actions/integrations", () => ({
  createIntegration: vi.fn(),
  runImportSnapshot: vi.fn(),
}));
vi.mock("../../../app/actions/integrations/connectors/github", () => ({
  githubTestConnection: vi.fn(),
}));
vi.mock("../../../app/actions/integrations/connectors/linear", () => ({
  linearTestConnection: vi.fn(),
  linearDiscoverTeams: vi.fn(),
  linearImportTeamIssues: vi.fn(),
}));
vi.mock("../../../app/(cosmos)/actions/kanban", () => ({
  createEpic: vi.fn(),
}));

import { fundirIntegracoesLinear } from "../../../app/(cosmos)/actions/integrations";

describe("fundirIntegracoesLinear", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.headers.mockResolvedValue(new Headers());
    h.requireTenantSession.mockResolvedValue(tenantCtx);
    h.requireRole.mockReturnValue(undefined);
    h.integrationUpdate.mockResolvedValue({ id: "i1" });
    h.integrationDelete.mockResolvedValue({ id: "i2" });
    h.syncLogUpdateMany.mockResolvedValue({ count: 3 });
    h.linearSyncEventUpdateMany.mockResolvedValue({ count: 7 });
    h.webhookDlqUpdateMany.mockResolvedValue({ count: 0 });
    h.logAudit.mockResolvedValue(undefined);
  });

  it("junta os escopos das integrações numa só e apaga as absorvidas", async () => {
    h.integrationFindMany.mockResolvedValue([
      // A mais antiga sobrevive: é a que a rota do webhook já escolhia com
      // findFirst, então eventos em voo continuam achando o mesmo id.
      { id: "i1", name: "Linear · Cosmos", mapping: { projectId: "lt_cos" } },
      {
        id: "i2",
        name: "Linear · Meridian",
        mapping: { projectId: "lt_neb", linearProjectId: "prj_mer" },
      },
      {
        id: "i3",
        name: "Linear · Charter",
        mapping: { projectId: "lt_neb", linearProjectId: "prj_cha" },
      },
    ]);

    const r = await fundirIntegracoesLinear();

    expect(r.ok).toBe(true);
    expect(r.ok && r.data).toEqual({ id: "i1", absorvidas: 2, scopes: 3 });

    expect(h.integrationUpdate).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: {
        name: "Linear",
        mapping: {
          scopes: [
            { linearTeamId: "lt_cos" },
            { linearTeamId: "lt_neb", linearProjectId: "prj_mer" },
            { linearTeamId: "lt_neb", linearProjectId: "prj_cha" },
          ],
        },
      },
    });
    expect(h.integrationDelete).toHaveBeenCalledTimes(2);
  });

  it("re-aponta SyncLog, LinearSyncEvent e WebhookDlq antes de apagar", async () => {
    h.integrationFindMany.mockResolvedValue([
      { id: "i1", name: "A", mapping: { projectId: "lt_1" } },
      { id: "i2", name: "B", mapping: { projectId: "lt_2" } },
    ]);

    await fundirIntegracoesLinear();

    for (const mock of [
      h.syncLogUpdateMany,
      h.linearSyncEventUpdateMany,
      h.webhookDlqUpdateMany,
    ]) {
      expect(mock).toHaveBeenCalledWith(
        expect.objectContaining({ data: { integrationId: "i1" } })
      );
    }
    // Histórico movido antes do delete: na ordem inversa o cascade do
    // SyncLog levaria as linhas junto.
    const ordemUpdate = h.syncLogUpdateMany.mock.invocationCallOrder[0];
    const ordemDelete = h.integrationDelete.mock.invocationCallOrder[0];
    expect(ordemUpdate).toBeLessThan(ordemDelete);
  });

  it("não duplica escopo igual vindo de integrações diferentes", async () => {
    // Reconectar o mesmo project dobraria cada import se o escopo entrasse
    // duas vezes.
    h.integrationFindMany.mockResolvedValue([
      {
        id: "i1",
        name: "A",
        mapping: { projectId: "lt_neb", linearProjectId: "prj_mer" },
      },
      {
        id: "i2",
        name: "B",
        mapping: { projectId: "lt_neb", linearProjectId: "prj_mer" },
      },
    ]);

    const r = await fundirIntegracoesLinear();

    expect(r.ok && r.data.scopes).toBe(1);
  });

  it("recusa quando o tenant não tem integração do Linear", async () => {
    h.integrationFindMany.mockResolvedValue([]);

    const r = await fundirIntegracoesLinear();

    expect(r.ok).toBe(false);
    expect(h.integrationDelete).not.toHaveBeenCalled();
  });

  it("exige papel de administração", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "forbidden");
    });

    const r = await fundirIntegracoesLinear();

    expect(r.ok).toBe(false);
    expect(h.integrationFindMany).not.toHaveBeenCalled();
  });
});
