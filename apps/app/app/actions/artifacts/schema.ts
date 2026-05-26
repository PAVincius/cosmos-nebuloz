import { z } from "zod";

export const SaveArtifactSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(["prompt", "prd", "spec", "playbook", "transcript"]),
  content: z.string().min(1),
  epicId: z.string().optional(),
});

export type SaveArtifactInput = z.infer<typeof SaveArtifactSchema>;
