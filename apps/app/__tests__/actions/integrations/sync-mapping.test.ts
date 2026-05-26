// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/database", () => ({
  database: {
    linearSync: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    gitHubSync: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { database } from "@repo/database";
import {
  findGitHubMapping,
  findLinearMapping,
  upsertGitHubMapping,
  upsertLinearMapping,
} from "@/app/actions/integrations/sync/sync-mapping";

const mockDb = database as unknown as {
  linearSync: { upsert: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
  gitHubSync: { upsert: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Linear ───────────────────────────────────────────────────────────────────

describe("upsertLinearMapping", () => {
  it("calls database.linearSync.upsert with correct where + create + update args", async () => {
    mockDb.linearSync.upsert.mockResolvedValue({ id: "ls-1" });

    await upsertLinearMapping({
      tenantId: "t",
      linearId: "lin-1",
      linearType: "Issue",
      cosmosId: "epic-1",
      cosmosType: "Epic",
    });

    expect(mockDb.linearSync.upsert).toHaveBeenCalledOnce();
    const [call] = mockDb.linearSync.upsert.mock.calls;
    expect(call[0].where).toEqual({
      tenantId_linearId_linearType: {
        tenantId: "t",
        linearId: "lin-1",
        linearType: "Issue",
      },
    });
    expect(call[0].create).toMatchObject({ linearId: "lin-1", cosmosId: "epic-1" });
    expect(call[0].update).toMatchObject({ cosmosId: "epic-1" });
  });
});

describe("findLinearMapping", () => {
  it("calls database.linearSync.findUnique with correct where", async () => {
    mockDb.linearSync.findUnique.mockResolvedValue(null);

    await findLinearMapping({ tenantId: "t", linearId: "lin-1", linearType: "Issue" });

    expect(mockDb.linearSync.findUnique).toHaveBeenCalledOnce();
    expect(mockDb.linearSync.findUnique.mock.calls[0][0]).toEqual({
      where: {
        tenantId_linearId_linearType: {
          tenantId: "t",
          linearId: "lin-1",
          linearType: "Issue",
        },
      },
    });
  });
});

// ─── GitHub ───────────────────────────────────────────────────────────────────

describe("upsertGitHubMapping", () => {
  it("calls database.gitHubSync.upsert with correct args", async () => {
    mockDb.gitHubSync.upsert.mockResolvedValue({ id: "gh-1" });

    await upsertGitHubMapping({
      tenantId: "t",
      githubRepo: "org/repo",
      githubNumber: 42,
      githubType: "issue",
      cosmosId: "epic-1",
      cosmosType: "Epic",
    });

    expect(mockDb.gitHubSync.upsert).toHaveBeenCalledOnce();
    const [call] = mockDb.gitHubSync.upsert.mock.calls;
    expect(call[0].where).toEqual({
      tenantId_githubRepo_githubNumber_githubType: {
        tenantId: "t",
        githubRepo: "org/repo",
        githubNumber: 42,
        githubType: "issue",
      },
    });
    expect(call[0].create).toMatchObject({ githubNumber: 42, cosmosId: "epic-1" });
    expect(call[0].update).toMatchObject({ cosmosId: "epic-1" });
  });
});

describe("findGitHubMapping", () => {
  it("calls database.gitHubSync.findUnique with correct where", async () => {
    mockDb.gitHubSync.findUnique.mockResolvedValue(null);

    await findGitHubMapping({
      tenantId: "t",
      githubRepo: "org/repo",
      githubNumber: 42,
      githubType: "issue",
    });

    expect(mockDb.gitHubSync.findUnique).toHaveBeenCalledOnce();
    expect(mockDb.gitHubSync.findUnique.mock.calls[0][0]).toEqual({
      where: {
        tenantId_githubRepo_githubNumber_githubType: {
          tenantId: "t",
          githubRepo: "org/repo",
          githubNumber: 42,
          githubType: "issue",
        },
      },
    });
  });
});
