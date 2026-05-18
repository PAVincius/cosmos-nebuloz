import { z } from "zod";
import {
  PaginationSchema,
  optCuid,
  nnStr,
  optStr,
  StoryStatus,
  Priority,
} from "../_base";

const CreateStorySchema = z.object({
  sprintId: optCuid,
  featureId: optCuid,
  title: nnStr,
  description: optStr,
  acceptanceCriteria: optStr,
  storyPoints: z.number().int().min(0).max(100).default(1),
  status: StoryStatus.default("BACKLOG"),
  priority: Priority.default("medium"),
  assigneeUserId: optCuid,
  order: z.number().int().nonnegative().default(0),
});

const UpdateStorySchema = CreateStorySchema.partial();

const StoryFiltersSchema = PaginationSchema.extend({
  sprintId: optCuid,
  featureId: optCuid,
  status: StoryStatus.optional(),
  assigneeUserId: optCuid,
  search: z.string().max(100).optional(),
});

export type CreateStoryInput = z.infer<typeof CreateStorySchema>;
export type UpdateStoryInput = z.infer<typeof UpdateStorySchema>;
export type StoryFiltersInput = z.infer<typeof StoryFiltersSchema>;
