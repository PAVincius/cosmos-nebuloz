import { z } from "zod";

const TASK_TYPES = [
  "backend",
  "frontend",
  "ml",
  "infra",
  "qa",
  "data",
  "design",
] as const;
type TaskType = (typeof TASK_TYPES)[number];

const teamCapabilitySchema = z.object({
  teamId: z.string(),
  artId: z.string().nullable(),
  capabilities: z.record(
    z.enum(TASK_TYPES),
    z.object({
      deliveredSp: z.number().min(0),
      avgCycleTimeHours: z.number().min(0),
      confidenceLevel: z.number().min(0).max(1),
    })
  ),
  windowSprints: z.number().int().positive(),
});
export type TeamCapability = z.infer<typeof teamCapabilitySchema>;

const initiativeDemandSchema = z.object({
  initiativeId: z.string(),
  initiativeType: z.enum(["epic", "feature"]),
  demand: z.record(z.enum(TASK_TYPES), z.number().min(0).max(1)),
});
export type InitiativeDemand = z.infer<typeof initiativeDemandSchema>;

const capabilityGapSchema = z.object({
  teamId: z.string(),
  initiativeId: z.string(),
  initiativeType: z.enum(["epic", "feature"]),
  overallScore: z.number(),
  gapsByCategory: z.record(
    z.enum(TASK_TYPES),
    z.object({
      demand: z.number(),
      capability: z.number(),
      gap: z.number(),
      weight: z.number(),
    })
  ),
  recommendation: z.string(),
});
type CapabilityGap = z.infer<typeof capabilityGapSchema>;
