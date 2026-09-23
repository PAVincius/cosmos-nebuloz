"use server";

import { database } from "@repo/database";
import { mensagemDeErro } from "@/lib/erro-de-integracao";
import { requirePlatformStaff, StaffAuthError } from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Abas Integrações (FR-4.4) e Audit (FR-4.9) do detalhe do tenant.
 *
 * As duas são leitura pura — sem `assertCanWrite`, porque leitura é de todo
 * staff (FR-0.4). Nenhuma migration: `Integration`, `SyncLog` e `AuditLog` já
 * existiam no schema.
 */

async function tenantPorSlug(slug: string) {
  const tenant = await database.tenant.findFirst({
    where: { slug },
    select: { id: true, slug: true, name: true },
  });
  if (!tenant) {
    throw new StaffAuthError("FORBIDDEN", `Nenhum cliente com o slug ${slug}.`);
  }
  return tenant;
}

export type IntegracaoRow = {
  id: string;
  source: string;
  name: string;
  status: string;
  ultimoSync: string | null;
  /** Causa concreta quando há erro; `null` quando está saudável. */
  mensagem: string | null;
};

export async function listTenantIntegrations(
  slug: string
): Promise<Result<IntegracaoRow[]>> {
  return await safeAction(async () => {
    await requirePlatformStaff();
    const tenant = await tenantPorSlug(slug);

    const integracoes = await database.integration.findMany({
      where: { tenantId: tenant.id },
      orderBy: { source: "asc" },
      // NFR-1.7 — `config` e `mapping` NÃO entram no select. Credencial é
      // write-only: depois de salva ela não volta ao cliente. Um findMany sem
      // select devolveria o token dentro de `config` direto para o browser.
      select: {
        id: true,
        source: true,
        name: true,
        status: true,
        lastSyncAt: true,
        syncLogs: {
          where: { status: "error" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { errors: true, createdAt: true },
        },
      },
    });

    return integracoes.map((i) => {
      const comErro = i.status === "ERROR";
      const causa = mensagemDeErro(i.syncLogs[0]?.errors);
      return {
        id: i.id,
        source: i.source,
        name: i.name,
        status: i.status,
        ultimoSync: i.lastSyncAt ? i.lastSyncAt.toISOString() : null,
        // FR-4.4.2 — status sozinho não diz o que consertar. Sem log, admite-se
        // que não há detalhe em vez de inventar uma causa plausível, que
        // mandaria o operador consertar a coisa errada.
        mensagem: comErro
          ? (causa ??
            "Falha registrada sem detalhe no log de sincronização. Rode um novo sync para capturar a causa.")
          : null,
      };
    });
  });
}

export type AuditRow = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  alvo: string | null;
  ator: string | null;
  quando: string;
  diff: unknown;
  /** FR-4.9 — evento de criação diz explicitamente que não tem diff. */
  semDiff: boolean;
};

export async function listTenantAudit(
  slug: string,
  limite = 100
): Promise<Result<AuditRow[]>> {
  return await safeAction(async () => {
    await requirePlatformStaff();
    const tenant = await tenantPorSlug(slug);

    const eventos = await database.auditLog.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: limite,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        diff: true,
        metadata: true,
        createdAt: true,
      },
    });

    return eventos.map((e) => {
      const meta = (e.metadata ?? {}) as {
        target?: string;
        actorName?: string;
      };
      return {
        id: e.id,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        alvo: meta.target ?? null,
        ator: meta.actorName ?? null,
        quando: e.createdAt.toISOString(),
        diff: e.diff ?? null,
        // Afirmação, não ausência silenciosa: linha que não expande sem dizer
        // por quê parece linha quebrada.
        semDiff: e.diff === null || e.diff === undefined,
      };
    });
  });
}
