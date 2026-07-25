"use server";

import {
  type MemberRole,
  requireRole,
  requireTenantSession,
} from "@repo/auth/server";
import { database } from "@repo/database";
import {
  decryptConfigSecrets,
  encryptConfigSecrets,
} from "@repo/security/encrypt";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { err, ok, type Result } from "../_base";
import { logAudit } from "../audit";
import {
  type GitHubProject,
  githubDiscoverProjects,
  githubImportProjectItems,
  githubStateToStatus,
  githubTestConnection,
} from "./connectors/github";
import {
  type LinearTeam,
  linearDiscoverTeams,
  linearImportTeamIssues,
  linearStateToStatus,
  linearTestConnection,
} from "./connectors/linear";
import {
  CreateIntegrationSchema,
  ImportMappingSchema,
  type IntegrationRow,
  type SyncLogRow,
} from "./schema";

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listIntegrations(): Promise<Result<IntegrationRow[]>> {
  try {
    const ctx = await requireTenantSession(await headers());

    const rows = await database.integration.findMany({
      where: { tenantId: ctx.tenantId },
      include: { syncLogs: { orderBy: { createdAt: "desc" }, take: 5 } },
      orderBy: { createdAt: "desc" },
    });

    return ok(
      rows.map(
        (r) =>
          ({
            id: r.id,
            source: r.source as import("./schema").IntegrationSource,
            name: r.name,
            status: r.status,
            lastSyncAt: r.lastSyncAt,
            createdAt: r.createdAt,
            syncLogs: r.syncLogs.map(
              (l) =>
                ({
                  id: l.id,
                  type: l.type,
                  status: l.status,
                  itemsCreated: l.itemsCreated,
                  itemsUpdated: l.itemsUpdated,
                  itemsSkipped: l.itemsSkipped,
                  errors: l.errors,
                  createdAt: l.createdAt,
                }) satisfies SyncLogRow
            ),
          }) satisfies IntegrationRow
      )
    );
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao listar integrações");
  }
}

// ─── Test connection ──────────────────────────────────────────────────────────

export async function testIntegrationConnection(
  raw: unknown
): Promise<Result<{ name?: string; login?: string }>> {
  try {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"] as MemberRole[], ctx);

    const input = CreateIntegrationSchema.parse(raw);

    if (input.source === "linear") {
      const apiKey = input.config.apiKey ?? "";
      if (!apiKey) {
        return err("apiKey obrigatório para Linear");
      }
      const result = await linearTestConnection(apiKey);
      if (!result.ok) {
        return err(result.error ?? "Falha na conexão");
      }
      return ok({ name: result.name });
    }

    if (input.source === "github") {
      const token = input.config.token ?? "";
      if (!token) {
        return err("token obrigatório para GitHub");
      }
      const result = await githubTestConnection(token);
      if (!result.ok) {
        return err(result.error ?? "Falha na conexão");
      }
      return ok({ login: result.login });
    }

    return err(`Fonte '${input.source}' ainda não suportada`);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro inesperado");
  }
}

// ─── Discover projects ────────────────────────────────────────────────────────

export async function discoverIntegrationProjects(
  raw: unknown
): Promise<Result<{ id: string; name: string; key?: string }[]>> {
  try {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"] as MemberRole[], ctx);

    const input = CreateIntegrationSchema.parse(raw);

    if (input.source === "linear") {
      const teams = await linearDiscoverTeams(input.config.apiKey ?? "");
      return ok(
        teams.map((t: LinearTeam) => ({ id: t.id, name: t.name, key: t.key }))
      );
    }

    if (input.source === "github") {
      const org = input.config.org ?? "";
      if (!org) {
        return err("org obrigatório para GitHub");
      }
      const projects = await githubDiscoverProjects(
        input.config.token ?? "",
        org
      );
      return ok(
        projects.map((p: GitHubProject) => ({ id: p.id, name: p.title }))
      );
    }

    return err(`Fonte '${input.source}' ainda não suportada`);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao descobrir projetos");
  }
}

// ─── Create integration ───────────────────────────────────────────────────────

export async function createIntegration(
  raw: unknown
): Promise<Result<{ id: string }>> {
  try {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"] as MemberRole[], ctx);

    const input = CreateIntegrationSchema.parse(raw);

    const created = await database.integration.create({
      data: {
        tenantId: ctx.tenantId,
        source: input.source,
        name: input.name,
        config: encryptConfigSecrets(
          input.config as Record<string, unknown>
        ) as Record<string, string>,
        status: "ACTIVE",
      },
    });

    logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "INTEGRATION",
      entityId: created.id,
      diff: { source: input.source, name: input.name },
    }).catch(() => null);

    revalidatePath("/integrations");
    return ok({ id: created.id });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao criar integração");
  }
}

// ─── Delete integration ───────────────────────────────────────────────────────

export async function deleteIntegration(id: string): Promise<Result<void>> {
  try {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"] as MemberRole[], ctx);

    await database.integration.findFirstOrThrow({
      where: { id, tenantId: ctx.tenantId },
    });

    await database.integration.delete({ where: { id } });

    logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "deleted",
      entityType: "INTEGRATION",
      entityId: id,
    }).catch(() => null);

    revalidatePath("/integrations");
    return ok(undefined);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao remover integração");
  }
}

// ─── Import snapshot ──────────────────────────────────────────────────────────

export async function runImportSnapshot(raw: unknown): Promise<
  Result<{
    created: number;
    updated: number;
    skipped: number;
  }>
> {
  try {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE", "RTE"] as MemberRole[], ctx);

    const input = ImportMappingSchema.parse(raw);

    const integration = await database.integration.findFirst({
      where: { id: input.integrationId, tenantId: ctx.tenantId },
    });
    if (!integration) {
      return err("Integração não encontrada");
    }

    const config = decryptConfigSecrets(
      integration.config as Record<string, unknown>
    ) as Record<string, string>;
    const source: string = integration.source;

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: unknown[] = [];

    if (source === "linear") {
      let cursor: string | undefined;
      do {
        const { issues, nextCursor } = await linearImportTeamIssues(
          config.apiKey ?? "",
          input.projectId,
          cursor
        );
        cursor = nextCursor ?? undefined;

        for (const issue of issues) {
          try {
            const statusId = linearStateToStatus(issue.state.type);
            const existing = await database.feature.findFirst({
              where: {
                tenantId: ctx.tenantId,
                externalId: issue.id,
                externalSource: "linear",
              },
            });

            const data = {
              tenantId: ctx.tenantId,
              title: issue.title,
              statusId,
              externalId: issue.id,
              externalSource: "linear" as const,
              externalUrl: issue.url,
              storyPoints: issue.estimate ?? 1,
              ...(input.epicId && { epicId: input.epicId }),
              ...(input.piPlanId && { piPlanId: input.piPlanId }),
            };

            if (existing) {
              await database.feature.update({
                where: { id: existing.id },
                data,
              });
              updated += 1;
            } else {
              await database.feature.create({ data });
              created += 1;
            }
          } catch {
            skipped += 1;
          }
        }
      } while (cursor);
    } else if (source === "github") {
      let cursor: string | undefined;
      do {
        const { items, nextCursor } = await githubImportProjectItems(
          config.token ?? "",
          input.projectId,
          cursor
        );
        cursor = nextCursor ?? undefined;

        for (const item of items) {
          if (!item.content || item.type === "DRAFT_ISSUE") {
            skipped += 1;
            continue;
          }
          try {
            const content = item.content;
            const statusId = githubStateToStatus(content.state);
            const externalId = `${item.id}`;
            const existing = await database.feature.findFirst({
              where: {
                tenantId: ctx.tenantId,
                externalId,
                externalSource: "github",
              },
            });

            const data = {
              tenantId: ctx.tenantId,
              title: content.title,
              statusId,
              externalId,
              externalSource: "github" as const,
              externalUrl: content.url,
              storyPoints: 1,
              ...(input.epicId && { epicId: input.epicId }),
              ...(input.piPlanId && { piPlanId: input.piPlanId }),
            };

            if (existing) {
              await database.feature.update({
                where: { id: existing.id },
                data,
              });
              updated += 1;
            } else {
              await database.feature.create({ data });
              created += 1;
            }
          } catch {
            skipped += 1;
          }
        }
      } while (cursor);
    } else {
      return err(`Fonte '${source}' ainda não suportada para import`);
    }

    // Log sync
    await database.syncLog.create({
      data: {
        integrationId: input.integrationId,
        type: "snapshot",
        status: errors.length > 0 ? "partial" : "success",
        itemsCreated: created,
        itemsUpdated: updated,
        itemsSkipped: skipped,
        errors:
          errors.length > 0
            ? (errors as import("@repo/database").Prisma.InputJsonValue)
            : undefined,
      },
    });

    await database.integration.update({
      where: { id: input.integrationId },
      data: { lastSyncAt: new Date(), mapping: input },
    });

    revalidatePath("/integrations");
    revalidatePath("/features");
    return ok({ created, updated, skipped });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao importar");
  }
}
