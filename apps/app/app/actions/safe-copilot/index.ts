"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { z } from "zod";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const SuggestionTypeSchema = z.enum([
  "create_pi_objectives",
  "create_risks",
  "flag_dependencies",
  "create_improvement_action",
]);

type SuggestionType = z.infer<typeof SuggestionTypeSchema>;

// Items come from LLM output — require title, passthrough extra fields.
export const SuggestionPayloadSchema = z.object({
  items: z
    .array(z.object({ title: z.string().min(1).max(500) }).passthrough())
    .max(50),
});

type SuggestionPayload = z.infer<typeof SuggestionPayloadSchema>;

const StoredSuggestionSchema = z.object({
  _sug: z.string(),
  type: SuggestionTypeSchema,
  payload: SuggestionPayloadSchema,
  status: z.enum(["pending", "applied", "discarded"]),
  ts: z.number(),
});

type StoredSuggestion = z.infer<typeof StoredSuggestionSchema>;

// ─── Shared helper ────────────────────────────────────────────────────────────

// Fetches session scoped by tenantId (fixes IDOR), applies mutation, writes back.
async function withSession(
  tenantId: string,
  sessionId: string,
  mutate: (entries: unknown[]) => unknown[]
): Promise<void> {
  const session = await database.copilotSession.findFirstOrThrow({
    where: { id: sessionId, tenantId },
    select: { messages: true },
  });
  const entries = Array.isArray(session.messages) ? session.messages : [];
  await database.copilotSession.update({
    where: { id: sessionId },
    // biome-ignore lint/suspicious/noExplicitAny: Prisma Json column requires cast from unknown[]
    data: { messages: mutate(entries) as any },
  });
}

function parseSuggestionId(id: string): { sessionId: string; uuid: string } {
  const sep = id.indexOf("::");
  if (sep === -1) {
    throw new Error("Malformed suggestion id");
  }
  return { sessionId: id.slice(0, sep), uuid: id.slice(sep + 2) };
}

// ─── Server Actions ───────────────────────────────────────────────────────────

export async function createCopilotSuggestion(
  sessionId: string,
  type: SuggestionType,
  rawPayload: unknown
): Promise<{ id: string }> {
  const { tenantId } = await requireTenantSession(await headers());
  const validType = SuggestionTypeSchema.parse(type);
  const payload: SuggestionPayload = SuggestionPayloadSchema.parse(rawPayload);
  const uuid = crypto.randomUUID();

  const entry: StoredSuggestion = {
    _sug: uuid,
    type: validType,
    payload,
    status: "pending",
    ts: Date.now(),
  };

  await withSession(tenantId, sessionId, (entries) => [...entries, entry]);

  return { id: `${sessionId}::${uuid}` };
}

export async function applySuggestion(id: string): Promise<void> {
  const { tenantId } = await requireTenantSession(await headers());
  const { sessionId, uuid } = parseSuggestionId(id);

  await withSession(tenantId, sessionId, (entries) =>
    entries.map((m) => {
      const parsed = StoredSuggestionSchema.safeParse(m);
      if (parsed.success && parsed.data._sug === uuid) {
        return { ...parsed.data, status: "applied" as const };
      }
      return m;
    })
  );
}

export async function discardSuggestion(id: string): Promise<void> {
  const { tenantId } = await requireTenantSession(await headers());
  const { sessionId, uuid } = parseSuggestionId(id);

  await withSession(tenantId, sessionId, (entries) =>
    entries.map((m) => {
      const parsed = StoredSuggestionSchema.safeParse(m);
      if (parsed.success && parsed.data._sug === uuid) {
        return { ...parsed.data, status: "discarded" as const };
      }
      return m;
    })
  );
}

export async function saveCopilotMessages(
  sessionId: string,
  messages: { role: string; content: string }[],
  assistantText: string
): Promise<void> {
  const { tenantId } = await requireTenantSession(await headers());
  await database.copilotSession.update({
    where: { id: sessionId, tenantId },
    data: {
      messages: [
        ...messages,
        { role: "assistant", content: assistantText, ts: Date.now() },
      ],
    },
  });
}
