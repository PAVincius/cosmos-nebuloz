"use server";

import { randomBytes } from "node:crypto";
import {
  type MemberRole,
  requireRole,
  requireTenantSession,
} from "@repo/auth/server";
import { database } from "@repo/database";
import { encryptConfigSecrets } from "@repo/security/encrypt";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { err, ok, type Result } from "../_base";
import { logAudit } from "../audit";
import {
  buildFirefliesWebhookUrl,
  firefliesTestConnection,
} from "../integrations/connectors/fireflies";

const ConnectFirefliesSchema = z.object({
  name: z.string().min(1).max(100).default("Fireflies"),
  apiKey: z.string().min(1, "apiKey obrigatório"),
});

export type MeetingIntegrationRow = {
  id: string;
  provider: string;
  name: string;
  status: string;
  webhookUrl: string;
  lastEventAt: Date | null;
  createdAt: Date;
};

const ADMIN_ROLES = ["ADMIN", "STE", "RTE"] as MemberRole[];

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3012";
}

export async function listMeetingIntegrations(): Promise<
  Result<MeetingIntegrationRow[]>
> {
  try {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.meetingIntegration.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        provider: true,
        name: true,
        status: true,
        lastEventAt: true,
        createdAt: true,
      },
    });
    const base = appBaseUrl();
    return ok(
      rows.map((r) => ({
        ...r,
        webhookUrl: buildFirefliesWebhookUrl(base, r.id),
      }))
    );
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao listar integrações");
  }
}

export async function connectFireflies(
  raw: unknown
): Promise<Result<{ id: string; webhookUrl: string; webhookSecret: string }>> {
  try {
    const ctx = await requireTenantSession(await headers());
    requireRole(ADMIN_ROLES, ctx);

    const input = ConnectFirefliesSchema.parse(raw);

    const conn = await firefliesTestConnection(input.apiKey);
    if (!conn.ok) {
      return err(conn.error ?? "Falha ao validar API key do Fireflies");
    }

    const webhookSecret = randomBytes(32).toString("hex");

    const created = await database.meetingIntegration.create({
      data: {
        tenantId: ctx.tenantId,
        provider: "fireflies",
        name: input.name,
        config: encryptConfigSecrets({ apiKey: input.apiKey }) as Record<
          string,
          string
        >,
        webhookSecret,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "INTEGRATION",
      entityId: created.id,
      diff: { provider: "fireflies" },
    }).catch(() => null);

    revalidatePath("/settings/integrations/meeting");

    return ok({
      id: created.id,
      webhookUrl: buildFirefliesWebhookUrl(appBaseUrl(), created.id),
      webhookSecret,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao conectar Fireflies");
  }
}

export async function disconnectMeetingIntegration(
  raw: unknown
): Promise<Result<{ id: string }>> {
  try {
    const ctx = await requireTenantSession(await headers());
    requireRole(ADMIN_ROLES, ctx);

    const { id } = z.object({ id: z.string().min(1) }).parse(raw);

    const existing = await database.meetingIntegration.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!existing) {
      return err("Integração não encontrada");
    }

    await database.meetingIntegration.update({
      where: { id: existing.id },
      data: { status: "PAUSED" },
    });

    logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "updated",
      entityType: "INTEGRATION",
      entityId: existing.id,
      diff: { provider: "fireflies", status: "PAUSED" },
    }).catch(() => null);

    revalidatePath("/settings/integrations/meeting");

    return ok({ id: existing.id });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao desconectar");
  }
}
