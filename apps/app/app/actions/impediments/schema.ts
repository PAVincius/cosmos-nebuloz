import { z } from "zod";
import {
  PaginationSchema,
  nnStr,
  optStr,
  optCuid,
  ImpedimentStatus,
} from "../_base";

export const CreateImpedimentSchema = z.object({
  teamId: optCuid,
  title: nnStr,
  description: optStr,
  status: ImpedimentStatus.default("OPEN"),
  ownerUserId: optCuid,
});

export const UpdateImpedimentSchema = CreateImpedimentSchema.partial();

export const ImpedimentFiltersSchema = PaginationSchema.extend({
  teamId: optCuid,
  status: ImpedimentStatus.optional(),
});

export type CreateImpedimentInput = z.infer<typeof CreateImpedimentSchema>;
export type UpdateImpedimentInput = z.infer<typeof UpdateImpedimentSchema>;
export type ImpedimentFiltersInput = z.infer<typeof ImpedimentFiltersSchema>;
