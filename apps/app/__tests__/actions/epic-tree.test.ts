import { beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  storyFindManyMock: vi.fn(),
  storyFindFirstMock: vi.fn(),
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
    story: { findMany: h.storyFindManyMock, findFirst: h.storyFindFirstMock },
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
  createNativeTask,
  listFeatureStories,
  listStoryTasks,
  updateNativeTask,
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

describe("createNativeTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.userFindManyMock.mockResolvedValue([]);
    h.storyFindFirstMock.mockResolvedValue({ id: "story-1" });
  });

  it("enforces the write roles", async () => {
    h.taskCreateMock.mockResolvedValue({
      id: "task-1",
      title: "Nova",
      status: "TODO",
      estimateHours: null,
      assigneeUserId: null,
      externalSource: null,
      externalId: null,
      externalUrl: null,
      noteBlocks: [],
    });

    await createNativeTask({ storyId: "story-1", title: "Nova" });

    expect(h.requireRoleMock).toHaveBeenCalledWith(
      ["ADMIN", "RTE", "SM", "PO", "DEV"],
      expect.objectContaining({ tenantId: "tenant-1" })
    );
  });

  it("creates the task tenant-scoped, native, and seeded with default blocks", async () => {
    h.taskCreateMock.mockResolvedValue({
      id: "task-1",
      title: "Nova",
      status: "TODO",
      estimateHours: null,
      assigneeUserId: null,
      externalSource: null,
      externalId: null,
      externalUrl: null,
      noteBlocks: [],
    });

    await createNativeTask({ storyId: "story-1", title: "Nova" });

    expect(h.storyFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "story-1", tenantId: "tenant-1" },
      })
    );

    const arg = h.taskCreateMock.mock.calls[0][0];
    expect(arg.data.tenantId).toBe("tenant-1");
    expect(arg.data.storyId).toBe("story-1");
    expect(arg.data.externalSource).toBeNull();
    expect(arg.data.noteBlocks).toEqual(DEFAULT_NOTE_BLOCKS);
  });

  it("rejects an empty title", async () => {
    const res = await createNativeTask({ storyId: "story-1", title: "  " });

    expect(res.ok).toBe(false);
    expect(h.taskCreateMock).not.toHaveBeenCalled();
  });

  it("refuses to create a task under a story from another tenant", async () => {
    h.storyFindFirstMock.mockResolvedValue(null);

    const res = await createNativeTask({ storyId: "story-1", title: "Nova" });

    expect(res.ok).toBe(false);
    expect(h.taskCreateMock).not.toHaveBeenCalled();
  });
});

describe("updateNativeTask", () => {
  const nativeRow = {
    id: "task-1",
    tenantId: "tenant-1",
    title: "Task",
    status: "TODO",
    estimateHours: null,
    assigneeUserId: null,
    externalSource: null,
    externalId: null,
    externalUrl: null,
    noteBlocks: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    h.userFindManyMock.mockResolvedValue([]);
    h.taskFindFirstMock.mockResolvedValue(nativeRow);
    h.taskUpdateMock.mockResolvedValue(nativeRow);
  });

  it("refuses to edit a task that came from an external tool", async () => {
    h.taskFindFirstMock.mockResolvedValue({
      ...nativeRow,
      externalSource: "jira",
      externalId: "COS-142",
    });

    const res = await updateNativeTask({ taskId: "task-1", title: "Hack" });

    expect(res.ok).toBe(false);
    expect(h.taskUpdateMock).not.toHaveBeenCalled();
  });

  it("refuses a task from another tenant", async () => {
    h.taskFindFirstMock.mockResolvedValue(null);

    const res = await updateNativeTask({ taskId: "task-1", title: "X" });

    expect(res.ok).toBe(false);
    expect(h.taskUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects a status outside the closed list", async () => {
    const res = await updateNativeTask({ taskId: "task-1", status: "SHIPPED" });

    expect(res.ok).toBe(false);
    expect(h.taskUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects blocks that do not match the schema", async () => {
    const res = await updateNativeTask({
      taskId: "task-1",
      blocks: [{ id: "b1", kind: "video" }] as never,
    });

    expect(res.ok).toBe(false);
    expect(h.taskUpdateMock).not.toHaveBeenCalled();
  });

  it("persists title, status and blocks together", async () => {
    const blocks = [{ id: "b1", kind: "heading" as const, text: "Novo" }];

    await updateNativeTask({
      taskId: "task-1",
      title: "Editado",
      status: "REVIEW",
      blocks,
    });

    expect(h.taskUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-1", tenantId: "tenant-1" },
        data: { title: "Editado", status: "REVIEW", noteBlocks: blocks },
      })
    );
  });
});
