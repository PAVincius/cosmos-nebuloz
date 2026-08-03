"use server";

// integrations.ts — tela /cosmos/integrations (story-060).
//
// Ciclo de vida do FR-018 (`docs/srd-epic-007.md:201`): a integração tem
// estado PENDING/ACTIVE/ERROR/PAUSED/REVOKED. `PAUSED` já era LIDO pelas
// rotas de ingestão (`app/api/webhooks/linear|github/route.ts`), que mandam
// o evento para a dead-letter queue e devolvem 200 sem tocar em dado do
// Cosmos — exatamente o AC do FR-018. Faltava produtor: nenhuma action deste
// app escrevia `PAUSED`, então o caminho estava escrito e inalcançável.
//
// SEGURANÇA: `config` (apiKey/token) e `mapping` nunca são selecionados para
// exibição. O teste de conexão decifra a credencial DENTRO desta action, só
// para passar ao conector — nada dela entra na resposta nem na auditoria, e
// a tela nunca pede nem exibe segredo (NFR `docs/srd-epic-007.md:372`).
//
// Fora de escopo, com lacuna registrada no nó: conectar (exige entrada de
// credencial ou OAuth — outro subsistema, integrations-vault.prisma) e
// revogar/apagar (Integration tem billingEntries/billingSyncCursor com
// onDelete: Cascade; apagar levaria o histórico de custo do FinOps junto).
import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { decryptConfigSecrets } from "@repo/security/encrypt";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit/log-audit";
import { githubTestConnection } from "../../actions/integrations/connectors/github";
import { linearTestConnection } from "../../actions/integrations/connectors/linear";

export type SyncRunView = {
  id: string;
  type: string;
  status: string;
  itemsCreated: number;
  itemsUpdated: number;
  itemsSkipped: number;
  createdAt: string;
};

export type IntegrationView = {
  id: string;
  source: string;
  name: string;
  status: string;
  lastSyncAt: string | null;
  /** Última execução registrada em SyncLog, ou null quando nunca sincronizou.
   *  FR-020: SyncLog é imutável e é a única fonte de saúde de sincronização —
   *  contador zerado seria indistinguível de "rodou e não trouxe nada". */
  lastSync: SyncRunView | null;
};

export async function listIntegrations(): Promise<Result<IntegrationView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.integration.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { name: "asc" },
      // SECURITY: never select `config` or `mapping` — they hold API
      // keys/tokens and internal field mappings, not for client display.
      select: {
        id: true,
        source: true,
        name: true,
        status: true,
        lastSyncAt: true,
        syncLogs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            type: true,
            status: true,
            itemsCreated: true,
            itemsUpdated: true,
            itemsSkipped: true,
            createdAt: true,
          },
        },
      },
    });
    return rows.map((i) => {
      const last = i.syncLogs.at(0);
      return {
        id: i.id,
        source: i.source,
        name: i.name,
        status: i.status,
        lastSyncAt: i.lastSyncAt?.toISOString() ?? null,
        lastSync: last
          ? {
              id: last.id,
              type: last.type,
              status: last.status,
              itemsCreated: last.itemsCreated,
              itemsUpdated: last.itemsUpdated,
              itemsSkipped: last.itemsSkipped,
              createdAt: last.createdAt.toISOString(),
            }
          : null,
      };
    });
  });
}

// ─── Ciclo de vida: pausar / retomar (FR-018) ──────────────────────────────

const SetIntegrationPausedSchema = z.object({
  id: z.string().cuid(),
  paused: z.boolean(),
});

export async function setIntegrationPaused(
  input: z.input<typeof SetIntegrationPausedSchema>
): Promise<Result<{ id: string; status: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);
    const { id, paused } = SetIntegrationPausedSchema.parse(input);

    const existing = await database.integration.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, source: true, status: true },
    });
    if (!existing) {
      throw new Error("Integração não encontrada.");
    }

    const status = paused ? "PAUSED" : "ACTIVE";
    // Só `status` muda: pausar não é desconectar. config/mapping/lastSyncAt
    // ficam intactos para que retomar devolva a integração como estava.
    const updated = await database.integration.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "status_changed",
      entityType: "integration",
      entityId: updated.id,
      diff: { status, from: existing.status },
    });
    revalidatePath("/cosmos/integrations");
    return { id: updated.id, status: updated.status };
  });
}

// ─── Teste de conexão sobre a credencial já guardada (FR-018) ──────────────

const TestIntegrationSchema = z.object({ id: z.string().cuid() });

/** Credencial esperada por fonte. Só estas duas têm conector de teste no
 *  repo (`app/actions/integrations/connectors/`); as demais fontes existem
 *  no vocabulário de `Integration.source` sem cliente de verificação. */
const CREDENTIAL_FIELD: Record<string, string> = {
  linear: "apiKey",
  github: "token",
};

export async function testIntegrationConnection(
  input: z.input<typeof TestIntegrationSchema>
): Promise<Result<{ id: string; status: string; account: string | null }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);
    const { id } = TestIntegrationSchema.parse(input);

    const existing = await database.integration.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, source: true, status: true, config: true },
    });
    if (!existing) {
      throw new Error("Integração não encontrada.");
    }

    const field = CREDENTIAL_FIELD[existing.source];
    if (!field) {
      throw new Error(
        `Fonte '${existing.source}' não tem teste de conexão implementado.`
      );
    }

    // A credencial só existe como variável local desta action: decifrada
    // aqui, passada ao conector, e nunca devolvida nem auditada.
    const config = decryptConfigSecrets(
      (existing.config ?? {}) as Record<string, unknown>
    );
    const credential = config[field];
    if (typeof credential !== "string" || credential.length === 0) {
      throw new Error(
        "Integração sem credencial configurada — nada a testar. A conexão precisa ser (re)estabelecida fora desta tela."
      );
    }

    const result =
      existing.source === "linear"
        ? await linearTestConnection(credential)
        : await githubTestConnection(credential);

    // Uma integração PAUSED continua PAUSED: testar não é retomar. Quem
    // pausou conteve um estrago em produção, e despausar como efeito
    // colateral de um teste reabriria a ingestão sem decisão humana.
    const nextStatus = result.ok ? "ACTIVE" : "ERROR";
    if (existing.status !== "PAUSED" && existing.status !== nextStatus) {
      await database.integration.update({
        where: { id },
        data: { status: nextStatus },
        select: { id: true },
      });
    }

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "status_changed",
      entityType: "integration",
      entityId: id,
      diff: { test: result.ok ? "ok" : "failed", source: existing.source },
    });
    revalidatePath("/cosmos/integrations");

    if (!result.ok) {
      throw new Error(result.error ?? "Falha na conexão.");
    }
    return {
      id,
      status: existing.status === "PAUSED" ? "PAUSED" : nextStatus,
      account:
        ("name" in result ? result.name : undefined) ??
        ("login" in result ? result.login : undefined) ??
        null,
    };
  });
}
