import { SAFE_COMPETENCIES } from "./schema";

export const COMPETENCIES = SAFE_COMPETENCIES.map((c) => ({
  id: c.key,
  label: c.label,
}));

export type CompetencyId = (typeof COMPETENCIES)[number]["id"];
