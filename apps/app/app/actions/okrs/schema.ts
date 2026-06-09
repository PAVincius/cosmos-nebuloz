import type { OKR } from "@repo/database";
import { z } from "zod";
import {
  cuid,
  nnStr,
  OKRStatus,
  optCuid,
  optStr,
  PaginationSchema,
} from "@/app/actions/_base";

export const CreateOKRSchema = z.object({
  piPlanId: optCuid,
  title: nnStr,
  description: optStr,
  ownerId: optCuid,
  status: OKRStatus.default("ON_TRACK"),
});

export const UpdateOKRSchema = CreateOKRSchema.partial();

export const OKRFiltersSchema = PaginationSchema.extend({
  piPlanId: optCuid,
  status: OKRStatus.optional(),
});

export const CreateKeyResultSchema = z.object({
  okrId: cuid,
  title: nnStr,
  current: z.number().finite().default(0),
  target: z.number().finite().positive(),
  unit: z.string().max(20).default("%"),
});

export const UpdateKeyResultSchema = CreateKeyResultSchema.partial().omit({
  okrId: true,
});

export const UpdateKeyResultProgressSchema = z.object({
  current: z.number().finite().min(0),
});

export const CreateCheckInSchema = z.object({
  keyResultId: cuid,
  value: z.number().finite().min(0),
  note: z.string().max(500).optional(),
});

/** Union string literal type for OKR status values */
export type OKRStatus = z.infer<typeof OKRStatus>;

export type CreateOKRInput = z.infer<typeof CreateOKRSchema>;
export type UpdateOKRInput = z.infer<typeof UpdateOKRSchema>;
export type OKRFiltersInput = z.infer<typeof OKRFiltersSchema>;
export type CreateKeyResultInput = z.infer<typeof CreateKeyResultSchema>;
export type UpdateKeyResultInput = z.infer<typeof UpdateKeyResultSchema>;
export type CreateCheckInInput = z.infer<typeof CreateCheckInSchema>;

export type KeyResultWithProgress = {
  id: string;
  title: string;
  current: number;
  target: number;
  unit: string;
  metric?: string | null;
  baseline?: number | null;
  measurementType?: string | null;
  dataSource?: string | null;
  dueDate?: Date | null;
  ownerId?: string | null;
  okrId?: string;
  tenantId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  progress: number; // 0-100
  snapshots?: KeyResultSnapshotItem[];
};

export type OKRWithProgress = OKR & {
  keyResults: KeyResultWithProgress[];
  progress: number; // 0-100, média de (current/target) dos keyResults
};

// SAFe context enrichment
export type OKRContextData = {
  themeTitle: string | null;
  themeColor: string | null;
};

export type OKRWithContext = OKRWithProgress & OKRContextData;

export type KeyResultSnapshotItem = {
  id: string;
  keyResultId: string;
  value: number;
  note: string | null;
  recordedAt: Date;
};
