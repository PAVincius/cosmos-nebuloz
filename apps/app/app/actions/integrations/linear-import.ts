"use server";

import {
  type MemberRole,
  requireRole,
  requireTenantSession,
} from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { err, ok, type Result } from "../_base";
import {
  linearImportTeamIssues,
  linearStateToStatus,
} from "./connectors/linear";

// ─── Types ────────────────────────────────────────────────────────────────────

// `tenantId` não entra aqui de propósito: ele vem da sessão, nunca do cliente.
// Server action é endpoint POST público — quem monta a chamada escolheria o
// tenant de destino. O mesmo vale para `runImportSnapshot` em ./index.ts.
export type ImportInput = {
  apiKey: string;
  selectedTeamIds: string[];
  piPlanId?: string;
};

export type PreviewItem = {
  linearId: string;
  title: string;
  url: string;
  cosmosType: "Feature";
  statusId: string;
  alreadySynced: boolean;
  teamName: string;
  isChild: boolean;
};

export type DryRunResult = {
  preview: PreviewItem[];
  totalIssues: number;
  alreadySyncedCount: number;
};

export type ExecuteResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

const IMPORT_ROLES = ["ADMIN", "STE", "RTE"] as MemberRole[];

// ─── Dry-run ─────────────────────────────────────────────────────────────────

export async function linearDryRun(
  input: ImportInput
): Promise<Result<DryRunResult>> {
  try {
    const ctx = await requireTenantSession(await headers());
    requireRole(IMPORT_ROLES, ctx);

    const preview: PreviewItem[] = [];

    for (const teamId of input.selectedTeamIds) {
      let cursor: string | null = null;

      do {
        const { issues, nextCursor } = await linearImportTeamIssues(
          input.apiKey,
          teamId,
          cursor ?? undefined
        );

        for (const issue of issues) {
          const existing = await database.linearSync.findUnique({
            where: {
              tenantId_linearId_linearType: {
                tenantId: ctx.tenantId,
                linearId: issue.id,
                linearType: "issue",
              },
            },
          });

          preview.push({
            linearId: issue.id,
            title: issue.title,
            url: issue.url,
            cosmosType: "Feature",
            statusId: linearStateToStatus(issue.state.type, issue.state.name),
            alreadySynced: !!existing,
            teamName: issue.team.name,
            isChild: !!issue.parent,
          });
        }

        cursor = nextCursor;
      } while (cursor);
    }

    const alreadySyncedCount = preview.filter((p) => p.alreadySynced).length;

    return ok({
      preview,
      totalIssues: preview.length,
      alreadySyncedCount,
    });
  } catch (e) {
    return err(
      e instanceof Error ? e.message : "Erro ao pré-visualizar o import"
    );
  }
}

// ─── Execute import ───────────────────────────────────────────────────────────

export async function linearExecuteImport(
  input: ImportInput & { previewItems: PreviewItem[] }
): Promise<Result<ExecuteResult>> {
  try {
    const ctx = await requireTenantSession(await headers());
    requireRole(IMPORT_ROLES, ctx);

    // `piPlanId` chega do cliente: sem esta checagem daria para pendurar as
    // Features importadas no PI de outro tenant.
    if (input.piPlanId) {
      const piPlan = await database.pIPlan.findFirst({
        where: { id: input.piPlanId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!piPlan) {
        return err("PI Plan não encontrado");
      }
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of input.previewItems) {
      if (item.alreadySynced) {
        skipped += 1;
        continue;
      }

      try {
        const created = await database.feature.create({
          data: {
            tenantId: ctx.tenantId,
            title: item.title,
            statusId: item.statusId,
            externalId: item.linearId,
            externalSource: "linear",
            externalUrl: item.url,
            ...(input.piPlanId ? { piPlanId: input.piPlanId } : {}),
          },
          select: { id: true },
        });

        await database.linearSync.create({
          data: {
            tenantId: ctx.tenantId,
            linearId: item.linearId,
            linearType: "issue",
            cosmosId: created.id,
            cosmosType: "Feature",
          },
        });

        imported += 1;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        errors.push(`[${item.linearId}] ${item.title}: ${message}`);
      }
    }

    return ok({ imported, skipped, errors });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao executar o import");
  }
}
