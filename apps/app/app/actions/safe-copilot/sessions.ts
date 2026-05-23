"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";

export type SessionPreview = {
  id: string;
  surface: string | null;
  preview: string;
  createdAt: Date;
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
      id: `loaded-${i}`,
      role: m.role as "user" | "assistant",
      content: m.content ?? "",
    }));
}

export async function listCopilotSessions(): Promise<SessionPreview[]> {
  const { tenantId } = await requireTenantSession(await headers());
  const sessions = await database.copilotSession.findMany({
    where: { tenantId },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: { id: true, surface: true, messages: true, createdAt: true },
  });

  return sessions.map((s) => {
    const msgs = Array.isArray(s.messages) ? s.messages : [];
    const firstUser = (msgs as { role: string; content: string }[]).find(
      (m) => m.role === "user"
    );
    const preview = firstUser?.content
      ? firstUser.content.slice(0, 60) +
        (firstUser.content.length > 60 ? "…" : "")
      : "Nova conversa";
    return { id: s.id, surface: s.surface, preview, createdAt: s.createdAt };
  });
}
