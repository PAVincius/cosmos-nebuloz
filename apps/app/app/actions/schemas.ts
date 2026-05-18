/**
 * Zod schemas for all server action inputs.
 * Parse at the boundary — fail fast before any DB operation.
 */
import { z } from "zod";

// ─── Primitives ─────────────────────────────────────────────────────────────

const id = z.string().min(1).max(64);
const safeTitle = z.string().min(1).max(200).trim();

/** WSJF parameter: finite, non-negative, max 10 */
const wsjfParam = z.number().finite().nonnegative().max(10);

/** Job Size: finite, strictly positive, max 10 */
const jobSize = z.number().finite().positive().max(10);

// ─── Epic / Feature ──────────────────────────────────────────────────────────

export const EPIC_STATUSES = [
  "BACKLOG",
  "REVIEW",
  "ANALYSIS",
  "IMPLEMENTING",
  "DONE",
] as const;

export const UpdateEpicStatusSchema = z.object({
  epicId: id,
  statusId: z.enum(EPIC_STATUSES),
  order: z.number().int().nonnegative(),
});
export type UpdateEpicStatusInput = z.infer<typeof UpdateEpicStatusSchema>;

export const UpdateWSJFSchema = z.object({
  featureId: id,
  bv: wsjfParam,
  tc: wsjfParam,
  rr: wsjfParam,
  js: jobSize,
});
export type UpdateWSJFInput = z.infer<typeof UpdateWSJFSchema>;

// ─── ART / PI ────────────────────────────────────────────────────────────────

export const CreateARTSchema = z.object({
  name: safeTitle,
  cadence: z.number().int().min(4).max(26).optional().default(10),
});
export type CreateARTInput = z.infer<typeof CreateARTSchema>;

export const CreatePIPlanSchema = z.object({
  artId: id,
  name: safeTitle,
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});
export type CreatePIPlanInput = z.infer<typeof CreatePIPlanSchema>;

// ─── Confidence Vote ─────────────────────────────────────────────────────────

const VoteScore = z.number().int().min(1).max(5);

export const ConfidenceVoteEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("START_VOTING") }),
  z.object({ type: z.literal("CLOSE_VOTING") }),
  z.object({ type: z.literal("SUBMIT_VOTE"), vote: VoteScore }),
  z.object({ type: z.literal("APPROVE_PI") }),
  z.object({ type: z.literal("REQUIRE_REWORK") }),
  z.object({ type: z.literal("RESET_VOTING") }),
]);

export const SendVoteEventSchema = z.object({
  sessionId: id,
  event: ConfidenceVoteEventSchema,
});
export type SendVoteEventInput = z.infer<typeof SendVoteEventSchema>;

// ─── API Routes ──────────────────────────────────────────────────────────────

export const SwitchTenantSchema = z.object({
  tenantId: id,
});
export type SwitchTenantInput = z.infer<typeof SwitchTenantSchema>;
