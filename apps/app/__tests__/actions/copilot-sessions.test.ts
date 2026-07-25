import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  copilotMessageFindMany: vi.fn(),
  copilotSessionFindFirst: vi.fn(),
  copilotSessionFindMany: vi.fn(),
  copilotSessionCreate: vi.fn(),
  copilotSessionUpdateMany: vi.fn(),
  copilotSessionDeleteMany: vi.fn(),
  requireTenantSession: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    copilotMessage: {
      findMany: mocks.copilotMessageFindMany,
    },
    copilotSession: {
      findFirst: mocks.copilotSessionFindFirst,
      findMany: mocks.copilotSessionFindMany,
      create: mocks.copilotSessionCreate,
      updateMany: mocks.copilotSessionUpdateMany,
      deleteMany: mocks.copilotSessionDeleteMany,
    },
  },
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

import {
  createCopilotSession,
  deleteCopilotSession,
  listCopilotSessions,
  loadCopilotSession,
  pinCopilotSession,
  renameCopilotSession,
  unpinCopilotSession,
} from "../../app/actions/safe-copilot/sessions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue({});
  mocks.requireTenantSession.mockResolvedValue({
    tenantId: "tenant-1",
    userId: "user-1",
  });
  mocks.copilotMessageFindMany.mockResolvedValue([]);
  mocks.copilotSessionFindFirst.mockResolvedValue(null);
  mocks.copilotSessionFindMany.mockResolvedValue([]);
  mocks.copilotSessionCreate.mockResolvedValue({ id: "session-1" });
  mocks.copilotSessionUpdateMany.mockResolvedValue({ count: 1 });
  mocks.copilotSessionDeleteMany.mockResolvedValue({ count: 1 });
});

// ─── loadCopilotSession (normalized path) ────────────────────────────────────

describe("loadCopilotSession — normalized rows", () => {
  it("returns normalized rows when copilotMessage has data and the caller owns the session", async () => {
    mocks.copilotSessionFindFirst.mockResolvedValue({ messages: [] });
    mocks.copilotMessageFindMany.mockResolvedValue([
      { id: "msg-1", role: "user", content: "Hello" },
      { id: "msg-2", role: "assistant", content: "Hi there" },
    ]);
    const result = await loadCopilotSession("session-1");
    expect(result).toEqual([
      { id: "msg-1", role: "user", content: "Hello" },
      { id: "msg-2", role: "assistant", content: "Hi there" },
    ]);
  });

  it("queries copilotMessage with sessionId and tenantId scope", async () => {
    mocks.copilotSessionFindFirst.mockResolvedValue({ messages: [] });
    mocks.copilotMessageFindMany.mockResolvedValue([]);
    await loadCopilotSession("session-42");
    expect(mocks.copilotMessageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: "session-42", tenantId: "tenant-1" },
      })
    );
  });
});

// ─── F1 regression: sessions are scoped to their author ──────────────────────

describe("loadCopilotSession — ownership scoping", () => {
  it("checks ownership with id, tenantId, AND userId before returning anything", async () => {
    mocks.copilotSessionFindFirst.mockResolvedValue({ messages: [] });
    await loadCopilotSession("session-1");
    expect(mocks.copilotSessionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "session-1", tenantId: "tenant-1", userId: "user-1" },
      })
    );
  });

  it("returns [] for a session owned by another user in the same tenant, without ever reading messages", async () => {
    // Simulates the DB filtering out a session that belongs to a different user.
    mocks.copilotSessionFindFirst.mockResolvedValue(null);
    mocks.copilotMessageFindMany.mockResolvedValue([
      { id: "msg-1", role: "user", content: "Someone else's secret" },
    ]);
    const result = await loadCopilotSession("other-users-session");
    expect(result).toEqual([]);
    expect(mocks.copilotMessageFindMany).not.toHaveBeenCalled();
  });
});

describe("pinCopilotSession / unpinCopilotSession — ownership scoping", () => {
  it("scopes pin to id, tenantId, and userId", async () => {
    await pinCopilotSession("session-1");
    expect(mocks.copilotSessionUpdateMany).toHaveBeenCalledWith({
      where: { id: "session-1", tenantId: "tenant-1", userId: "user-1" },
      data: { pinnedAt: expect.any(Date) },
    });
  });

  it("scopes unpin to id, tenantId, and userId", async () => {
    await unpinCopilotSession("session-1");
    expect(mocks.copilotSessionUpdateMany).toHaveBeenCalledWith({
      where: { id: "session-1", tenantId: "tenant-1", userId: "user-1" },
      data: { pinnedAt: null },
    });
  });

  it("does not pin another user's session (zero rows affected)", async () => {
    // Simulates updateMany matching nothing because userId is scoped in the where.
    mocks.copilotSessionUpdateMany.mockResolvedValue({ count: 0 });
    await pinCopilotSession("other-users-session");
    expect(mocks.copilotSessionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1" }),
      })
    );
  });
});

describe("deleteCopilotSession — ownership scoping", () => {
  it("scopes delete to id, tenantId, and userId", async () => {
    await deleteCopilotSession("session-1");
    expect(mocks.copilotSessionDeleteMany).toHaveBeenCalledWith({
      where: { id: "session-1", tenantId: "tenant-1", userId: "user-1" },
    });
  });

  it("does not delete another user's session (zero rows affected)", async () => {
    mocks.copilotSessionDeleteMany.mockResolvedValue({ count: 0 });
    await deleteCopilotSession("other-users-session");
    expect(mocks.copilotSessionDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1" }),
      })
    );
  });
});

describe("renameCopilotSession — ownership scoping", () => {
  it("scopes rename to id, tenantId, and userId", async () => {
    await renameCopilotSession("session-1", "New title");
    expect(mocks.copilotSessionUpdateMany).toHaveBeenCalledWith({
      where: { id: "session-1", tenantId: "tenant-1", userId: "user-1" },
      data: { title: "New title" },
    });
  });
});

// ─── loadCopilotSession (JSON blob fallback) ──────────────────────────────────

describe("loadCopilotSession — blob fallback", () => {
  it("returns [] when copilotMessage empty and session not found", async () => {
    mocks.copilotSessionFindFirst.mockResolvedValue(null);
    const result = await loadCopilotSession("session-1");
    expect(result).toEqual([]);
  });

  it("returns [] when blob session has empty messages array", async () => {
    mocks.copilotSessionFindFirst.mockResolvedValue({ messages: [] });
    const result = await loadCopilotSession("session-1");
    expect(result).toEqual([]);
  });

  it("maps blob messages to StoredMessage with blob-N ids", async () => {
    mocks.copilotSessionFindFirst.mockResolvedValue({
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ],
    });
    const result = await loadCopilotSession("session-1");
    expect(result).toEqual([
      { id: "blob-0", role: "user", content: "Hello" },
      { id: "blob-1", role: "assistant", content: "Hi there" },
    ]);
  });

  it("filters out messages with unknown roles in blob path", async () => {
    mocks.copilotSessionFindFirst.mockResolvedValue({
      messages: [
        { role: "system", content: "System prompt" },
        { role: "user", content: "User message" },
        { role: "tool", content: "Tool output" },
      ],
    });
    const result = await loadCopilotSession("session-1");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "blob-0",
      role: "user",
      content: "User message",
    });
  });

  it("handles non-array messages field gracefully", async () => {
    mocks.copilotSessionFindFirst.mockResolvedValue({ messages: null });
    const result = await loadCopilotSession("session-1");
    expect(result).toEqual([]);
  });
});

// ─── listCopilotSessions ─────────────────────────────────────────────────────

describe("listCopilotSessions", () => {
  it("returns [] when no sessions", async () => {
    const result = await listCopilotSessions();
    expect(result).toEqual([]);
  });

  it("scopes the query to tenantId AND userId, not tenant-wide", async () => {
    await listCopilotSessions();
    expect(mocks.copilotSessionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1", userId: "user-1" },
      })
    );
  });

  it("uses title as preview when session has a title", async () => {
    mocks.copilotSessionFindMany.mockResolvedValue([
      {
        id: "s1",
        surface: "global",
        title: "My analysis session",
        messages: [],
        createdAt: new Date("2026-01-01"),
      },
    ]);
    const result = await listCopilotSessions();
    expect(result[0].preview).toBe("My analysis session");
  });

  it("falls back to first user message when title is null", async () => {
    mocks.copilotSessionFindMany.mockResolvedValue([
      {
        id: "s1",
        surface: "global",
        title: null,
        messages: [{ role: "user", content: "Short message" }],
        createdAt: new Date("2026-01-01"),
      },
    ]);
    const result = await listCopilotSessions();
    expect(result[0].preview).toBe("Short message");
  });

  it("sets preview to 'Nova conversa' when no title and no user messages", async () => {
    mocks.copilotSessionFindMany.mockResolvedValue([
      {
        id: "s1",
        surface: "global",
        title: null,
        messages: [{ role: "assistant", content: "Hello" }],
        createdAt: new Date("2026-01-01"),
      },
    ]);
    const result = await listCopilotSessions();
    expect(result[0].preview).toBe("Nova conversa");
  });

  it("truncates long preview with '…' at 60 chars", async () => {
    const longMessage = "A".repeat(80);
    mocks.copilotSessionFindMany.mockResolvedValue([
      {
        id: "s1",
        surface: "global",
        title: null,
        messages: [{ role: "user", content: longMessage }],
        createdAt: new Date("2026-01-01"),
      },
    ]);
    const result = await listCopilotSessions();
    expect(result[0].preview).toBe(`${"A".repeat(60)}…`);
  });
});

// ─── createCopilotSession ─────────────────────────────────────────────────────

describe("createCopilotSession", () => {
  it("calls database.copilotSession.create with correct data", async () => {
    await createCopilotSession("rte");
    expect(mocks.copilotSessionCreate).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        userId: "user-1",
        surface: "rte",
        messages: [],
      },
      select: { id: true },
    });
  });

  it("returns the session id", async () => {
    mocks.copilotSessionCreate.mockResolvedValue({ id: "new-session-42" });
    const result = await createCopilotSession();
    expect(result).toEqual({ id: "new-session-42" });
  });
});
