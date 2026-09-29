import { database, withTenantDb } from "@repo/database";
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
//
// Idempotência de verdade no banco: Epic (tenantId, originTrackId) e Feature
// (tenantId, originTrackId, originPhase) são únicos, e a criação é INSERT ... ON
// CONFLICT DO NOTHING. Reprocessar o evento, ou duas entregas em corrida, caem
// no "já existe" sem erro.

type ScaffoldGateClosed = ProductEventData<"scaffoldGateClosed">;
type TenantDb = Parameters<Parameters<typeof withTenantDb>[1]>[0];

export type ScaffoldGateResult =
  | { skipped: "cosmos-not-contracted" }
  | {
      epic: "created" | "existing" | "none";
      feature: "created" | "existing" | "none";
    };

/** Fases cuja abertura gera uma feature. */
const FEATURE_TITLE: Partial<Record<string, string>> = {
  PILOT: "Piloto",
  SCALE: "Escala",
};

async function ensureEpic(
  db: TenantDb,
  data: ScaffoldGateClosed
): Promise<{ id: string; created: boolean }> {
  const where = {
    tenantId_originTrackId: {
      tenantId: data.tenantId,
      originTrackId: data.trackId,
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
      businessCase: { trackId: data.trackId },
    },
    orderBy: { signedAt: "desc" },
    select: { note: true },
  });

  // createMany + skipDuplicates vira INSERT ... ON CONFLICT DO NOTHING. Não usar
  // create + captura de P2002: dentro do `withTenantDb` (uma transação), a
  // violação de unicidade aborta a transação no Postgres e o que vier depois
  // falha com "current transaction is aborted" — provado contra o banco real
  // com 5 entregas em corrida.
  const inserted = await db.epic.createMany({
    data: [
      {
        tenantId: data.tenantId,
        title: `${data.processName} · ${data.trackCode}`,
        lifecycleStatus: "FUNNEL",
        hypothesis: version?.note ?? null,
        originTrackId: data.trackId,
      },
    ],
    skipDuplicates: true,
  });
  const epic = await db.epic.findUnique({ where, select: { id: true } });
  if (!epic) {
    throw new Error(
      `Épico da trilha ${data.trackCode} não encontrado depois do insert.`
    );
  }
  return { id: epic.id, created: inserted.count === 1 };
}

async function ensureFeature(
  db: TenantDb,
  data: ScaffoldGateClosed,
  epicId: string,
  phase: "PILOT" | "SCALE"
): Promise<"created" | "existing"> {
  const where = {
    tenantId_originTrackId_originPhase: {
      tenantId: data.tenantId,
      originTrackId: data.trackId,
      originPhase: phase,
    },
  };
  const found = await db.feature.findUnique({ where, select: { id: true } });
  if (found) {
    return "existing";
  }

  const inserted = await db.feature.createMany({
    data: [
      {
        tenantId: data.tenantId,
        epicId,
        title: `${FEATURE_TITLE[phase]} ${data.trackCode}`,
        originTrackId: data.trackId,
        originPhase: phase,
      },
    ],
    skipDuplicates: true,
  });
  if (inserted.count === 0) {
    // Outra entrega criou entre o find e o insert.
    return "existing";
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
  const cosmos = await database.tenantModule.findFirst({
    where: {
      tenantId: data.tenantId,
      module: "COSMOS",
      status: { in: ["ACTIVE", "TRIAL"] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
  });
  if (!cosmos) {
    return { skipped: "cosmos-not-contracted" };
  }

  const opens =
    data.openedPhase === "PILOT" || data.openedPhase === "SCALE"
      ? data.openedPhase
      : null;
  const makesEpic = data.closedPhase === "ASSESS" || opens !== null;
  if (!makesEpic) {
    return { epic: "none", feature: "none" };
  }

  return await withTenantDb(data.tenantId, async (db) => {
    // Épico primeiro, mesmo se o evento da ASSESS se perdeu: a feature da
    // PILOT/SCALE precisa de onde pendurar.
    const epic = await ensureEpic(db, data);
    const feature = opens
      ? await ensureFeature(db, data, epic.id, opens)
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
