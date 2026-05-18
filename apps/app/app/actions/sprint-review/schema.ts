import { z } from "zod";
import { cuid, optStr } from "../_base";

const UpsertSprintReviewSchema = z.object({
  sprintId: cuid,
  velocity: z.number().int().nonnegative().optional(),
  demoNotes: optStr,
  goalMet: z.boolean().default(false),
});

export type UpsertSprintReviewInput = z.infer<typeof UpsertSprintReviewSchema>;
