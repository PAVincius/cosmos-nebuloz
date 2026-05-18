import { z } from "zod";
import { nnStr, optCuid, optDate } from "../_base";

const RetroActionSchema = z.object({
  title: nnStr,
  ownerUserId: optCuid,
  dueDate: optDate,
});

export type RetroAction = z.infer<typeof RetroActionSchema>;

const UpsertRetroSchema = z.object({
  sprintId: z.string().min(1),
  wentWell: z.array(z.string().min(1)).max(50),
  toImprove: z.array(z.string().min(1)).max(50),
  actions: z.array(RetroActionSchema).max(50),
});

export type UpsertRetroInput = z.infer<typeof UpsertRetroSchema>;
