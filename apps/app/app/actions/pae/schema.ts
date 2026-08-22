import { z } from "zod";
import { cuid } from "../_base";

const PAE_DURATIONS = ["1h", "4h", "8h", "24h"] as const;
export type PAEDuration = (typeof PAE_DURATIONS)[number];

const PAE_STATUSES = ["PENDING", "APPROVED", "DENIED", "REVOKED"] as const;
type PAEStatus = (typeof PAE_STATUSES)[number];

export const CreatePAERequestSchema = z.object({
  entityType: z.string().min(1),
  action: z.string().min(1),
  targetEntityId: cuid.optional(),
  justification: z.string().max(500).trim().optional(),
  duration: z.enum(PAE_DURATIONS),
});
type CreatePAERequestInput = z.infer<typeof CreatePAERequestSchema>;

export const ResolvePAERequestSchema = z.object({
  id: cuid,
});
type ResolvePAERequestInput = z.infer<typeof ResolvePAERequestSchema>;

export type PAERequest = {
  id: string;
  tenantId: string;
  requesterId: string;
  entityType: string;
  action: string;
  targetEntityId: string | null;
  justification: string | null;
  duration: PAEDuration;
  status: PAEStatus;
  approverId: string | null;
  approvedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function durationToMs(duration: PAEDuration): number {
  const map: Record<PAEDuration, number> = {
    "1h": 60 * 60 * 1000,
    "4h": 4 * 60 * 60 * 1000,
    "8h": 8 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
  };
  return map[duration];
}
