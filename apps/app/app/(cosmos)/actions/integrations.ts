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
  linearImportTeamIssues,
  linearTestConnection,
} from "../../actions/integrations/connectors/linear";
import {
  type LinearScope,
  lerScopes,
} from "../../actions/integrations/linear-scopes";
import { createEpic } from "./kanban";

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

/**
 * Project real do Linear (COS-85/COS-91): aninhado dentro de cada
 * `LinearTeamOption` em vez de uma descoberta própria feita depois que o
 * time é escolhido. Ver o comentário sobre `linearDiscoverTeams` no conector
 * (`connectors/linear.ts`) para o porquê — resumo: a versão de duas
 * chamadas tinha uma corrida real, e trazer os projects já dentro do time
 * elimina a classe inteira do bug.
 */
export type LinearProjectOption = { id: string; name: string };

export type LinearTeamOption = {
  id: string;
  name: string;
  key: string;
  /** Projects do time no Linear — um ART de produto conecta num deles. */
  projects: LinearProjectOption[];
};

export type ImportCounts = {
  created: number;
  updated: number;
  skipped: number;
  /** Features do import antigo que viraram Story neste sync. */
  reclassified: number;
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
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        key: t.key,
        projects: t.projects.map((p) => ({ id: p.id, name: p.name })),
      })),
    };
  });
}

export type LinearImportPreview = {
  /** Issues com sub-issues — viram Feature no import. */
  features: number;
  /** Sub-issues — viram Story linkada na Feature do parent. */
  comSub: number;
  /** Issues sem hierarquia — viram Story sem feature. */
  soltas: number;
};

const AnalyzeLinearImportSchema = z.object({
  apiKey: z.string().trim().min(8),
  linearTeamId: z.string().min(1),
  /** Projects marcados no modal. Vazio = o time inteiro. */
  linearProjectIds: z.array(z.string().min(1)).optional(),
});

/**
 * Prévia da estrutura do import: quantas issues do time (ou do project)
 * viram Feature, Story linkada e Story solta. Não grava nada — existe para
 * a segunda etapa do modal mostrar o que o import vai fazer antes de fazer.
 */
export async function analyzeLinearImport(
  input: z.input<typeof AnalyzeLinearImportSchema>
): Promise<Result<LinearImportPreview>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);
    const { apiKey, linearTeamId, linearProjectIds } =
      AnalyzeLinearImportSchema.parse(input);

    // Uma passada só, mesmo com vários projects marcados: o conector já
    // pagina o time inteiro e filtra localmente, então pedir por project
    // seria reler o time uma vez por produto.
    const lote = [];
    let cursor: string | undefined;
    do {
      const { issues, nextCursor } = await linearImportTeamIssues(
        apiKey,
        linearTeamId,
        cursor
      );
      lote.push(
        ...(linearProjectIds && linearProjectIds.length > 0
          ? issues.filter((i) => linearProjectIds.includes(i.project?.id ?? ""))
          : issues)
      );
      cursor = nextCursor ?? undefined;
    } while (cursor);

    const parentIds = new Set(
      lote.map((i) => i.parent?.id).filter((id): id is string => Boolean(id))
    );
    let features = 0;
    let comSub = 0;
    let soltas = 0;
    for (const issue of lote) {
      if (parentIds.has(issue.id)) {
        features += 1;
      } else if (issue.parent) {
        comSub += 1;
      } else {
        soltas += 1;
      }
    }
    return { features, comSub, soltas };
  });
}

/** Um recorte escolhido no modal: time, project opcional e destino. */
const LinearScopeInputSchema = z.object({
  linearTeamId: z.string().min(1),
  /** Project real do Linear. Ausente = o time inteiro. */
  linearProjectId: z.string().min(1).optional(),
  /** Nome do project, usado no épico criado e no rótulo da tela. */
  label: z.string().min(1).max(120).trim().optional(),
  /** Épico já existente que adota as features deste recorte. Sem ele e sem
   *  `criarEpico`, as features nascem órfãs — e o Cosmos é épico-cêntrico:
   *  feature sem épico não aparece em tela nenhuma. */
  epicId: z.string().cuid().optional(),
  /** Cria um épico com o nome do project e usa ele como destino. Ignorado
   *  quando `epicId` vem preenchido. */
  criarEpico: z.boolean().default(false),
});

const ConnectLinearSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  apiKey: z.string().trim().min(8),
  /** Recortes do Linear que esta integração acompanha. A credencial é da
   *  conta, então uma integração cobre vários projects — ver o comentário de
   *  `linear-scopes.ts` para o que o modelo antigo (um card por project)
   *  quebrava no webhook. */
  scopes: z.array(LinearScopeInputSchema).min(1),
  /** Importa as issues dos recortes logo depois de conectar. */
  importNow: z.boolean().default(false),
});

/**
 * Roda o import de cada recorte e soma os contadores.
 *
 * Um recorte que falha não derruba os outros: com quatro produtos numa
 * integração, um project que o Linear recusa deixaria os três restantes sem
 * sincronizar. A falha vira `skipped`, que é o contador que a tela já mostra.
 */
async function importarScopes(
  integrationId: string,
  scopes: LinearScope[]
): Promise<ImportCounts> {
  const total: ImportCounts = {
    created: 0,
    updated: 0,
    skipped: 0,
    reclassified: 0,
  };
  for (const scope of scopes) {
    const snapshot = await runImportSnapshot({
      integrationId,
      projectId: scope.linearTeamId,
      targetType: "feature",
      ...(scope.epicId ? { epicId: scope.epicId } : {}),
      ...(scope.linearProjectId
        ? { linearProjectId: scope.linearProjectId }
        : {}),
    });
    if (!snapshot.ok) {
      total.skipped += 1;
      continue;
    }
    // `?? 0` porque um contador ausente somaria NaN, e NaN atravessaria o
    // toast até a tela como "NaN reclassificadas" em vez de estourar.
    total.created += snapshot.data.created ?? 0;
    total.updated += snapshot.data.updated ?? 0;
    total.skipped += snapshot.data.skipped ?? 0;
    total.reclassified += snapshot.data.reclassified ?? 0;
  }
  return total;
}

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

    // Cada recorte ganha o épico que vai adotar as features dele. Criar aqui,
    // e não antes no Kanban, é o que permite marcar quatro produtos de uma vez
    // sem sair da tela para preparar quatro épicos à mão.
    const scopes: LinearScope[] = [];
    for (const s of parsed.scopes) {
      let epicId = s.epicId;
      if (!epicId && s.criarEpico) {
        const epico = await createEpic({
          title: s.label ?? parsed.name,
          column: "funnel",
        });
        if (!epico.ok) {
          throw new Error(epico.error);
        }
        epicId = epico.data.id;
      }
      scopes.push({
        linearTeamId: s.linearTeamId,
        ...(s.linearProjectId ? { linearProjectId: s.linearProjectId } : {}),
        ...(epicId ? { epicId } : {}),
        ...(s.label ? { label: s.label } : {}),
      });
    }

    // O mapping é gravado aqui, antes de importar: runImportSnapshot regrava
    // o blob com o input de UMA execução, e deixá-lo mandar apagaria os
    // outros recortes a cada import.
    await database.integration.update({
      where: { id: created.data.id },
      data: { mapping: { scopes } },
    });

    let imported: ImportCounts | null = null;
    if (parsed.importNow) {
      imported = await importarScopes(created.data.id, scopes);
      // runImportSnapshot sobrescreveu o mapping com o último recorte.
      await database.integration.update({
        where: { id: created.data.id },
        data: { mapping: { scopes } },
      });
    }

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "integration",
      entityId: created.data.id,
      diff: {
        source: "linear",
        name: parsed.name,
        scopes: scopes.map((s) => s.linearProjectId ?? s.linearTeamId),
      },
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

    // Atravessa os dois formatos de mapping — integração antiga (um project
    // por card) ainda sincroniza enquanto não é fundida.
    const scopes = lerScopes(existing.mapping);
    if (scopes.length === 0) {
      throw new Error(
        "Integração sem time do Linear mapeado — reconecte escolhendo o time."
      );
    }

    const counts = await importarScopes(id, scopes);
    // runImportSnapshot regrava o mapping com o input do último recorte; sem
    // isto o segundo sync encontraria só ele e largaria os outros produtos.
    await database.integration.update({
      where: { id },
      data: { mapping: { scopes } },
    });

    revalidatePath("/cosmos/integrations");
    return counts;
  });
}

/**
 * Funde as integrações do Linear do tenant em uma só.
 *
 * O modelo antigo criava uma Integration por project, o que além de encher a
 * tela quebrava o webhook: a rota escolhe a integração com
 * `findFirst({tenantId, source:"linear"})`, então com N integrações todo
 * evento caía na primeira e era filtrado pelo project dela — as issues dos
 * outros produtos eram descartadas como FILTERED.
 *
 * A sobrevivente é a mais antiga (a que a rota já vinha escolhendo, então os
 * eventos em voo continuam achando o mesmo id). Os escopos das demais são
 * absorvidos, e os filhos que apontam para elas — SyncLog, LinearSyncEvent,
 * WebhookDlq — são re-apontados antes de sumirem: `LinearSyncEvent` guarda
 * `integrationId` como coluna solta, sem FK, então apagar sem re-apontar
 * deixaria histórico órfão em vez de erro.
 */
export async function fundirIntegracoesLinear(): Promise<
  Result<{ id: string; absorvidas: number; scopes: number }>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);

    const integracoes = await database.integration.findMany({
      where: { tenantId: ctx.tenantId, source: "linear" },
      orderBy: { createdAt: "asc" },
      select: { id: true, mapping: true, name: true },
    });
    if (integracoes.length === 0) {
      throw new Error("Nenhuma integração do Linear para fundir.");
    }

    const principal = integracoes[0];
    if (!principal) {
      throw new Error("Nenhuma integração do Linear para fundir.");
    }
    const extras = integracoes.slice(1);

    // Dedup por recorte: reconectar o mesmo project duas vezes não pode
    // gerar dois escopos iguais, que dobrariam cada import.
    const porChave = new Map<string, LinearScope>();
    for (const i of integracoes) {
      for (const s of lerScopes(i.mapping)) {
        porChave.set(`${s.linearTeamId}:${s.linearProjectId ?? ""}`, s);
      }
    }
    const scopes = [...porChave.values()];

    for (const extra of extras) {
      await database.syncLog.updateMany({
        where: { integrationId: extra.id },
        data: { integrationId: principal.id },
      });
      await database.linearSyncEvent.updateMany({
        where: { tenantId: ctx.tenantId, integrationId: extra.id },
        data: { integrationId: principal.id },
      });
      await database.webhookDlq.updateMany({
        where: { tenantId: ctx.tenantId, integrationId: extra.id },
        data: { integrationId: principal.id },
      });
      await database.integration.delete({ where: { id: extra.id } });
    }

    await database.integration.update({
      where: { id: principal.id },
      data: { name: "Linear", mapping: { scopes } },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "updated",
      entityType: "integration",
      entityId: principal.id,
      diff: {
        fundidas: extras.map((e) => e.name),
        scopes: scopes.map(
          (s) => s.label ?? s.linearProjectId ?? s.linearTeamId
        ),
      },
    });
    revalidatePath("/cosmos/integrations");

    return {
      id: principal.id,
      absorvidas: extras.length,
      scopes: scopes.length,
    };
  });
}
