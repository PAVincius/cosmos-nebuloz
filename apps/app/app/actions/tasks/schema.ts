import { z } from "zod";
import { cuid, nnStr, optCuid, optStr, TaskStatus } from "../_base";

export const CreateTaskSchema = z.object({
  storyId: cuid,
  title: nnStr,
  description: optStr,
  status: TaskStatus.default("TODO"),
  assigneeUserId: optCuid,
  estimateHours: z.number().positive().max(999).optional(),
});

export const UpdateTaskSchema = CreateTaskSchema.partial().omit({
  storyId: true,
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
