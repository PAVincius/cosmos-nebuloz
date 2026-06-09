import type { SolutionEpic, SolutionTrain } from "@repo/database";
import { z } from "zod";
import { nnStr, optCuid, optStr, PaginationSchema } from "../_base";

export const CreateSolutionEpicSchema = z.object({
  solutionTrainId: optCuid,
  title: nnStr,
  description: optStr,
  status: z.string().default("BACKLOG"),
  wsjfScore: z.number().finite().nonnegative().max(100).default(0),
});

export const UpdateSolutionEpicSchema = CreateSolutionEpicSchema.partial().omit(
  {
    solutionTrainId: true,
  }
);

export const SolutionEpicFiltersSchema = PaginationSchema.extend({
  solutionTrainId: optCuid,
  status: z.string().optional(),
});

export type CreateSolutionEpicInput = z.infer<typeof CreateSolutionEpicSchema>;
export type UpdateSolutionEpicInput = z.infer<typeof UpdateSolutionEpicSchema>;
export type SolutionEpicFilters = z.infer<typeof SolutionEpicFiltersSchema>;

export type SolutionEpicWithSolutionTrain = SolutionEpic & {
  solutionTrain: SolutionTrain | null;
};
