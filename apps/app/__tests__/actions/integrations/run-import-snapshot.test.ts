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
  featureDelete: vi.fn(),
  storyFindFirst: vi.fn(),
  storyCreate: vi.fn(),
  storyUpdate: vi.fn(),
  piPlanAssignmentCount: vi.fn(),
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
      delete: h.featureDelete,
    },
    story: {
      findFirst: h.storyFindFirst,
      create: h.storyCreate,
      update: h.storyUpdate,
    },
    pIPlanFeatureAssignment: { count: h.piPlanAssignmentCount },
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
    h.storyFindFirst.mockResolvedValue(null);
    h.storyCreate.mockResolvedValue({ id: "story-1" });
    h.piPlanAssignmentCount.mockResolvedValue(0);
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

describe("runImportSnapshot — hierarquia SAFe do import (Feature vs Story)", () => {
  const issue = (
    id: string,
    title: string,
    parent?: { id: string; title: string }
  ) => ({
    id,
    title,
    description: null,
    url: `https://linear.app/${id}`,
    state: { name: "Backlog", type: "backlog" },
    priority: 0,
    estimate: 3,
    assignee: null,
    team: { id: "lt_1", name: "Nebuloz" },
    project: null,
    labels: { nodes: [] },
    parent: parent ?? null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  });

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
    h.featureCreate.mockResolvedValue({ id: "feat-parent" });
    h.storyFindFirst.mockResolvedValue(null);
    h.storyCreate.mockResolvedValue({ id: "story-1" });
    h.piPlanAssignmentCount.mockResolvedValue(0);
    h.syncLogCreate.mockResolvedValue({ id: "log-1" });
    h.integrationUpdate.mockResolvedValue({ id: INTEGRATION_ID });
  });

  it("issue com sub-issue vira Feature; a sub-issue vira Story dentro dela", async () => {
    h.linearImportTeamIssues.mockResolvedValue({
      issues: [
        issue("iss-parent", "Autenticação"),
        issue("iss-filha", "Tela de login", {
          id: "iss-parent",
          title: "Autenticação",
        }),
      ],
      nextCursor: null,
    });

    await runImportSnapshot({
      integrationId: INTEGRATION_ID,
      projectId: "lt_1",
      targetType: "feature",
    });

    // Só o parent virou Feature.
    expect(h.featureCreate).toHaveBeenCalledTimes(1);
    expect(h.featureCreate.mock.calls[0][0].data.externalId).toBe("iss-parent");

    // A filha virou Story linkada na Feature criada para o parent.
    expect(h.storyCreate).toHaveBeenCalledTimes(1);
    const story = h.storyCreate.mock.calls[0][0].data;
    expect(story.externalId).toBe("iss-filha");
    expect(story.featureId).toBe("feat-parent");
  });

  it("issue sem hierarquia vira Story sem feature — nunca Feature", async () => {
    h.linearImportTeamIssues.mockResolvedValue({
      issues: [issue("iss-solta", "Ajustar cor do botão")],
      nextCursor: null,
    });

    await runImportSnapshot({
      integrationId: INTEGRATION_ID,
      projectId: "lt_1",
      targetType: "feature",
    });

    expect(h.featureCreate).not.toHaveBeenCalled();
    expect(h.storyCreate).toHaveBeenCalledTimes(1);
    expect(h.storyCreate.mock.calls[0][0].data.featureId).toBeNull();
  });

  it("parent fora do lote (filtrado pelo project) não some: vira Story sem feature", async () => {
    // A sub-issue veio, o parent dela não — filtro de project, issue
    // cancelada, ou o parent vive em outro time.
    h.linearImportTeamIssues.mockResolvedValue({
      issues: [
        issue("iss-orfa", "Sub de um parent ausente", {
          id: "iss-fora-do-lote",
          title: "Parent que o filtro não trouxe",
        }),
      ],
      nextCursor: null,
    });

    await runImportSnapshot({
      integrationId: INTEGRATION_ID,
      projectId: "lt_1",
      targetType: "feature",
    });

    expect(h.featureCreate).not.toHaveBeenCalled();
    expect(h.storyCreate).toHaveBeenCalledTimes(1);
    expect(h.storyCreate.mock.calls[0][0].data.featureId).toBeNull();
  });

  it("Feature do import antigo vira Story quando ninguém depende dela", async () => {
    h.linearImportTeamIssues.mockResolvedValue({
      issues: [issue("iss-legado", "Task que virou Feature por engano")],
      nextCursor: null,
    });
    // O import anterior deixou esta issue folha como Feature, sem vínculo.
    h.featureFindFirst.mockResolvedValue({
      id: "feat-legado",
      _count: {
        stories: 0,
        blocks: 0,
        blockedBy: 0,
        supplierDeliverables: 0,
      },
    });

    const r = await runImportSnapshot({
      integrationId: INTEGRATION_ID,
      projectId: "lt_1",
      targetType: "feature",
    });

    expect(h.featureDelete).toHaveBeenCalledWith({
      where: { id: "feat-legado" },
    });
    expect(h.storyCreate).toHaveBeenCalledTimes(1);
    expect(h.storyCreate.mock.calls[0][0].data.externalId).toBe("iss-legado");
    expect(r.ok && r.data.reclassified).toBe(1);
  });

  it("Feature com trabalho humano em cima não é apagada — entra em skipped", async () => {
    h.linearImportTeamIssues.mockResolvedValue({
      issues: [issue("iss-usada", "Feature que ganhou stories no Cosmos")],
      nextCursor: null,
    });
    h.featureFindFirst.mockResolvedValue({
      id: "feat-usada",
      _count: {
        // Alguém decompôs esta Feature em stories no Cosmos: apagá-la para
        // arrumar o nível levaria junto o trabalho de decomposição.
        stories: 3,
        blocks: 0,
        blockedBy: 0,
        supplierDeliverables: 0,
      },
    });

    const r = await runImportSnapshot({
      integrationId: INTEGRATION_ID,
      projectId: "lt_1",
      targetType: "feature",
    });

    expect(h.featureDelete).not.toHaveBeenCalled();
    expect(h.storyCreate).not.toHaveBeenCalled();
    expect(r.ok && r.data.reclassified).toBe(0);
    expect(r.ok && r.data.skipped).toBe(1);
  });

  it("Feature alocada num PI Plan também é preservada", async () => {
    h.linearImportTeamIssues.mockResolvedValue({
      issues: [issue("iss-alocada", "Feature no board de PI")],
      nextCursor: null,
    });
    h.featureFindFirst.mockResolvedValue({
      id: "feat-alocada",
      _count: {
        stories: 0,
        blocks: 0,
        blockedBy: 0,
        supplierDeliverables: 0,
      },
    });
    // Sem story filha, mas alocada num sprint do PI Planning.
    h.piPlanAssignmentCount.mockResolvedValue(1);

    const r = await runImportSnapshot({
      integrationId: INTEGRATION_ID,
      projectId: "lt_1",
      targetType: "feature",
    });

    expect(h.featureDelete).not.toHaveBeenCalled();
    expect(r.ok && r.data.skipped).toBe(1);
  });
});
