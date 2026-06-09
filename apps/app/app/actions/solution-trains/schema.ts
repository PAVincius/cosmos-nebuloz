import type { Capability, SolutionEpic, SolutionTrain } from "@repo/database";
import { z } from "zod";
import { nnStr, optStr } from "../_base";

export const CreateSolutionTrainSchema = z.object({
  name: nnStr,
  description: optStr,
});

export const UpdateSolutionTrainSchema = CreateSolutionTrainSchema.partial();

export type CreateSolutionTrainInput = z.infer<
  typeof CreateSolutionTrainSchema
>;
export type UpdateSolutionTrainInput = z.infer<
  typeof UpdateSolutionTrainSchema
>;

export type SolutionTrainWithCounts = SolutionTrain & {
  _count: { capabilities: number; solutionEpics: number };
};

export type SolutionTrainWithRelations = SolutionTrain & {
  capabilities: Capability[];
  solutionEpics: SolutionEpic[];
};
