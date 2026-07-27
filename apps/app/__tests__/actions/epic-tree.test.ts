import { beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  storyFindManyMock: vi.fn(),
  taskFindManyMock: vi.fn(),
  taskFindFirstMock: vi.fn(),
  taskCreateMock: vi.fn(),
  taskUpdateMock: vi.fn(),
  integrationFindManyMock: vi.fn(),
  userFindManyMock: vi.fn(),
  requireTenantSessionMock: vi.fn(async () => ({
    tenantId: "tenant-1",
    userId: "user-1",
    role: "PO",
  })),
  requireRoleMock: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    story: { findMany: h.storyFindManyMock },
    task: {
      findMany: h.taskFindManyMock,
      findFirst: h.taskFindFirstMock,
      create: h.taskCreateMock,
      update: h.taskUpdateMock,
    },
    integration: { findMany: h.integrationFindManyMock },
    user: { findMany: h.userFindManyMock },
  },
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSessionMock,
  requireRole: h.requireRoleMock,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

import { describe, expect, it } from "vitest";
import {
  listFeatureStories,
  listStoryTasks,
} from "../../app/(cosmos)/actions/epic-tree";
import {
  DEFAULT_NOTE_BLOCKS,
  PROVIDERS,
  parseTaskBlocks,
} from "../../app/(cosmos)/actions/epic-tree.constants";

describe("parseTaskBlocks", () => {
  it("accepts the four supported block kinds", () => {
    const blocks = [
      { id: "b1", kind: "heading", text: "Resultado" },
      { id: "b2", kind: "paragraph", text: "Descreva o resultado." },
      { id: "b3", kind: "code", text: "const a = 1;" },
      {
        id: "b4",
        kind: "checklist",
        items: [{ id: "i1", text: "Sub-task", done: false }],
      },
    ];
    expect(parseTaskBlocks(blocks)).toEqual(blocks);
  });

  it("returns null for an unknown block kind", () => {
    expect(parseTaskBlocks([{ id: "b1", kind: "video", url: "x" }])).toBeNull();
  });

  it("returns null for a non-array payload", () => {
    expect(parseTaskBlocks({ kind: "heading" })).toBeNull();
  });

  it("returns an empty array for an empty note", () => {
    expect(parseTaskBlocks([])).toEqual([]);
  });

  it("seeds a native note with a heading, a paragraph and a checklist", () => {
    expect(DEFAULT_NOTE_BLOCKS.map((b) => b.kind)).toEqual([
      "heading",
      "paragraph",
      "checklist",
    ]);
  });
});

describe("PROVIDERS", () => {
  it("builds an external URL from the ref for jira", () => {
    expect(PROVIDERS.jira.buildUrl("COS-142")).toBe(
      "https://cosmos.atlassian.net/browse/COS-142"
    );
  });

  it("has a letter and an accessible label for every provider", () => {
    for (const meta of Object.values(PROVIDERS)) {
      expect(meta.letter.length).toBeGreaterThan(0);
      expect(meta.label.length).toBeGreaterThan(0);
    }
  });
});

describe("listFeatureStories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes the story lookup to the tenant and the feature", async () => {
    h.storyFindManyMock.mockResolvedValue([]);

    await listFeatureStories("feature-1");

    expect(h.storyFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1", featureId: "feature-1" },
      })
    );
  });

  it("maps acceptanceCriteria through as the story's AC line", async () => {
    h.storyFindManyMock.mockResolvedValue([
      {
        id: "story-1",
        title: "Login com SSO",
        acceptanceCriteria: "Usuário autentica via SAML",
        status: "IN_PROGRESS",
        storyPoints: 5,
      },
    ]);

    const res = await listFeatureStories("feature-1");

    expect(res).toEqual({
      ok: true,
      data: [
        {
          id: "story-1",
          title: "Login com SSO",
          acceptanceCriteria: "Usuário autentica via SAML",
          status: "IN_PROGRESS",
          storyPoints: 5,
        },
      ],
    });
  });

  it("returns an empty list when the feature has no stories", async () => {
    h.storyFindManyMock.mockResolvedValue([]);

    const res = await listFeatureStories("feature-1");

    expect(res).toEqual({ ok: true, data: [] });
  });
});

describe("listStoryTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.integrationFindManyMock.mockResolvedValue([]);
    h.userFindManyMock.mockResolvedValue([]);
  });

  it("scopes the task lookup to the tenant and the story", async () => {
    h.taskFindManyMock.mockResolvedValue([]);

    await listStoryTasks("story-1");

    expect(h.taskFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1", storyId: "story-1" },
      })
    );
  });

  it("reports only ACTIVE integrations as connected sources", async () => {
    h.taskFindManyMock.mockResolvedValue([]);
    h.integrationFindManyMock.mockResolvedValue([{ source: "jira" }]);

    const res = await listStoryTasks("story-1");

    expect(res.ok && res.data.connectedSources).toEqual(["jira"]);
    expect(h.integrationFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1", status: "ACTIVE" },
      })
    );
  });

  it("exposes a native task with its parsed blocks and no external source", async () => {
    h.taskFindManyMock.mockResolvedValue([
      {
        id: "task-1",
        title: "Escrever migration",
        status: "TODO",
        estimateHours: 2,
        assigneeUserId: null,
        externalSource: null,
        externalId: null,
        externalUrl: null,
        noteBlocks: [{ id: "b1", kind: "heading", text: "Resultado" }],
      },
    ]);

    const res = await listStoryTasks("story-1");

    expect(res.ok && res.data.tasks[0]).toEqual({
      id: "task-1",
      title: "Escrever migration",
      status: "TODO",
      estimateHours: 2,
      assigneeName: null,
      externalSource: null,
      externalId: null,
      externalUrl: null,
      blocks: [{ id: "b1", kind: "heading", text: "Resultado" }],
    });
  });

  it("nulls out blocks that do not match the block schema", async () => {
    h.taskFindManyMock.mockResolvedValue([
      {
        id: "task-1",
        title: "Legado",
        status: "TODO",
        estimateHours: null,
        assigneeUserId: null,
        externalSource: null,
        externalId: null,
        externalUrl: null,
        noteBlocks: { corrupted: true },
      },
    ]);

    const res = await listStoryTasks("story-1");

    expect(res.ok && res.data.tasks[0].blocks).toBeNull();
  });

  it("resolves the assignee display name", async () => {
    h.taskFindManyMock.mockResolvedValue([
      {
        id: "task-1",
        title: "Revisar PR",
        status: "REVIEW",
        estimateHours: null,
        assigneeUserId: "user-9",
        externalSource: "jira",
        externalId: "COS-142",
        externalUrl: null,
        noteBlocks: null,
      },
    ]);
    h.userFindManyMock.mockResolvedValue([{ id: "user-9", name: "Ana Souza" }]);

    const res = await listStoryTasks("story-1");

    expect(res.ok && res.data.tasks[0].assigneeName).toBe("Ana Souza");
  });
});
