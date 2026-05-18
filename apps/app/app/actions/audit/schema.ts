import { z } from "zod";
import {
  PaginationSchema,
  cuid,
  nnStr,
  optCuid,
  optDate,
} from "../_base";

export const AuditActionSchema = z.enum([
  "created",
  "updated",
  "deleted",
  "status_changed",
  "epic_linked",
  "art_linked",
  "art_unlinked",
  "okr_created",
  "okr_updated",
  "okr_deleted",
  "kr_created",
  "kr_updated",
  "kr_deleted",
  "risk_linked",
  "risk_unlinked",
]);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const WriteAuditLogSchema = z.object({
  userId: optCuid,
  action: AuditActionSchema,
  entityType: nnStr,
  entityId: cuid,
  diff: z.record(z.string(), z.unknown()).optional(),
});
export type WriteAuditLogInput = z.infer<typeof WriteAuditLogSchema>;

export const AuditFiltersSchema = PaginationSchema.extend({
  entityType: z.string().optional(),
  userId: optCuid,
  action: AuditActionSchema.optional(),
  from: optDate,
  to: optDate,
}).transform((val) => ({
  ...val,
  limit: Math.min(val.limit, 50),
}));
export type AuditFilters = z.infer<typeof AuditFiltersSchema>;

export type AuditLog = {
  id: string;
  tenantId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  diff: Record<string, unknown> | null;
  createdAt: Date;
};
