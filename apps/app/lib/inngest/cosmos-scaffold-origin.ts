import { withTenantDb } from "@repo/database";
import { inngest } from "./client";
import {
  PRODUCT_EVENT_SCHEMAS,
  PRODUCT_EVENTS,
  type ProductEventData,
} from "./product-events";

// X-04 / seção e.1 das decisões do Norte — Scaffold → Cosmos.
//
// O Scaffold NÃO escreve no Cosmos: emite `scaffold/gate.closed` e o Cosmos, dono
// do portfólio, cria ou liga o item (mapa de fronteiras, entidades 6 e 9).
//
//   • Épico: um por trilha, no fechamento do gate da ASSESS, em FUNNEL, com a
//     hipótese do caso de negócio assinado. Não na criação da trilha (poluiria o
//     funil com trilha que morre na ASSESS).
//   • Feature: uma ao abrir a PILOT e outra ao abrir a SCALE, sob o épico
//     ("Piloto TR-104", "Escala TR-104"). A EMBED não gera feature: é mudança de
//     organização, não trabalho de engenharia.
//   • O gate do Scaffold não move o ciclo de vida do épico, e `gate.reopened` não
//     apaga nada: o Cosmos só mostra a fase e decide. Por isso não há função para
//     `scaffold/gate.reopened` aqui — a decisão é manter.
//   • Tenant sem o módulo Cosmos não gera nada (mesma degradação graciosa do
//     SG-05).
//   • `OVERRIDDEN` gera épico e feature igual a `PASSED`. DECISÃO: o override é
//     um fechamento de gate com autor, justificativa e critérios dispensados
//     gravados; a fase seguinte abre do mesmo jeito e o trabalho de engenharia
//     dela existe. O Cosmos não julga o gate do Scaffold. O `outcome` vai para a
//     auditoria do item criado.
//
// O evento é só um AVISO. Nada do que o Cosmos escreve sai dele além dos ids: a
// trilha é relida DENTRO do `withTenantDb` (id e tenant conferidos pela RLS e
// pelo filtro) e o código e o nome do processo vêm do banco. Evento forjado ou
// defasado não põe texto arbitrário no funil de outro tenant; trilha que não
// existe no tenant é no-op. Cada épico e feature criado deixa entrada de
// auditoria, ator "system", com a origem (gateResultId) e o outcome do gate.
//
// Idempotência de verdade no banco: Epic (tenantId, originTrackId) e Feature
// (tenantId, originTrackId, originPhase) são únicos, e a criação é INSERT ... ON
// CONFLICT DO NOTHING. Reprocessar o evento, ou duas entregas em corrida, caem
// no "já existe" sem erro.

type ScaffoldGateClosed = ProductEventData<"scaffoldGateClosed">;
type TenantDb = Parameters<Parameters<typeof withTenantDb>[1]>[0];
type Track = { id: string; code: string; processName: string };

export type ScaffoldGateResult =
  | { skipped: "cosmos-not-contracted" | "track-not-found" }
  | {
      epic: "created" | "existing" | "none";
      feature: "created" | "existing" | "none";
    };

/** Fases cuja abertura gera uma feature. */
const FEATURE_TITLE: Partial<Record<string, string>> = {
  PILOT: "Piloto",
  SCALE: "Escala",
};

/** Auditoria de item criado pelo Cosmos a partir de evento do Scaffold. Ator
 *  "system": não há pessoa no consumidor, e a origem é o resultado do gate. */
async function auditCreated(
  db: TenantDb,
  data: ScaffoldGateClosed,
  track: Track,
  entityType: "epic" | "feature",
  entityId: string,
  target: string
): Promise<void> {
  await db.auditLog.create({
    data: {
      tenantId: data.tenantId,
      userId: null,
      actorId: null,
      actorType: "system",
      action: `cosmos.${entityType}.created_from_scaffold`,
      entityType,
      entityId,
      diff: [["Origem", "—", `${track.code} · ${data.closedPhase}`]],
      metadata: {
        origin: PRODUCT_EVENTS.scaffoldGateClosed,
        gateResultId: data.gateResultId,
        trackId: track.id,
        trackCode: track.code,
        outcome: data.outcome,
        target,
      },
    },
  });
}

async function ensureEpic(
  db: TenantDb,
  data: ScaffoldGateClosed,
  track: Track
): Promise<{ id: string; created: boolean }> {
  const where = {
    tenantId_originTrackId: {
      tenantId: data.tenantId,
      originTrackId: track.id,
    },
  };
  const found = await db.epic.findUnique({ where, select: { id: true } });
  if (found) {
    return { id: found.id, created: false };
  }

  // A hipótese do épico é a nota da versão assinada do caso de negócio.
  const version = await db.scaffoldBusinessCaseVersion.findFirst({
    where: {
      tenantId: data.tenantId,
      signedAt: { not: null },
      businessCase: { trackId: track.id },
    },
    orderBy: { signedAt: "desc" },
    select: { note: true },
  });

  const title = `${track.processName} · ${track.code}`;

  // createMany + skipDuplicates vira INSERT ... ON CONFLICT DO NOTHING. Não usar
  // create + captura de P2002: dentro do `withTenantDb` (uma transação), a
  // violação de unicidade aborta a transação no Postgres e o que vier depois
  // falha com "current transaction is aborted" — provado contra o banco real
  // com 5 entregas em corrida.
  const inserted = await db.epic.createMany({
    data: [
      {
        tenantId: data.tenantId,
        title,
        lifecycleStatus: "FUNNEL",
        hypothesis: version?.note ?? null,
        originTrackId: track.id,
      },
    ],
    skipDuplicates: true,
  });
  const epic = await db.epic.findUnique({ where, select: { id: true } });
  if (!epic) {
    throw new Error(
      `Épico da trilha ${track.code} não encontrado depois do insert.`
    );
  }
  const created = inserted.count === 1;
  if (created) {
    await auditCreated(db, data, track, "epic", epic.id, title);
  }
  return { id: epic.id, created };
}

async function ensureFeature(
  db: TenantDb,
  data: ScaffoldGateClosed,
  track: Track,
  epicId: string,
  phase: "PILOT" | "SCALE"
): Promise<"created" | "existing"> {
  const where = {
    tenantId_originTrackId_originPhase: {
      tenantId: data.tenantId,
      originTrackId: track.id,
      originPhase: phase,
    },
  };
  const found = await db.feature.findUnique({ where, select: { id: true } });
  if (found) {
    return "existing";
  }

  const title = `${FEATURE_TITLE[phase]} ${track.code}`;
  const inserted = await db.feature.createMany({
    data: [
      {
        tenantId: data.tenantId,
        epicId,
        title,
        originTrackId: track.id,
        originPhase: phase,
      },
    ],
    skipDuplicates: true,
  });
  if (inserted.count === 0) {
    // Outra entrega criou entre o find e o insert.
    return "existing";
  }

  const feature = await db.feature.findUnique({ where, select: { id: true } });
  if (feature) {
    await auditCreated(db, data, track, "feature", feature.id, title);
  }

  // Contador desnormalizado do card do épico no kanban.
  await db.epic.update({
    where: { id: epicId },
    data: { featureCount: { increment: 1 } },
  });
  return "created";
}

export async function applyScaffoldGateClosed(
  data: ScaffoldGateClosed
): Promise<ScaffoldGateResult> {
  const opens =
    data.openedPhase === "PILOT" || data.openedPhase === "SCALE"
      ? data.openedPhase
      : null;
  const makesEpic = data.closedPhase === "ASSESS" || opens !== null;
  if (!makesEpic) {
    return { epic: "none", feature: "none" };
  }

  return await withTenantDb(data.tenantId, async (db) => {
    // Dentro do withTenantDb: a leitura do módulo passa pelo mesmo contexto de
    // tenant que as escritas.
    const cosmos = await db.tenantModule.findFirst({
      where: {
        tenantId: data.tenantId,
        module: "COSMOS",
        status: { in: ["ACTIVE", "TRIAL"] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    });
    if (!cosmos) {
      return { skipped: "cosmos-not-contracted" as const };
    }

    // O evento só carrega ids. Trilha, código e nome vêm do banco.
    const track = await db.scaffoldTrack.findFirst({
      where: { id: data.trackId, tenantId: data.tenantId },
      select: { id: true, code: true, processName: true },
    });
    if (!track) {
      return { skipped: "track-not-found" as const };
    }

    // Épico primeiro, mesmo se o evento da ASSESS se perdeu: a feature da
    // PILOT/SCALE precisa de onde pendurar.
    const epic = await ensureEpic(db, data, track);
    const feature = opens
      ? await ensureFeature(db, data, track, epic.id, opens)
      : "none";
    return {
      epic: epic.created ? ("created" as const) : ("existing" as const),
      feature,
    };
  });
}

export const consumeScaffoldGateClosed = inngest.createFunction(
  {
    id: "cosmos-scaffold-gate-consumer",
    triggers: [{ event: PRODUCT_EVENTS.scaffoldGateClosed }],
    // Serializa por trilha: dois fechamentos seguidos da mesma trilha não devem
    // correr a criação do épico ao mesmo tempo.
    concurrency: [{ key: "event.data.trackId", limit: 1 }],
    retries: 3,
  },
  async ({ event, step }) => {
    const data = PRODUCT_EVENT_SCHEMAS.scaffoldGateClosed.parse(event.data);
    return await step.run("aplicar-gate-fechado", () =>
      applyScaffoldGateClosed(data)
    );
  }
);
