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

export type RetroTemplate =
  | "blank"
  | "4ls"
  | "start-stop-continue"
  | "mad-sad-glad";

export const RETRO_TEMPLATES: Record<
  RetroTemplate,
  { label: string; sections: { prompt: string }[] }
> = {
  blank: {
    label: "Em branco",
    sections: [{ prompt: "O que foi bem?" }, { prompt: "O que melhorar?" }],
  },
  "4ls": {
    label: "4Ls",
    sections: [
      { prompt: "Liked (gostamos)" },
      { prompt: "Learned (aprendemos)" },
    ],
  },
  "start-stop-continue": {
    label: "Start / Stop / Continue",
    sections: [
      { prompt: "Start (começar a fazer)" },
      { prompt: "Stop (parar de fazer)" },
    ],
  },
  "mad-sad-glad": {
    label: "Mad / Sad / Glad",
    sections: [
      { prompt: "Mad (o que nos irritou?)" },
      { prompt: "Glad (o que nos alegrou?)" },
    ],
  },
};
