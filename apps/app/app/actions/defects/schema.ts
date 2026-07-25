import { z } from "zod";
import {
  DefectStatus,
  nnStr,
  optCuid,
  optStr,
  PaginationSchema,
  Severity,
} from "../_base";

export const CreateDefectSchema = z.object({
  teamId: optCuid,
  storyId: optCuid,
  title: nnStr,
  description: optStr,
  severity: Severity.default("medium"),
  status: DefectStatus.default("OPEN"),
  reporterUserId: optCuid,
  assigneeUserId: optCuid,
});

export const UpdateDefectSchema = CreateDefectSchema.partial();

export const DefectFiltersSchema = PaginationSchema.extend({
  teamId: optCuid,
  status: DefectStatus.optional(),
  severity: Severity.optional(),
});

export type CreateDefectInput = z.infer<typeof CreateDefectSchema>;
export type UpdateDefectInput = z.infer<typeof UpdateDefectSchema>;
export type DefectFiltersInput = z.infer<typeof DefectFiltersSchema>;
