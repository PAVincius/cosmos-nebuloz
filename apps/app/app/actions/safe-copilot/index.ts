"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";

type SuggestionType =
  | "create_pi_objectives"
  | "create_risks"
  | "flag_dependencies"
  | "create_improvement_action";

type StoredSuggestion = {
  _sug: string;
  type: SuggestionType;
  payload: unknown;
  status: "pending" | "applied" | "discarded";
  ts: number;
};

export async function createCopilotSuggestion(
  sessionId: string,
  type: SuggestionType,
  payload: unknown
): Promise<{ id: string }> {
  await requireTenantSession(await headers());
  const uuid = crypto.randomUUID();

  const session = await database.copilotSession.findUniqueOrThrow({
    where: { id: sessionId },
  });
  const messages = (
    Array.isArray(session.messages) ? session.messages : []
  ) as unknown[];

  await database.copilotSession.update({
    where: { id: sessionId },
    data: {
      messages: [
        ...messages,
        {
          _sug: uuid,
          type,
          payload,
          status: "pending",
          ts: Date.now(),
        } satisfies StoredSuggestion,
      ],
    },
  });

  return { id: `${sessionId}::${uuid}` };
}

export async function applySuggestion(id: string): Promise<void> {
  await requireTenantSession(await headers());
  const [sessionId, uuid] = id.split("::");

  const session = await database.copilotSession.findUniqueOrThrow({
    where: { id: sessionId },
  });
  const messages = (
    Array.isArray(session.messages) ? session.messages : []
  ) as StoredSuggestion[];

  await database.copilotSession.update({
    where: { id: sessionId },
    data: {
      messages: messages.map((m) =>
        m._sug === uuid ? { ...m, status: "applied" as const } : m
      ),
    },
  });
}

export async function discardSuggestion(id: string): Promise<void> {
  await requireTenantSession(await headers());
  const [sessionId, uuid] = id.split("::");

  const session = await database.copilotSession.findUniqueOrThrow({
    where: { id: sessionId },
  });
  const messages = (
    Array.isArray(session.messages) ? session.messages : []
  ) as StoredSuggestion[];

  await database.copilotSession.update({
    where: { id: sessionId },
    data: {
      messages: messages.map((m) =>
        m._sug === uuid ? { ...m, status: "discarded" as const } : m
      ),
    },
  });
}
