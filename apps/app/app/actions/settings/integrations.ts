"use server";

import { requireTenantSession, requireRole } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  type Result,
  safeAction,
  IntegrationStatus,
  IntegrationType,
} from "../_base";
import {
  UpsertIntegrationSchema,
  type UpsertIntegrationInput,
  type IntegrationPublic,
  type IntegrationFull,
  type Integration,
} from "./schema";

export type { UpsertIntegrationInput, IntegrationPublic, IntegrationFull, Integration };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toPublic(row: {
  id: string;
  tenantId: string;
  type: string;
  name: string;
  status: string;
  config: unknown;
  createdAt: Date;
  updatedAt: Date;
}): IntegrationPublic {
  return {
    id: row.id,
    tenantId: row.tenantId,
    type: row.type,
    name: row.name,
    status: row.status,
    configured: row.config !== null && Object.keys(row.config as object).length > 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns integrations WITHOUT config to avoid leaking tokens/passwords.
 */
export async function listIntegrations(): Promise<Result<IntegrationPublic[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const rows = await database.integration.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "desc" },
    });

    return rows.map(toPublic);
  });
}

/**
 * Returns the full integration with config — SERVER-SIDE ONLY.
 * Do NOT call from client components.
 */
export async function getIntegrationByType(
  type: string
): Promise<Result<IntegrationFull>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    IntegrationType.parse(type);

    const row = await database.integration.findUnique({
      where: { tenantId_type: { tenantId: ctx.tenantId, type } },
    });
    if (!row) throw new Error(`Integração '${type}' não encontrada.`);

    return {
      ...toPublic(row),
      config: (row.config as Record<string, unknown>) ?? {},
    };
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Upsert by @@unique([tenantId, type]). Requires ADMIN role.
 */
export async function upsertIntegration(
  raw: unknown
): Promise<Result<IntegrationPublic>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN"], ctx);

    const data = UpsertIntegrationSchema.parse(raw);

    const row = await database.integration.upsert({
      where: { tenantId_type: { tenantId: ctx.tenantId, type: data.type } },
      create: {
        tenantId: ctx.tenantId,
        type: data.type,
        name: data.name,
        config: data.config as Record<string, string>,
        status: "ACTIVE",
      },
      update: {
        name: data.name,
        config: data.config as Record<string, string>,
        status: "ACTIVE",
      },
    });

    revalidatePath("/settings/integrations");
    return toPublic(row);
  });
}

/**
 * Performs a basic connectivity ping to the integration endpoint.
 * Updates status to ACTIVE or ERROR based on result.
 */
export async function testIntegration(
  type: string
): Promise<Result<{ ok: boolean; message: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    IntegrationType.parse(type);

    const row = await database.integration.findUnique({
      where: { tenantId_type: { tenantId: ctx.tenantId, type } },
    });
    if (!row) throw new Error(`Integração '${type}' não encontrada.`);

    const config = (row.config as Record<string, string>) ?? {};
    let testOk = false;
    let message = "Teste não implementado para este tipo.";

    try {
      if (type === "jira") {
        const res = await fetch(`${config.baseUrl}/rest/api/3/myself`, {
          headers: {
            Authorization: `Bearer ${config.apiToken}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(5000),
        });
        testOk = res.ok;
        message = res.ok
          ? "Conexão com Jira estabelecida com sucesso."
          : `Jira retornou HTTP ${res.status}.`;
      } else if (type === "github") {
        const res = await fetch(
          `https://api.github.com/repos/${config.owner}/${config.repo}`,
          {
            headers: {
              Authorization: `Bearer ${config.token}`,
              Accept: "application/vnd.github+json",
            },
            signal: AbortSignal.timeout(5000),
          }
        );
        testOk = res.ok;
        message = res.ok
          ? "Conexão com GitHub estabelecida com sucesso."
          : `GitHub retornou HTTP ${res.status}.`;
      } else if (type === "azure-devops") {
        const base64Pat = Buffer.from(`:${config.pat}`).toString("base64");
        const res = await fetch(
          `https://dev.azure.com/${config.organization}/${config.project}/_apis/build/builds?api-version=7.0&$top=1`,
          {
            headers: { Authorization: `Basic ${base64Pat}` },
            signal: AbortSignal.timeout(5000),
          }
        );
        testOk = res.ok;
        message = res.ok
          ? "Conexão com Azure DevOps estabelecida com sucesso."
          : `Azure DevOps retornou HTTP ${res.status}.`;
      } else if (type === "slack") {
        const res = await fetch(config.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "Cosmos Nebuloz — teste de conexão." }),
          signal: AbortSignal.timeout(5000),
        });
        testOk = res.ok;
        message = res.ok
          ? "Mensagem de teste enviada ao Slack com sucesso."
          : `Slack retornou HTTP ${res.status}.`;
      }
    } catch (e) {
      testOk = false;
      message = e instanceof Error ? e.message : "Erro de conexão.";
    }

    await database.integration.update({
      where: { tenantId_type: { tenantId: ctx.tenantId, type } },
      data: { status: testOk ? "ACTIVE" : "ERROR" },
    });

    revalidatePath("/settings/integrations");
    return { ok: testOk, message };
  });
}

/**
 * Deletes an integration by id. Requires ADMIN role.
 */
export async function deleteIntegration(
  id: string
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN"], ctx);

    const row = await database.integration.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!row) throw new Error("Integração não encontrada.");

    await database.integration.delete({ where: { id } });

    revalidatePath("/settings/integrations");
    return { id };
  });
}

// TODO: Migrate config tokens/passwords from plain text DB storage to a secrets
// manager (e.g., AWS Secrets Manager, Doppler) — tracked as tech debt.
