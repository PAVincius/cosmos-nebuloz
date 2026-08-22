import { z } from "zod";

const IntegrationSourceSchema = z.enum([
  "linear",
  "github",
  "asana",
  "gitlab",
] as const);
// Usado por `index.ts` na forma `import("./schema").IntegrationSource`, que é
// referência de tipo inline — o knip não a enxerga e propôs remover o export.
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
});

type CreateIntegrationInput = z.infer<typeof CreateIntegrationSchema>;
type ImportMappingInput = z.infer<typeof ImportMappingSchema>;

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
