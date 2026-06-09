import type { Supplier } from "@repo/database";
import { z } from "zod";
import {
  nnStr,
  optCuid,
  optStr,
  PaginationSchema,
  SupplierStatus,
} from "../_base";

export const CreateSupplierSchema = z.object({
  artId: optCuid,
  name: nnStr,
  contact: z.string().max(200).trim().optional(),
  description: optStr,
  status: SupplierStatus.default("ACTIVE"),
});

export const UpdateSupplierSchema = CreateSupplierSchema.partial().omit({
  artId: true,
});

export const SupplierFiltersSchema = PaginationSchema.extend({
  artId: optCuid,
  status: SupplierStatus.optional(),
  search: z.string().max(100).optional(),
});

export type CreateSupplierInput = z.infer<typeof CreateSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof UpdateSupplierSchema>;
export type SupplierFilters = z.infer<typeof SupplierFiltersSchema>;

/** Supplier does not have a Prisma relation to ART (only artId FK). Use artId directly. */
export type SupplierWithART = Supplier;
