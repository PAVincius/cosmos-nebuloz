// cosmos-connect-linear.test.ts — fluxo de conexão do Linear na tela
// /cosmos/integrations.
//
// O modal de "Conectar" era um stub declarado: nenhuma credencial era
// coletada e `createIntegration` — que já existia e já cifrava — não tinha
// chamador. Estes testes fixam as três garantias que a lacuna deixava em
// aberto: a chave nunca volta numa resposta, o time do Linear escolhido é o
// que vai para `mapping`, e re-sincronizar lê esse mapping do servidor em vez
// de confiar em id vindo da tela.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  integrationFindFirst: vi.fn(),
  logAudit: vi.fn(),
  decryptConfigSecrets: vi.fn(),
  linearTestConnection: vi.fn(),
  linearDiscoverTeams: vi.fn(),
  githubTestConnection: vi.fn(),
  createIntegration: vi.fn(),
  runImportSnapshot: vi.fn(),
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
      findMany: vi.fn(),
      findFirst: h.integrationFindFirst,
      update: vi.fn(),
    },
  },
}));
vi.mock("@repo/security/encrypt", () => ({
  decryptConfigSecrets: h.decryptConfigSecrets,
}));
vi.mock("../../app/actions/audit/log-audit", () => ({ logAudit: h.logAudit }));
vi.mock("../../app/actions/integrations/connectors/linear", () => ({
  linearTestConnection: h.linearTestConnection,
  linearDiscoverTeams: h.linearDiscoverTeams,
}));
vi.mock("../../app/actions/integrations/connectors/github", () => ({
  githubTestConnection: h.githubTestConnection,
}));
vi.mock("../../app/actions/integrations", () => ({
  createIntegration: h.createIntegration,
  runImportSnapshot: h.runImportSnapshot,
}));

import {
  connectLinearIntegration,
  discoverLinearTeams,
  resyncIntegration,
} from "../../app/(cosmos)/actions/integrations";

const ID = "clxxxxxxxxxxxxxxxxxxxxxxx";
const API_KEY = "lin_api_00000000000000000000";

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
  h.decryptConfigSecrets.mockImplementation((c: Record<string, unknown>) => c);
});

describe("discoverLinearTeams", () => {
  it("valida a credencial antes de listar e devolve a conta do Linear", async () => {
    h.linearTestConnection.mockResolvedValue({ ok: true, name: "Nebuloz" });
    h.linearDiscoverTeams.mockResolvedValue([
      { id: "lt_1", name: "Meridian", key: "MER" },
    ]);

    const r = await discoverLinearTeams({ apiKey: API_KEY });

    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.data.account).toBe("Nebuloz");
    expect(r.data.teams).toEqual([
      { id: "lt_1", name: "Meridian", key: "MER" },
    ]);
    expect(h.linearTestConnection).toHaveBeenCalledWith(API_KEY);
  });

  it("apara espaço e quebra de linha da chave colada antes de mandar ao Linear", async () => {
    h.linearTestConnection.mockResolvedValue({ ok: true, name: "Nebuloz" });
    h.linearDiscoverTeams.mockResolvedValue([]);

    await discoverLinearTeams({ apiKey: `  ${API_KEY}\n` });

    // Sem o trim, o header iria com o lixo junto e o Linear devolveria 401 —
    // indistinguível de chave revogada para quem está na tela.
    expect(h.linearTestConnection).toHaveBeenCalledWith(API_KEY);
  });

  it("não chama o discover quando a credencial é recusada", async () => {
    h.linearTestConnection.mockResolvedValue({
      ok: false,
      error: "Authentication required",
    });

    const r = await discoverLinearTeams({ apiKey: API_KEY });

    expect(r.ok).toBe(false);
    expect(h.linearDiscoverTeams).not.toHaveBeenCalled();
  });

  it("exige papel de administração", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "forbidden");
    });

    const r = await discoverLinearTeams({ apiKey: API_KEY });

    expect(r.ok).toBe(false);
    expect(h.linearTestConnection).not.toHaveBeenCalled();
  });
});

describe("connectLinearIntegration", () => {
  beforeEach(() => {
    h.linearTestConnection.mockResolvedValue({ ok: true, name: "Nebuloz" });
    h.createIntegration.mockResolvedValue({ ok: true, data: { id: ID } });
    h.runImportSnapshot.mockResolvedValue({
      ok: true,
      data: { created: 12, updated: 0, skipped: 1 },
    });
  });

  it("delega a escrita cifrada a createIntegration e nunca devolve a chave", async () => {
    const r = await connectLinearIntegration({
      name: "Linear Nebuloz",
      apiKey: API_KEY,
      linearTeamId: "lt_1",
    });

    expect(r.ok).toBe(true);
    expect(h.createIntegration).toHaveBeenCalledWith({
      source: "linear",
      name: "Linear Nebuloz",
      config: { apiKey: API_KEY },
    });
    expect(JSON.stringify(r)).not.toContain(API_KEY);
  });

  it("registra auditoria sem a credencial no diff", async () => {
    await connectLinearIntegration({
      name: "Linear Nebuloz",
      apiKey: API_KEY,
      linearTeamId: "lt_1",
    });

    expect(h.logAudit).toHaveBeenCalled();
    expect(JSON.stringify(h.logAudit.mock.calls)).not.toContain(API_KEY);
  });

  it("importa as issues do time escolhido quando importNow é pedido", async () => {
    const r = await connectLinearIntegration({
      name: "Linear Nebuloz",
      apiKey: API_KEY,
      linearTeamId: "lt_1",
      importNow: true,
    });

    expect(h.runImportSnapshot).toHaveBeenCalledWith({
      integrationId: ID,
      projectId: "lt_1",
      targetType: "feature",
    });
    expect(r.ok && r.data.imported).toEqual({
      created: 12,
      updated: 0,
      skipped: 1,
    });
  });

  it("não importa nada quando importNow é falso", async () => {
    const r = await connectLinearIntegration({
      name: "Linear Nebuloz",
      apiKey: API_KEY,
      linearTeamId: "lt_1",
    });

    expect(h.runImportSnapshot).not.toHaveBeenCalled();
    expect(r.ok && r.data.imported).toBeNull();
  });

  it("repassa o épico de destino para o import", async () => {
    const r = await connectLinearIntegration({
      name: "Linear Nebuloz",
      apiKey: API_KEY,
      linearTeamId: "lt_1",
      importNow: true,
      epicId: "clyyyyyyyyyyyyyyyyyyyyyyy",
    });

    expect(r.ok).toBe(true);
    expect(h.runImportSnapshot).toHaveBeenCalledWith({
      integrationId: ID,
      projectId: "lt_1",
      targetType: "feature",
      epicId: "clyyyyyyyyyyyyyyyyyyyyyyy",
    });
  });

  it("recusa credencial inválida antes de criar a integração", async () => {
    h.linearTestConnection.mockResolvedValue({ ok: false, error: "401" });

    const r = await connectLinearIntegration({
      name: "Linear Nebuloz",
      apiKey: API_KEY,
      linearTeamId: "lt_1",
    });

    expect(r.ok).toBe(false);
    expect(h.createIntegration).not.toHaveBeenCalled();
  });
});

describe("resyncIntegration", () => {
  it("lê o time mapeado no servidor — a tela só manda o id da integração", async () => {
    h.integrationFindFirst.mockResolvedValue({
      id: ID,
      source: "linear",
      status: "ACTIVE",
      mapping: { projectId: "lt_1", targetType: "feature" },
    });
    h.runImportSnapshot.mockResolvedValue({
      ok: true,
      data: { created: 3, updated: 4, skipped: 0 },
    });

    const r = await resyncIntegration({ id: ID });

    expect(h.runImportSnapshot).toHaveBeenCalledWith({
      integrationId: ID,
      projectId: "lt_1",
      targetType: "feature",
    });
    expect(r.ok && r.data).toEqual({ created: 3, updated: 4, skipped: 0 });
  });

  it("carrega o épico do mapping no re-sync — senão o sync seguinte apagaria a adoção", async () => {
    h.integrationFindFirst.mockResolvedValue({
      id: ID,
      source: "linear",
      status: "ACTIVE",
      mapping: {
        projectId: "lt_1",
        targetType: "feature",
        epicId: "clyyyyyyyyyyyyyyyyyyyyyyy",
      },
    });
    h.runImportSnapshot.mockResolvedValue({
      ok: true,
      data: { created: 0, updated: 89, skipped: 0 },
    });

    await resyncIntegration({ id: ID });

    expect(h.runImportSnapshot).toHaveBeenCalledWith({
      integrationId: ID,
      projectId: "lt_1",
      targetType: "feature",
      epicId: "clyyyyyyyyyyyyyyyyyyyyyyy",
    });
  });

  it("recusa integração pausada — retomar é decisão humana, não efeito de sync", async () => {
    h.integrationFindFirst.mockResolvedValue({
      id: ID,
      source: "linear",
      status: "PAUSED",
      mapping: { projectId: "lt_1" },
    });

    const r = await resyncIntegration({ id: ID });

    expect(r.ok).toBe(false);
    expect(h.runImportSnapshot).not.toHaveBeenCalled();
  });

  it("recusa integração sem mapeamento gravado", async () => {
    h.integrationFindFirst.mockResolvedValue({
      id: ID,
      source: "linear",
      status: "ACTIVE",
      mapping: null,
    });

    const r = await resyncIntegration({ id: ID });

    expect(r.ok).toBe(false);
    expect(h.runImportSnapshot).not.toHaveBeenCalled();
  });

  it("recusa integração de outro tenant", async () => {
    h.integrationFindFirst.mockResolvedValue(null);

    const r = await resyncIntegration({ id: ID });

    expect(r.ok).toBe(false);
    expect(h.runImportSnapshot).not.toHaveBeenCalled();
  });
});
