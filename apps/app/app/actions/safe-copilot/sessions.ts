"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";

export type SessionPreview = {
  id: string;
  surface: string | null;
  preview: string;
  createdAt: Date;
  pinnedAt: Date | null;
};

export async function createCopilotSession(
  surface = "global",
  _mode = "global"
): Promise<{ id: string }> {
  const { tenantId, userId } = await requireTenantSession(await headers());
  const session = await database.copilotSession.create({
    data: { tenantId, userId, surface, messages: [] },
    select: { id: true },
  });
  return session;
}

export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export async function loadCopilotSession(
  sessionId: string
): Promise<StoredMessage[]> {
  const { tenantId } = await requireTenantSession(await headers());

  // Prefer normalized rows; fall back to JSON blob for pre-normalization sessions
  const rows = await database.copilotMessage.findMany({
    where: { sessionId, tenantId },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true },
  });

  if (rows.length > 0) {
    return rows.map((r) => ({
      id: r.id,
      role: r.role as "user" | "assistant",
      content: r.content,
    }));
  }

  // Fallback: JSON blob from copilot_sessions.messages
  const session = await database.copilotSession.findFirst({
    where: { id: sessionId, tenantId },
    select: { messages: true },
  });
  if (!session) {
    return [];
  }
  const raw = Array.isArray(session.messages) ? session.messages : [];
  return (raw as { role?: string; content?: string }[])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m, i) => ({
      id: `blob-${i}`,
      role: m.role as "user" | "assistant",
      content: m.content ?? "",
    }));
}

const SESSION_WINDOW = 20;

export function buildContextWindow(messages: StoredMessage[]): StoredMessage[] {
  if (messages.length <= SESSION_WINDOW) {
    return messages;
  }

  const older = messages.slice(0, messages.length - SESSION_WINDOW);
  const recent = messages.slice(-SESSION_WINDOW);

  const userTopics = older
    .filter((m) => m.role === "user")
    .map((m) => m.content.slice(0, 60))
    .join("; ");

  const summary: StoredMessage = {
    id: "ctx-summary",
    role: "assistant",
    content: `[Contexto anterior: ${older.length} mensagens cobrindo: ${userTopics || "conversa anterior"}]`,
  };

  return [summary, ...recent];
}

export async function pinCopilotSession(sessionId: string): Promise<void> {
  const { tenantId } = await requireTenantSession(await headers());
  await database.copilotSession.updateMany({
    where: { id: sessionId, tenantId },
    data: { pinnedAt: new Date() },
  });
}

export async function unpinCopilotSession(sessionId: string): Promise<void> {
  const { tenantId } = await requireTenantSession(await headers());
  await database.copilotSession.updateMany({
    where: { id: sessionId, tenantId },
    data: { pinnedAt: null },
  });
}

export async function deleteCopilotSession(sessionId: string): Promise<void> {
  const { tenantId } = await requireTenantSession(await headers());
  await database.copilotSession.deleteMany({
    where: { id: sessionId, tenantId },
  });
}

export async function renameCopilotSession(
  sessionId: string,
  title: string
): Promise<void> {
  const { tenantId } = await requireTenantSession(await headers());
  await database.copilotSession.updateMany({
    where: { id: sessionId, tenantId },
    data: { title: title.slice(0, 120) },
  });
}

export async function listCopilotSessions(): Promise<SessionPreview[]> {
  const { tenantId } = await requireTenantSession(await headers());
  const sessions = await database.copilotSession.findMany({
    where: { tenantId },
    orderBy: [{ pinnedAt: "desc" }, { updatedAt: "desc" }],
    take: 50,
    select: {
      id: true,
      surface: true,
      title: true,
      messages: true,
      createdAt: true,
      pinnedAt: true,
    },
  });

  return sessions.map((s) => {
    let preview = s.title ?? null;
    if (!preview) {
      const msgs = Array.isArray(s.messages) ? s.messages : [];
      const firstUser = (msgs as { role: string; content: string }[]).find(
        (m) => m.role === "user"
      );
      preview = firstUser?.content ?? null;
    }
    const truncated = preview
      ? preview.slice(0, 60) + (preview.length > 60 ? "…" : "")
      : "Nova conversa";
    return {
      id: s.id,
      surface: s.surface,
      preview: truncated,
      createdAt: s.createdAt,
      pinnedAt: s.pinnedAt,
    };
  });
}
