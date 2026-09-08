import { database } from "@repo/database";
import {
  DEFAULT_LINEAR_FIELD_POLICY,
  mapLinearStatusToCosmos,
  resolveField,
} from "@/lib/integrations/merge-policy";
import { upsertLinearMapping } from "./sync-mapping";

export type LinearWebhookPayload = {
  action: "create" | "update" | "remove";
  type: "Issue" | "Project" | "Cycle";
  webhookId?: string;
  data: {
    id: string;
    title?: string;
    description?: string;
    state?: { name: string };
    assignee?: { id: string } | null;
    cycle?: { id: string } | null;
    updatedAt?: string;
    team?: { id: string };
    project?: { id: string };
  };
  organizationId?: string;
};

export type HandleLinearWebhookOptions = {
  // Projects do Linear que esta integração acompanha — times no plano free
  // hospedam vários produtos como projects dentro de um único time, e sem
  // este filtro uma issue de outro produto entraria como Story deste ART.
  // Lista porque a credencial é da conta: uma integração cobre N projects
  // (ver `linear-scopes.ts`). Ausente ou vazia = sem filtro.
  linearProjectIds?: string[];
};

export async function handleLinearWebhook(
  tenantId: string,
  integrationId: string,
  payload: LinearWebhookPayload,
  opts?: HandleLinearWebhookOptions
): Promise<void> {
  if (payload.action === "remove") {
    return;
  }
  if (payload.type !== "Issue") {
    return;
  }

  const { data } = payload;
  if (!data.title) {
    return;
  }

  // COS-85: com filtro configurado, só aceita a issue do project mapeado.
  // LIMITAÇÃO CONHECIDA: um webhook real do Linear pode não trazer
  // `data.project` (o formato observado varia; ver linear-full-pull.ts, que
  // já pede `project { id }` na própria página buscada para nunca cair
  // aqui sem essa informação). Quando o filtro está ativo e o payload não
  // traz project, descartamos por segurança em vez de deixar passar sem
  // checar — este código não faz uma segunda chamada de detalhe ao Linear
  // para resolver o project, porque hoje não existe consumidor de webhook
  // ao vivo que precise disso (app/api/webhooks/linear/route.ts só
  // enfileira no Inngest; nenhuma function consome o evento ainda).
  //
  // O descarte não é silencioso: sem rastro, uma issue com project
  // legítimo (não é payload malformado — o Linear simplesmente não
  // mandou o campo, ou a issue está fora do project mapeado) some do
  // sync para sempre sem deixar pista. Grava FILTERED reaproveitando o
  // mecanismo de writeSyncEvent já usado para SKIPPED por conflito de
  // merge, com o motivo distinguindo os dois casos operacionais.
  // A lista vem dos escopos da integração: uma credencial cobre vários
  // projects, e a issue precisa pertencer a um deles.
  const aceitos = opts?.linearProjectIds;
  if (
    aceitos &&
    aceitos.length > 0 &&
    !aceitos.includes(data.project?.id ?? "")
  ) {
    await writeSyncEvent({
      tenantId,
      integrationId,
      direction: "INBOUND",
      source: "LINEAR",
      action: "FILTERED",
      entityType: "Story",
      entityId: data.id,
      externalId: data.id,
      field: "linearProjectId",
      linearValue: `filtro linearProjectId: issue ${data.id} pertence a ${
        data.project?.id ?? "nenhum project"
      }`,
      cosmosValue: aceitos.join(","),
    });
    return;
  }

  const linearUpdatedAt = data.updatedAt
    ? new Date(data.updatedAt)
    : new Date();

  // Find existing Cosmos Story via mapping or externalId
  const mapping = await database.linearSync.findFirst({
    where: { tenantId, linearId: data.id, linearType: "issue" },
  });

  const cosmosStoryId =
    mapping?.cosmosId ??
    (
      await database.story.findFirst({
        where: { tenantId, externalId: data.id, externalSource: "linear" },
        select: { id: true },
      })
    )?.id;

  if (cosmosStoryId) {
    await syncInboundUpdate({
      tenantId,
      integrationId,
      cosmosStoryId,
      data,
      linearUpdatedAt,
    });

    // Backfill mapping if not in mapping table
    if (!mapping) {
      await upsertLinearMapping({
        tenantId,
        linearId: data.id,
        linearType: "issue",
        cosmosId: cosmosStoryId,
        cosmosType: "Story",
      });
    }
    return;
  }

  // New issue — create Story and mapping (AC-005: unmapped lands in holding area)
  let created: { id: string };
  try {
    created = await database.story.create({
      data: {
        tenantId,
        title: data.title,
        description: data.description ?? null,
        externalId: data.id,
        externalSource: "linear",
        status: mapLinearStatusToCosmos(data.state?.name ?? ""),
      },
      select: { id: true },
    });
  } catch (error) {
    // Corrida create-vs-create (cron full pull × webhook ao vivo, limitação
    // registrada no PR #91): outro executor commitou a Story entre o
    // findFirst acima e este create, e o unique (tenantId, externalId,
    // externalSource) derrubou o INSERT perdedor com P2002. A issue já
    // existe no Cosmos — converge para o caminho de update, como se este
    // webhook tivesse chegado um segundo depois.
    if (!isUniqueViolation(error)) {
      throw error;
    }
    const existing = await database.story.findFirst({
      where: { tenantId, externalId: data.id, externalSource: "linear" },
      select: { id: true },
    });
    if (!existing) {
      throw error;
    }
    await syncInboundUpdate({
      tenantId,
      integrationId,
      cosmosStoryId: existing.id,
      data,
      linearUpdatedAt,
    });
    await upsertLinearMapping({
      tenantId,
      linearId: data.id,
      linearType: "issue",
      cosmosId: existing.id,
      cosmosType: "Story",
    });
    return;
  }

  await upsertLinearMapping({
    tenantId,
    linearId: data.id,
    linearType: "issue",
    cosmosId: created.id,
    cosmosType: "Story",
  });

  await writeSyncEvent({
    tenantId,
    integrationId,
    direction: "INBOUND",
    source: "LINEAR",
    action: "CREATED",
    entityType: "Story",
    entityId: created.id,
    externalId: data.id,
  });
}

// ─── helpers ──────────────────────────────────────────────────────────────────

// P2002 = violação de unique constraint. Checagem estrutural de propósito, em
// vez de instanceof PrismaClientKnownRequestError: não amarra este módulo à
// classe de erro do runtime do client (que varia com driver adapter) e vale
// igual sob mock nos testes.
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

type InboundUpdateArgs = {
  tenantId: string;
  integrationId: string;
  cosmosStoryId: string;
  data: LinearWebhookPayload["data"];
  linearUpdatedAt: Date;
};

async function syncInboundUpdate(args: InboundUpdateArgs): Promise<void> {
  const story = await database.story.findFirst({
    where: { id: args.cosmosStoryId, tenantId: args.tenantId },
    select: {
      status: true,
      title: true,
      description: true,
      updatedAt: true,
    },
  });
  if (!story) {
    return;
  }

  const updates: Record<string, unknown> = {};
  const fields: Array<{ field: string; linear: unknown; cosmos: unknown }> = [
    {
      field: "status",
      linear: mapLinearStatusToCosmos(args.data.state?.name ?? ""),
      cosmos: story.status,
    },
    { field: "title", linear: args.data.title, cosmos: story.title },
    {
      field: "description",
      linear: args.data.description ?? null,
      cosmos: story.description,
    },
  ];

  const skipped: Array<{
    field: string;
    linearValue: unknown;
    cosmosValue: unknown;
  }> = [];

  for (const f of fields) {
    if (f.linear === undefined || f.linear === f.cosmos) {
      continue;
    }
    const resolution = resolveField({
      field: f.field,
      linearValue: f.linear,
      cosmosValue: f.cosmos,
      linearUpdatedAt: args.linearUpdatedAt,
      cosmosUpdatedAt: story.updatedAt,
      policy: DEFAULT_LINEAR_FIELD_POLICY,
    });
    if (resolution.action === "APPLY") {
      updates[f.field] = resolution.value;
    } else {
      skipped.push({
        field: f.field,
        linearValue: f.linear,
        cosmosValue: f.cosmos,
      });
    }
  }

  const prevStatus = story.status;
  const newStatus = updates.status as string | undefined;

  if (Object.keys(updates).length > 0) {
    await database.story.updateMany({
      where: { id: args.cosmosStoryId, tenantId: args.tenantId },
      data: updates,
    });

    // Write StateTransitionHistory if status changed (AC-001)
    if (newStatus && newStatus !== prevStatus) {
      await database.stateTransitionHistory.create({
        data: {
          tenantId: args.tenantId,
          entityType: "Story",
          entityId: args.cosmosStoryId,
          fromStatus: prevStatus,
          toStatus: newStatus,
          userId: null,
          externalRef: args.data.id,
        },
      });
    }

    await writeSyncEvent({
      tenantId: args.tenantId,
      integrationId: args.integrationId,
      direction: "INBOUND",
      source: "LINEAR",
      action: "UPDATED",
      entityType: "Story",
      entityId: args.cosmosStoryId,
      externalId: args.data.id,
    });
  }

  // Log SKIPPED fields for conflict resolution UI (AC-008)
  for (const s of skipped) {
    await writeSyncEvent({
      tenantId: args.tenantId,
      integrationId: args.integrationId,
      direction: "INBOUND",
      source: "LINEAR",
      action: "SKIPPED",
      entityType: "Story",
      entityId: args.cosmosStoryId,
      externalId: args.data.id,
      field: s.field,
      linearValue: s.linearValue,
      cosmosValue: s.cosmosValue,
    });
  }
}

type WriteSyncEventArgs = {
  tenantId: string;
  integrationId: string;
  direction: string;
  source: string;
  action: string;
  entityType: string;
  entityId: string;
  externalId?: string;
  field?: string;
  linearValue?: unknown;
  cosmosValue?: unknown;
};

async function writeSyncEvent(args: WriteSyncEventArgs): Promise<void> {
  await database.linearSyncEvent.create({
    data: {
      tenantId: args.tenantId,
      integrationId: args.integrationId,
      direction: args.direction,
      source: args.source,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      externalId: args.externalId ?? null,
      field: args.field ?? null,
      linearValue:
        args.linearValue !== undefined
          ? (args.linearValue as import("@repo/database").Prisma.InputJsonValue)
          : undefined,
      cosmosValue:
        args.cosmosValue !== undefined
          ? (args.cosmosValue as import("@repo/database").Prisma.InputJsonValue)
          : undefined,
    },
  });
}
