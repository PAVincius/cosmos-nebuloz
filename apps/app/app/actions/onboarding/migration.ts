"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const SourceSchema = z.enum(["csv", "jira", "azure", "trello"]);

export async function saveMigrationConnection(raw: {
  source: string;
  config: Record<string, unknown>;
}) {
  const ctx = await requireTenantSession(await headers());
  const source = SourceSchema.parse(raw.source);

  const existing = await database.migrationConnection.findFirst({
    where: { tenantId: ctx.tenantId, source },
  });

  if (existing) {
    return database.migrationConnection.update({
      where: { id: existing.id },
      data: {
        config: raw.config as object,
        status: "pending",
        errorMessage: null,
      },
    });
  }

  return database.migrationConnection.create({
    data: {
      tenantId: ctx.tenantId,
      source,
      config: raw.config as object,
      status: "pending",
    },
  });
}

export async function getMigrationConnection(source: string) {
  const ctx = await requireTenantSession(await headers());
  return database.migrationConnection.findFirst({
    where: { tenantId: ctx.tenantId, source },
  });
}

export async function approveMigrationMapping(
  connectionId: string,
  mappingData: unknown
) {
  const ctx = await requireTenantSession(await headers());

  const conn = await database.migrationConnection.findFirst({
    where: { id: connectionId, tenantId: ctx.tenantId },
  });
  if (!conn) throw new Error("Migration connection not found.");

  return database.migrationConnection.update({
    where: { id: connectionId },
    data: { mappingData: mappingData as object },
  });
}

export async function saveMigrationImportReport(
  connectionId: string,
  report: unknown
) {
  const ctx = await requireTenantSession(await headers());

  const conn = await database.migrationConnection.findFirst({
    where: { id: connectionId, tenantId: ctx.tenantId },
  });
  if (!conn) throw new Error("Migration connection not found.");

  const updated = await database.migrationConnection.update({
    where: { id: connectionId },
    data: { importReport: report as object, status: "connected" },
  });

  revalidatePath("/onboarding/migration");
  return updated;
}
