import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  discoverJiraProjects,
  fetchJiraItems,
  testJiraConnection,
} from "../../lib/migration/jira-client";
import {
  discoverTrelloBoards,
  fetchTrelloCards,
  testTrelloConnection,
} from "../../lib/migration/trello-client";

const jiraConfig = {
  baseUrl: "https://acme.atlassian.net",
  email: "dev@x.com",
  apiToken: "tok",
};

const trelloConfig = {
  apiKey: "key123",
  apiToken: "tok123",
};

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? "OK" : "Unauthorized",
    json: vi.fn().mockResolvedValue(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Jira ─────────────────────────────────────────────────────────────────────

describe("testJiraConnection", () => {
  it("resolves on 200", async () => {
    vi.stubGlobal("fetch", mockFetch({ accountId: "u1" }));
    await expect(testJiraConnection(jiraConfig)).resolves.toBeUndefined();
  });

  it("throws on HTTP error", async () => {
    vi.stubGlobal("fetch", mockFetch(null, false, 401));
    await expect(testJiraConnection(jiraConfig)).rejects.toThrow(/401/);
  });
});

describe("discoverJiraProjects", () => {
  const projects = [
    { key: "COSMOS", name: "Cosmos" },
    { key: "OTHER", name: "Other" },
  ];

  it("returns all projects when no filter", async () => {
    vi.stubGlobal("fetch", mockFetch(projects));
    const result = await discoverJiraProjects(jiraConfig);
    expect(result).toHaveLength(2);
  });

  it("filters by projectKeys when provided", async () => {
    vi.stubGlobal("fetch", mockFetch(projects));
    const result = await discoverJiraProjects({
      ...jiraConfig,
      projectKeys: ["COSMOS"],
    });
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("COSMOS");
  });

  it("throws on HTTP error", async () => {
    vi.stubGlobal("fetch", mockFetch(null, false, 403));
    await expect(discoverJiraProjects(jiraConfig)).rejects.toThrow(
      /fetch Jira projects/i
    );
  });
});

describe("fetchJiraItems", () => {
  const issues = {
    issues: [
      {
        id: "10001",
        fields: {
          summary: "Build login",
          description: "desc",
          issuetype: { name: "Story" },
          status: { name: "Done" },
          story_points: 5,
          parent: { fields: { summary: "Epic A" } },
        },
      },
      {
        id: "10002",
        fields: {
          summary: "Epic A",
          description: null,
          issuetype: { name: "Epic" },
          status: { name: "In Progress" },
          story_points: null,
          customfield_10016: 13,
          parent: null,
        },
      },
    ],
  };

  it("maps issues to MigrationItem shape", async () => {
    vi.stubGlobal("fetch", mockFetch(issues));
    const result = await fetchJiraItems(jiraConfig, "COSMOS");
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      type: "story",
      title: "Build login",
      storyPoints: 5,
      parentTitle: "Epic A",
      externalId: "10001",
    });
    expect(result[1]).toMatchObject({ type: "epic", storyPoints: 13 });
  });

  it("throws on HTTP error", async () => {
    vi.stubGlobal("fetch", mockFetch(null, false, 500));
    await expect(fetchJiraItems(jiraConfig, "COSMOS")).rejects.toThrow(
      /fetch Jira issues/i
    );
  });
});

// ─── Trello ───────────────────────────────────────────────────────────────────

describe("testTrelloConnection", () => {
  it("resolves on 200", async () => {
    vi.stubGlobal("fetch", mockFetch({ id: "me" }));
    await expect(testTrelloConnection(trelloConfig)).resolves.toBeUndefined();
  });

  it("throws on HTTP error", async () => {
    vi.stubGlobal("fetch", mockFetch(null, false, 401));
    await expect(testTrelloConnection(trelloConfig)).rejects.toThrow(
      /Trello connection failed/i
    );
  });
});

describe("discoverTrelloBoards", () => {
  const boards = [
    { id: "b1", name: "Board 1" },
    { id: "b2", name: "Board 2" },
  ];

  it("returns all boards when no filter", async () => {
    vi.stubGlobal("fetch", mockFetch(boards));
    const result = await discoverTrelloBoards(trelloConfig);
    expect(result).toHaveLength(2);
  });

  it("filters by boardIds when provided", async () => {
    vi.stubGlobal("fetch", mockFetch(boards));
    const result = await discoverTrelloBoards({
      ...trelloConfig,
      boardIds: ["b1"],
    });
    expect(result).toHaveLength(1);
  });

  it("throws on HTTP error", async () => {
    vi.stubGlobal("fetch", mockFetch(null, false, 403));
    await expect(discoverTrelloBoards(trelloConfig)).rejects.toThrow(
      /fetch Trello boards/i
    );
  });
});

describe("fetchTrelloCards", () => {
  const cards = [
    { id: "c1", name: "Fix bug", desc: "details", labels: [] },
    { id: "c2", name: "Add feature", desc: "", labels: [{ name: "urgent" }] },
  ];

  it("maps cards to MigrationItem shape", async () => {
    vi.stubGlobal("fetch", mockFetch(cards));
    const result = await fetchTrelloCards(trelloConfig, "b1");
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      type: "story",
      title: "Fix bug",
      description: "details",
      externalId: "c1",
    });
    expect(result[1].description).toBeUndefined();
  });

  it("throws on HTTP error", async () => {
    vi.stubGlobal("fetch", mockFetch(null, false, 404));
    await expect(fetchTrelloCards(trelloConfig, "b1")).rejects.toThrow(
      /fetch Trello cards/i
    );
  });
});
