import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  copilotMessageFindMany: vi.fn(),
  copilotSessionFindFirst: vi.fn(),
  copilotSessionFindMany: vi.fn(),
  copilotSessionCreate: vi.fn(),
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
  listCopilotSessions,
  loadCopilotSession,
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
});

// ─── loadCopilotSession (normalized path) ────────────────────────────────────

describe("loadCopilotSession — normalized rows", () => {
  it("returns normalized rows when copilotMessage has data", async () => {
    mocks.copilotMessageFindMany.mockResolvedValue([
      { id: "msg-1", role: "user", content: "Hello" },
      { id: "msg-2", role: "assistant", content: "Hi there" },
    ]);
    const result = await loadCopilotSession("session-1");
    expect(result).toEqual([
      { id: "msg-1", role: "user", content: "Hello" },
      { id: "msg-2", role: "assistant", content: "Hi there" },
    ]);
    expect(mocks.copilotSessionFindFirst).not.toHaveBeenCalled();
  });

  it("queries copilotMessage with sessionId and tenantId scope", async () => {
    mocks.copilotMessageFindMany.mockResolvedValue([]);
    await loadCopilotSession("session-42");
    expect(mocks.copilotMessageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: "session-42", tenantId: "tenant-1" },
      })
    );
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
