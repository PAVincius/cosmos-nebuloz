import { z } from "zod";

export const IntegrationSourceSchema = z.enum([
  "linear",
  "github",
  "asana",
  "gitlab",
] as const);
export type IntegrationSource = z.infer<typeof IntegrationSourceSchema>;

export const CreateIntegrationSchema = z.object({
  source: IntegrationSourceSchema,
  name: z.string().min(1),
  config: z.record(z.string(), z.string()), // { apiKey, token, org, workspace, ... }
});

export const ImportMappingSchema = z.object({
  integrationId: z.string().cuid(),
  projectId: z.string().min(1), // Linear teamId or GitHub project node ID
  targetType: z.enum(["feature", "story"]).default("feature"),
  epicId: z.string().cuid().optional(),
  piPlanId: z.string().cuid().optional(),
  teamId: z.string().cuid().optional(),
  // COS-85: filtro opcional pelo Project real do Linear — não confundir com
  // `projectId` acima, que para a fonte "linear" é o teamId. No plano free
  // do Linear os produtos (Charter, Signal, Meridian, Scaffold) vivem como
  // projects dentro de um único time; sem este filtro, conectar um ART ao
  // time traria as issues dos quatro produtos misturadas. Ausente → filtro
  // desligado, comportamento igual ao anterior.
  linearProjectId: z.string().min(1).optional(),
});

export type CreateIntegrationInput = z.infer<typeof CreateIntegrationSchema>;
export type ImportMappingInput = z.infer<typeof ImportMappingSchema>;

export type IntegrationRow = {
  id: string;
  source: IntegrationSource;
  name: string;
  status: string;
  lastSyncAt: Date | null;
  createdAt: Date;
  syncLogs: SyncLogRow[];
};

export type SyncLogRow = {
  id: string;
  type: string;
  status: string;
  itemsCreated: number;
  itemsUpdated: number;
  itemsSkipped: number;
  errors: unknown;
  createdAt: Date;
};
