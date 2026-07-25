import type { Capability, SolutionTrain } from "@repo/database";
import { z } from "zod";
import {
  CapabilityStatus,
  cuid,
  nnStr,
  optCuid,
  optStr,
  PaginationSchema,
} from "../_base";

export const CreateCapabilitySchema = z.object({
  solutionTrainId: optCuid,
  title: nnStr,
  description: optStr,
  status: CapabilityStatus.default("BACKLOG"),
  order: z.number().int().nonnegative().default(0),
});

export const UpdateCapabilitySchema = CreateCapabilitySchema.partial().omit({
  solutionTrainId: true,
});

export const CapabilityFiltersSchema = PaginationSchema.extend({
  solutionTrainId: optCuid,
  status: CapabilityStatus.optional(),
});

export const ReorderCapabilitiesSchema = z.object({
  orderedIds: z.array(cuid).min(1).max(200),
});

export type CreateCapabilityInput = z.infer<typeof CreateCapabilitySchema>;
export type UpdateCapabilityInput = z.infer<typeof UpdateCapabilitySchema>;
export type CapabilityFilters = z.infer<typeof CapabilityFiltersSchema>;
export type ReorderCapabilitiesInput = z.infer<
  typeof ReorderCapabilitiesSchema
>;

export type CapabilityWithSolutionTrain = Capability & {
  solutionTrain: SolutionTrain | null;
};
