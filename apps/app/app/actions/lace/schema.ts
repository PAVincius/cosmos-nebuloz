import { z } from "zod";
import { nnStr, optStr } from "../_base";

export const UpsertLACESchema = z.object({
  name: nnStr,
  description: optStr,
  principles: z.array(z.string().min(1).max(200)).max(50).default([]),
});

export const AddPrincipleSchema = z.object({
  principle: z.string().min(1).max(200),
});

export type UpsertLACEInput = z.infer<typeof UpsertLACESchema>;
export type AddPrincipleInput = z.infer<typeof AddPrincipleSchema>;
