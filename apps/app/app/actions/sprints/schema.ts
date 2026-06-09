import { z } from "zod";
import {
  cuid,
  isoDate,
  nnStr,
  optCuid,
  optStr,
  PaginationSchema,
  SprintStatus,
} from "../_base";

const SprintBaseSchema = z.object({
  teamId: cuid,
  name: nnStr,
  goal: optStr,
  startDate: isoDate,
  endDate: isoDate,
  capacity: z.number().int().positive().optional(),
});

export const UpdateSprintSchema = SprintBaseSchema.partial().omit({
  teamId: true,
});

export const SprintFiltersSchema = PaginationSchema.extend({
  teamId: optCuid,
  status: SprintStatus.optional(),
});

export type CreateSprintInput = z.infer<typeof SprintBaseSchema>;
export type UpdateSprintInput = z.infer<typeof UpdateSprintSchema>;
export type SprintFiltersInput = z.infer<typeof SprintFiltersSchema>;
