import { z } from "zod";

export type PortfolioEpic = {
  id: string;
  title: string;
  statusId: string;
  order: number;
  /** Média do WSJF efetivo das features (mesma regra da página do épico). */
  wsjfScore: number;
  /** Somas dos parâmetros WSJF das features (para o rodapé do card do kanban). */
  bv: number;
  tc: number;
  rr: number;
  js: number;
  featureCount: number;
};

export const CreateEpicSchema = z.object({
  title: z.string().min(1, "Título obrigatório").max(200),
  statusId: z.string().default("BACKLOG"),
  strategicThemeId: z.string().optional().nullable(),
  descriptionMd: z.string().optional().nullable(),
});

export const UpdateEpicSchema = z.object({
  epicId: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  statusId: z.string().optional(),
  strategicThemeId: z.string().optional().nullable(),
  descriptionMd: z.string().optional().nullable(),
  order: z.number().int().min(0).optional(),
});

export type CreateEpicInput = z.infer<typeof CreateEpicSchema>;
export type UpdateEpicInput = z.infer<typeof UpdateEpicSchema>;
