"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { err, ok, type Result } from "../_base";
import { logAudit } from "../audit/log-audit";

const SaveSSOConfigSchema = z.object({
  enabled: z.boolean(),
  idpMetadataUrl: z.string().url().optional().or(z.literal("")).nullable(),
  idpEntityId: z.string().max(500).optional().nullable(),
  idpCertificate: z.string().max(10_000).optional().nullable(),
  spEntityId: z.string().max(500).optional().nullable(),
});

export type SSOConfigData = {
  enabled: boolean;
  idpMetadataUrl: string | null;
  idpEntityId: string | null;
  idpCertificate: string | null;
  spEntityId: string | null;
};

export async function getSSOConfig(): Promise<Result<SSOConfigData | null>> {
  try {
    const ctx = await requireTenantSession(await headers());
    const config = await database.tenantSSOConfig.findUnique({
      where: { tenantId: ctx.tenantId },
      select: {
        enabled: true,
        idpMetadataUrl: true,
        idpEntityId: true,
        idpCertificate: true,
        spEntityId: true,
      },
    });
    return ok(config);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao carregar config SSO");
  }
}

export async function saveSSOConfig(
  raw: unknown
): Promise<Result<SSOConfigData>> {
  try {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN"], ctx);

    const input = SaveSSOConfigSchema.parse(raw);

    const config = await database.tenantSSOConfig.upsert({
      where: { tenantId: ctx.tenantId },
      create: {
        tenantId: ctx.tenantId,
        updatedBy: ctx.userId,
        ...input,
        idpMetadataUrl: input.idpMetadataUrl || null,
        idpEntityId: input.idpEntityId || null,
        idpCertificate: input.idpCertificate || null,
        spEntityId: input.spEntityId || null,
      },
      update: {
        ...input,
        idpMetadataUrl: input.idpMetadataUrl || null,
        idpEntityId: input.idpEntityId || null,
        idpCertificate: input.idpCertificate || null,
        spEntityId: input.spEntityId || null,
        updatedBy: ctx.userId,
      },
      select: {
        enabled: true,
        idpMetadataUrl: true,
        idpEntityId: true,
        idpCertificate: true,
        spEntityId: true,
      },
    });

    // Non-sensitive diff only — never idpMetadataUrl/idpEntityId/idpCertificate.
    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "updated",
      entityType: "TenantSSOConfig",
      entityId: ctx.tenantId,
      diff: { enabled: input.enabled },
    });

    revalidatePath("/settings/sso");
    return ok(config);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao salvar config SSO");
  }
}
