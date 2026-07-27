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
import { listFeatureStories } from "../../app/(cosmos)/actions/epic-tree";
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
