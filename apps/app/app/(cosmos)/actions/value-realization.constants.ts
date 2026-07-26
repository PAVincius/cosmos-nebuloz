import { z } from "zod";

// EpicValueMetric realization status. Lives outside value-realization.ts
// because that file is "use server": a Server Actions module may only export
// async functions, not plain value constants. Imported by the action (Zod
// schema) and by the Value Realization screen (type).
export const ValueMetricStatus = z.enum([
  "pending",
  "tracking",
  "at-risk",
  "done",
]);
export type ValueMetricStatus = z.infer<typeof ValueMetricStatus>;
