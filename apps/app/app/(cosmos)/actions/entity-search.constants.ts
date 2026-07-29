import { z } from "zod";

// Allow-listed entity kinds for EntityLinkField search (RF-94). Lives outside
// entity-search.ts because that file is "use server": a Server Actions module
// may only export async functions, not plain value constants. Imported by the
// action (Zod schema) and by EntityLinkField (type).
export const EntityKind = z.enum([
  "epic",
  "feature",
  "team",
  "theme",
  "art",
  "solutionTrain",
]);
export type EntityKind = z.infer<typeof EntityKind>;
