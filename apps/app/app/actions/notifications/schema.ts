import { z } from "zod";
import { cuid, nnStr, optStr, PaginationSchema } from "../_base";

const NotificationTypeSchema = z.enum([
  "mention",
  "assignment",
  "risk",
  "deadline",
  "system",
  "pae_request",
  "pae_approved",
  "pae_denied",
  "pae_revoked",
]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

const CreateNotificationSchema = z.object({
  userId: cuid,
  type: NotificationTypeSchema,
  title: nnStr,
  body: optStr,
  metadata: z.record(z.string(), z.unknown()).optional(),
});
type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>;

const NotificationFiltersSchema = PaginationSchema.extend({
  read: z.boolean().optional(),
  type: NotificationTypeSchema.optional(),
});
type NotificationFilters = z.infer<typeof NotificationFiltersSchema>;

type Notification = {
  id: string;
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

/** Alias for backward-compat with components that import NotificationRecord */
type NotificationRecord = Notification;
