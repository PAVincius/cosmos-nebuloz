import { z } from "zod";
import type { RoadmapItem } from "@repo/database";
import {
  nnStr,
  optStr,
  optCuid,
  isoDate,
  optDate,
  RoadmapStatus,
} from "@/app/actions/_base";

const RoadmapItemBaseSchema = z.object({
  epicId:      optCuid,
  title:       nnStr,
  description: optStr,
  startDate:   isoDate,
  endDate:     isoDate,
  color:       z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida (formato #RRGGBB)").default("#6366f1"),
  artId:       optCuid,
  status:      RoadmapStatus.default("PLANNED"),
});

export const CreateRoadmapItemSchema = RoadmapItemBaseSchema.refine(
  (d) => d.endDate >= d.startDate,
  { message: "endDate deve ser >= startDate", path: ["endDate"] },
);

export const UpdateRoadmapItemSchema = RoadmapItemBaseSchema.partial();

export const RoadmapFiltersSchema = z.object({
  artId:  optCuid,
  status: RoadmapStatus.optional(),
  from:   optDate,
  to:     optDate,
});

export type CreateRoadmapItemInput = z.infer<typeof CreateRoadmapItemSchema>;
export type UpdateRoadmapItemInput = z.infer<typeof UpdateRoadmapItemSchema>;
export type RoadmapFiltersInput    = z.infer<typeof RoadmapFiltersSchema>;

/** String literal union for roadmap status values (includes legacy CANCELLED for UI compat) */
export type RoadmapStatus = z.infer<typeof RoadmapStatus> | "CANCELLED";

/** @deprecated use RoadmapItemWithRelations */
export type RoadmapItemData = {
  id:          string;
  title:       string;
  description: string | null;
  startDate:   Date;
  endDate:     Date;
  color:       string;
  status:      RoadmapStatus;
  epicId:      string | null;
  artId:       string | null;
};

export type RoadmapItemWithRelations = RoadmapItem & {
  epic:         { id: string; title: string; statusId: string } | null;
  art:          { id: string; name: string } | null;
  durationDays: number; // computed: endDate - startDate in days
};
