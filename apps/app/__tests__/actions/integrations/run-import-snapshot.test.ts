// run-import-snapshot.test.ts — runImportSnapshot repassa o filtro de
// project do Linear (COS-85) para o conector. Cobre os dois chamadores
// reais: connectLinearIntegration (import inicial) e resyncIntegration
// (re-sync) passam por aqui — ver cosmos-connect-linear.test.ts para o
// repasse deles até este ponto.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  integrationFindFirst: vi.fn(),
  integrationUpdate: vi.fn(),
  decryptConfigSecrets: vi.fn(),
  featureFindFirst: vi.fn(),
  featureCreate: vi.fn(),
  featureUpdate: vi.fn(),
  syncLogCreate: vi.fn(),
  linearImportTeamIssues: vi.fn(),
  linearStateToStatus: vi.fn(),
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
      findFirst: h.integrationFindFirst,
      update: h.integrationUpdate,
    },
    feature: {
      findFirst: h.featureFindFirst,
      create: h.featureCreate,
      update: h.featureUpdate,
    },
    syncLog: { create: h.syncLogCreate },
    pIPlan: { findFirst: vi.fn() },
  },
}));
vi.mock("@repo/security/encrypt", () => ({
  decryptConfigSecrets: h.decryptConfigSecrets,
  encryptConfigSecrets: vi.fn((c: unknown) => c),
}));
vi.mock("../../../app/actions/integrations/connectors/linear", () => ({
  linearImportTeamIssues: h.linearImportTeamIssues,
  linearStateToStatus: h.linearStateToStatus,
  linearDiscoverTeams: vi.fn(),
  linearTestConnection: vi.fn(),
}));
vi.mock("../../../app/actions/integrations/connectors/github", () => ({
  githubImportProjectItems: vi.fn(),
  githubStateToStatus: vi.fn(),
  githubDiscoverProjects: vi.fn(),
  githubTestConnection: vi.fn(),
}));

import { runImportSnapshot } from "../../../app/actions/integrations";

const INTEGRATION_ID = "clzzzzzzzzzzzzzzzzzzzzzz";

describe("runImportSnapshot — filtro de project do Linear (COS-85)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.headers.mockResolvedValue(new Headers());
    h.requireTenantSession.mockResolvedValue(tenantCtx);
    h.requireRole.mockReturnValue(undefined);
    h.integrationFindFirst.mockResolvedValue({
      id: INTEGRATION_ID,
      tenantId: tenantCtx.tenantId,
      source: "linear",
      config: { apiKey: "cifrado" },
    });
    h.decryptConfigSecrets.mockReturnValue({ apiKey: "lin_api_key" });
    h.linearStateToStatus.mockReturnValue("BACKLOG");
    h.featureFindFirst.mockResolvedValue(null);
    h.featureCreate.mockResolvedValue({ id: "feat-1" });
    h.syncLogCreate.mockResolvedValue({ id: "log-1" });
    h.integrationUpdate.mockResolvedValue({ id: INTEGRATION_ID });
  });

  it("repassa o linearProjectId do mapping para o fetch do conector", async () => {
    h.linearImportTeamIssues.mockResolvedValue({
      issues: [],
      nextCursor: null,
    });

    await runImportSnapshot({
      integrationId: INTEGRATION_ID,
      projectId: "lt_1",
      targetType: "feature",
      linearProjectId: "proj-x",
    });

    expect(h.linearImportTeamIssues).toHaveBeenCalledWith(
      "lin_api_key",
      "lt_1",
      undefined,
      "proj-x"
    );
  });

  it("sem linearProjectId no mapping, não passa filtro para o conector (comportamento atual intacto)", async () => {
    h.linearImportTeamIssues.mockResolvedValue({
      issues: [],
      nextCursor: null,
    });

    await runImportSnapshot({
      integrationId: INTEGRATION_ID,
      projectId: "lt_1",
      targetType: "feature",
    });

    expect(h.linearImportTeamIssues).toHaveBeenCalledWith(
      "lin_api_key",
      "lt_1",
      undefined,
      undefined
    );
  });
});
