"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import {
  decryptConfigSecrets,
  encryptConfigSecrets,
} from "@repo/security/encrypt";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { IntegrationType, type Result, safeAction } from "../_base";
import { type IntegrationPublic, UpsertIntegrationSchema } from "./schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toPublic(row: {
  id: string;
  tenantId: string;
  source: string;
  name: string;
  status: string;
  config: unknown;
  createdAt: Date;
  updatedAt: Date;
}): IntegrationPublic {
  return {
    id: row.id,
    tenantId: row.tenantId,
    type: row.source, // map source → type for backward compat with existing UI
    name: row.name,
    status: row.status,
    configured:
      row.config !== null && Object.keys(row.config as object).length > 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

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
 * Devolve só o shape público. `config` guarda token, PAT e URL de webhook, e
 * uma server action exportada é invocável pelo cliente por qualquer membro do
 * tenant — com ou sem tela que a chame. Descriptografar e devolver aqui era
 * entregar o segredo em claro para quem pedisse. `configured` é o que a UI
 * precisa saber; quem precisa do valor real lê a linha do lado do servidor,
 * como `testIntegration` faz.
 */
export async function getIntegrationByType(
  type: string
): Promise<Result<IntegrationPublic>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    IntegrationType.parse(type);

    const row = await database.integration.findFirst({
      where: { tenantId: ctx.tenantId, source: type },
      orderBy: { createdAt: "desc" },
    });
    if (!row) {
      throw new Error(`Integração '${type}' não encontrada.`);
    }

    return toPublic(row);
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function upsertIntegration(
  raw: unknown
): Promise<Result<IntegrationPublic>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN"], ctx);

    const data = UpsertIntegrationSchema.parse(raw);

    // findFirst + create/update since unique is no longer on (tenantId, source)
    const existing = await database.integration.findFirst({
      where: { tenantId: ctx.tenantId, source: data.type },
    });

    // `Integration.config` guarda token/PAT/webhook: cifrar na escrita é o que
    // o comentário do model manda ("sensitive, store encrypted at app layer").
    // Quem lê para usar o valor decifra — ver `testIntegration` abaixo.
    const config = encryptConfigSecrets(
      data.config as Record<string, unknown>
    ) as Record<string, string>;

    const row = existing
      ? await database.integration.update({
          where: { id: existing.id },
          data: {
            name: data.name,
            config,
            status: "ACTIVE",
          },
        })
      : await database.integration.create({
          data: {
            tenantId: ctx.tenantId,
            source: data.type,
            name: data.name,
            config,
            status: "ACTIVE",
          },
        });

    revalidatePath("/settings/integrations");
    return toPublic(row);
  });
}

export async function testIntegration(
  type: string
): Promise<Result<{ ok: boolean; message: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    IntegrationType.parse(type);

    const row = await database.integration.findFirst({
      where: { tenantId: ctx.tenantId, source: type },
    });
    if (!row) {
      throw new Error(`Integração '${type}' não encontrada.`);
    }

    const config = decryptConfigSecrets(
      (row.config as Record<string, unknown>) ?? {}
    ) as Record<string, string>;
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
          ? "Conexão com Jira estabelecida."
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
          ? "Conexão com GitHub estabelecida."
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
          ? "Conexão com Azure DevOps estabelecida."
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
          ? "Mensagem de teste enviada ao Slack."
          : `Slack retornou HTTP ${res.status}.`;
      }
    } catch (e) {
      testOk = false;
      message = e instanceof Error ? e.message : "Erro de conexão.";
    }

    await database.integration.update({
      where: { id: row.id },
      data: { status: testOk ? "ACTIVE" : "ERROR" },
    });

    revalidatePath("/settings/integrations");
    return { ok: testOk, message };
  });
}

export async function deleteIntegration(
  id: string
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN"], ctx);

    const row = await database.integration.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!row) {
      throw new Error("Integração não encontrada.");
    }

    await database.integration.delete({ where: { id } });

    revalidatePath("/settings/integrations");
    return { id };
  });
}
