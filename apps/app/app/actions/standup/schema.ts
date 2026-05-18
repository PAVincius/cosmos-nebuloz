import { z } from "zod";
import { cuid, isoDate, optStr } from "../_base";

const UpsertStandupSchema = z.object({
  teamId: cuid,
  date: isoDate,
  yesterday: optStr,
  today: optStr,
  blockers: optStr,
});

export type UpsertStandupInput = z.infer<typeof UpsertStandupSchema>;
