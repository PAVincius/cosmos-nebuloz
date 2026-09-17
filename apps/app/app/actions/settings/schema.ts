import { z } from "zod";
import { nnStr } from "../_base";

const JiraConfigSchema = z.object({
  baseUrl: z.string().url(),
  projectKey: z.string().min(1),
  apiToken: z.string().min(1),
});

const AzureConfigSchema = z.object({
  organization: z.string().min(1),
  project: z.string().min(1),
  pat: z.string().min(1),
});

const GitHubConfigSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  token: z.string().min(1),
});

const SlackConfigSchema = z.object({
  webhookUrl: z.string().url(),
  channel: z.string().default("#general"),
});

const IntegrationConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("jira"), config: JiraConfigSchema }),
  z.object({ type: z.literal("azure-devops"), config: AzureConfigSchema }),
  z.object({ type: z.literal("github"), config: GitHubConfigSchema }),
  z.object({ type: z.literal("slack"), config: SlackConfigSchema }),
]);

export const UpsertIntegrationSchema = IntegrationConfigSchema.and(
  z.object({ name: nnStr })
);
export type UpsertIntegrationInput = z.infer<typeof UpsertIntegrationSchema>;

/**
 * Public-safe shape — config is NEVER returned to avoid exposing secrets.
 */
export type IntegrationPublic = {
  id: string;
  tenantId: string;
  type: string;
  name: string;
  status: string;
  configured: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** Alias for backward-compat with components that import Integration */
export type Integration = IntegrationPublic & {
  config?: Record<string, unknown>;
};
