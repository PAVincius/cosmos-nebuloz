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
import {
  createIntegration,
  runImportSnapshot,
} from "../../actions/integrations";
import { githubTestConnection } from "../../actions/integrations/connectors/github";
import {
  linearDiscoverTeams,
  linearTestConnection,
} from "../../actions/integrations/connectors/linear";

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

// ─── Conectar o Linear (fecha a lacuna do modal stub) ──────────────────────
//
// A tela dizia em voz alta que conectar não estava implementado, e estava
// certa: `createIntegration` já cifrava a credencial e ninguém a chamava. O
// que faltava era o caminho de entrada — e ele precisa de três cuidados que
// as actions de leitura desta tela não precisavam ter:
//
//  1. A chave entra por parâmetro e some no fim da action. Nunca volta na
//     resposta, nunca vai para a auditoria e nunca é lida de volta por
//     `listIntegrations` (que não seleciona `config`). Trocar a chave é
//     reconectar.
//  2. Listar os times do Linear valida a credencial ANTES de gravar nada.
//     Gravar primeiro e descobrir depois deixaria uma Integration ACTIVE
//     apontando para uma chave que não autentica.
//  3. Re-sincronizar recebe só o id: o time do Linear vem de `mapping`, lido
//     no servidor. Aceitar `projectId` da tela deixaria um cliente pedir
//     import de um time que este tenant nunca mapeou.

export type LinearTeamOption = { id: string; name: string; key: string };

export type ImportCounts = {
  created: number;
  updated: number;
  skipped: number;
};

// `.trim()` porque a chave chega por colagem, e colagem traz quebra de linha
// e espaço invisível. Sem o trim, o header vai com o lixo junto e o Linear
// devolve 401 — indistinguível de chave revogada para quem está na tela.
const ApiKeySchema = z.object({ apiKey: z.string().trim().min(8) });

export async function discoverLinearTeams(
  input: z.input<typeof ApiKeySchema>
): Promise<Result<{ account: string | null; teams: LinearTeamOption[] }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);
    const { apiKey } = ApiKeySchema.parse(input);

    const test = await linearTestConnection(apiKey);
    if (!test.ok) {
      throw new Error(test.error ?? "Falha na conexão com o Linear.");
    }

    const teams = await linearDiscoverTeams(apiKey);
    return {
      account: test.name ?? null,
      teams: teams.map((t) => ({ id: t.id, name: t.name, key: t.key })),
    };
  });
}

const ConnectLinearSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  apiKey: z.string().trim().min(8),
  linearTeamId: z.string().min(1),
  /** Importa as issues do time logo depois de conectar. */
  importNow: z.boolean().default(false),
  /** Épico que adota as features importadas. Sem ele, elas nascem órfãs — e
   *  o Cosmos é épico-cêntrico: feature sem épico não aparece em tela
   *  nenhuma (epic-tree, program board e getEpicFeatures partem do épico). */
  epicId: z.string().cuid().optional(),
  /** Project real do Linear, para times no plano free que hospedam vários
   *  produtos (ARTs do Cosmos) como projects dentro do mesmo linearTeamId.
   *  Sem ele, o import traz as issues de todos os projects do time. */
  linearProjectId: z.string().min(1).optional(),
});

export async function connectLinearIntegration(
  input: z.input<typeof ConnectLinearSchema>
): Promise<Result<{ id: string; imported: ImportCounts | null }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);
    const parsed = ConnectLinearSchema.parse(input);

    const test = await linearTestConnection(parsed.apiKey);
    if (!test.ok) {
      throw new Error(test.error ?? "Falha na conexão com o Linear.");
    }

    // createIntegration é quem cifra (`encryptConfigSecrets`). Duplicar a
    // escrita aqui duplicaria a cifragem em dois lugares que podem divergir.
    const created = await createIntegration({
      source: "linear",
      name: parsed.name,
      config: { apiKey: parsed.apiKey },
    });
    if (!created.ok) {
      throw new Error(created.error);
    }

    // `mapping` só é gravado por runImportSnapshot, junto do SyncLog da
    // execução. Sem importar agora, a integração fica conectada e sem time
    // mapeado — e é isso que `resyncIntegration` recusa depois, em vez de
    // adivinhar um time.
    let imported: ImportCounts | null = null;
    if (parsed.importNow) {
      const snapshot = await runImportSnapshot({
        integrationId: created.data.id,
        projectId: parsed.linearTeamId,
        targetType: "feature",
        ...(parsed.epicId ? { epicId: parsed.epicId } : {}),
        ...(parsed.linearProjectId
          ? { linearProjectId: parsed.linearProjectId }
          : {}),
      });
      if (!snapshot.ok) {
        throw new Error(snapshot.error);
      }
      imported = snapshot.data;
    }

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "integration",
      entityId: created.data.id,
      diff: { source: "linear", name: parsed.name, team: parsed.linearTeamId },
    });
    revalidatePath("/cosmos/integrations");

    return { id: created.data.id, imported };
  });
}

const ResyncSchema = z.object({ id: z.string().cuid() });

export async function resyncIntegration(
  input: z.input<typeof ResyncSchema>
): Promise<Result<ImportCounts>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);
    const { id } = ResyncSchema.parse(input);

    const existing = await database.integration.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, source: true, status: true, mapping: true },
    });
    if (!existing) {
      throw new Error("Integração não encontrada.");
    }
    if (existing.source !== "linear") {
      throw new Error(
        `Sincronização manual não implementada para '${existing.source}'.`
      );
    }
    // Pausar contém um estrago em produção. Sincronizar como se nada tivesse
    // acontecido reabriria a ingestão sem ninguém decidir retomar.
    if (existing.status === "PAUSED") {
      throw new Error("Integração pausada — retome antes de sincronizar.");
    }

    const mapping = existing.mapping as {
      projectId?: unknown;
      epicId?: unknown;
      piPlanId?: unknown;
      teamId?: unknown;
      linearProjectId?: unknown;
    } | null;
    const projectId = mapping?.projectId;
    if (typeof projectId !== "string" || projectId.length === 0) {
      throw new Error(
        "Integração sem time do Linear mapeado — reconecte escolhendo o time."
      );
    }

    // O mapping inteiro segue junto: runImportSnapshot regrava `mapping` com
    // o input desta chamada, então repassar só o projectId apagaria o épico
    // escolhido na conexão — e o sync seguinte largaria as features órfãs.
    const snapshot = await runImportSnapshot({
      integrationId: id,
      projectId,
      targetType: "feature",
      ...(typeof mapping?.epicId === "string"
        ? { epicId: mapping.epicId }
        : {}),
      ...(typeof mapping?.piPlanId === "string"
        ? { piPlanId: mapping.piPlanId }
        : {}),
      ...(typeof mapping?.teamId === "string"
        ? { teamId: mapping.teamId }
        : {}),
      ...(typeof mapping?.linearProjectId === "string"
        ? { linearProjectId: mapping.linearProjectId }
        : {}),
    });
    if (!snapshot.ok) {
      throw new Error(snapshot.error);
    }

    revalidatePath("/cosmos/integrations");
    return snapshot.data;
  });
}
