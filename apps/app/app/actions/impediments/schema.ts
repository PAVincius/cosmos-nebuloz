import { z } from "zod";
import {
  ImpedimentStatus,
  nnStr,
  optCuid,
  optStr,
  PaginationSchema,
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
