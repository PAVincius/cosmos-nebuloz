import type { WorkForm, withTenantDb } from "@repo/database";
import { ScaffoldRuleError } from "@/lib/scaffold/errors";

// X-01 — registro único de processo (ProcessRegistry).
//
// Junta os ids que os quatro produtos dão ao mesmo processo: gap (Meridian),
// trilha (Scaffold), iniciativa (Signal) e caso de uso (Charter). SEM FK cruzada
// (mapa de fronteiras: cada produto é dono da sua entidade), então o banco só
// garante o tenant e ao menos um id. Quem grava confere cada id no MESMO tenant,
// dentro do `withTenantDb`, senão o registro poderia apontar para linha de outro
// tenant.
//
// Cada id de produto aparece em no máximo um registro por tenant (índice único).
// Por isso a operação é "ligar": procura o registro que já tem algum dos ids e
// completa o que falta; cria se não há; recusa em vez de fundir em silêncio
// quando os ids estão em registros diferentes ou colidem no mesmo produto.

type Db = Parameters<Parameters<typeof withTenantDb>[1]>[0];

export type ProcessLinkInput = {
  tenantId: string;
  name: string;
  workForm?: WorkForm | null;
  meridianGapId?: string | null;
  scaffoldTrackId?: string | null;
  signalInitiativeId?: string | null;
  charterUseCaseId?: string | null;
};

const SLOTS = [
  "meridianGapId",
  "scaffoldTrackId",
  "signalInitiativeId",
  "charterUseCaseId",
] as const;
type Slot = (typeof SLOTS)[number];

type Row = {
  id: string;
  workForm: WorkForm | null;
} & Record<Slot, string | null>;

function providedSlots(input: ProcessLinkInput): [Slot, string][] {
  return SLOTS.flatMap((slot) => {
    const value = input[slot];
    return value ? ([[slot, value]] as [Slot, string][]) : [];
  });
}

/** Cada id existe neste tenant? Um `findFirst` por produto, com o tenant no where. */
async function assertTargetsExist(
  db: Db,
  tenantId: string,
  slots: [Slot, string][]
): Promise<void> {
  const finders: Record<Slot, (id: string) => Promise<unknown>> = {
    meridianGapId: (id) =>
      db.meridianGap.findFirst({
        where: { id, tenantId },
        select: { id: true },
      }),
    scaffoldTrackId: (id) =>
      db.scaffoldTrack.findFirst({
        where: { id, tenantId },
        select: { id: true },
      }),
    signalInitiativeId: (id) =>
      db.signalInitiative.findFirst({
        where: { id, tenantId },
        select: { id: true },
      }),
    charterUseCaseId: (id) =>
      db.charterUseCase.findFirst({
        where: { id, tenantId },
        select: { id: true },
      }),
  };
  for (const [slot, id] of slots) {
    if (!(await finders[slot](id))) {
      throw new ScaffoldRuleError("PROCESS_LINK_TARGET_NOT_FOUND", [
        `${slot}: ${id}`,
      ]);
    }
  }
}

async function findRows(
  db: Db,
  tenantId: string,
  slots: [Slot, string][]
): Promise<Row[]> {
  return (await db.processRegistry.findMany({
    where: {
      tenantId,
      OR: slots.map(([slot, id]) => ({ [slot]: id })),
    },
    select: {
      id: true,
      workForm: true,
      meridianGapId: true,
      scaffoldTrackId: true,
      signalInitiativeId: true,
      charterUseCaseId: true,
    },
  })) as Row[];
}

/** Completa um registro existente sem sobrescrever: slot já preenchido com OUTRO
 *  valor é conflito. */
async function mergeInto(
  db: Db,
  input: ProcessLinkInput,
  row: Row,
  slots: [Slot, string][]
): Promise<{ id: string; created: boolean }> {
  const data: Record<string, unknown> = {};
  for (const [slot, id] of slots) {
    if (row[slot] && row[slot] !== id) {
      throw new ScaffoldRuleError("PROCESS_LINK_CONFLICT", [
        `${slot}: ${row[slot]} ≠ ${id}`,
      ]);
    }
    if (!row[slot]) {
      data[slot] = id;
    }
  }
  if (input.workForm && !row.workForm) {
    data.workForm = input.workForm;
  }
  if (Object.keys(data).length > 0) {
    await db.processRegistry.updateMany({
      where: { id: row.id, tenantId: input.tenantId },
      data,
    });
  }
  return { id: row.id, created: false };
}

export async function upsertProcessRegistry(
  db: Db,
  input: ProcessLinkInput
): Promise<{ id: string; created: boolean }> {
  const slots = providedSlots(input);
  if (slots.length === 0) {
    throw new ScaffoldRuleError("PROCESS_LINK_EMPTY");
  }
  await assertTargetsExist(db, input.tenantId, slots);

  const existing = await findRows(db, input.tenantId, slots);
  if (existing.length > 1) {
    throw new ScaffoldRuleError(
      "PROCESS_LINK_CONFLICT",
      existing.map((r) => r.id)
    );
  }
  if (existing.length === 1) {
    return mergeInto(db, input, existing[0], slots);
  }

  // INSERT ... ON CONFLICT DO NOTHING: dentro do `withTenantDb` (transação), a
  // violação de unicidade aborta a transação inteira.
  const inserted = await db.processRegistry.createMany({
    data: [
      {
        tenantId: input.tenantId,
        name: input.name,
        workForm: input.workForm ?? null,
        ...Object.fromEntries(slots),
      },
    ],
    skipDuplicates: true,
  });
  const rows = await findRows(db, input.tenantId, slots);
  if (rows.length !== 1) {
    throw new ScaffoldRuleError(
      "PROCESS_LINK_CONFLICT",
      rows.map((r) => r.id)
    );
  }
  if (inserted.count === 1) {
    return { id: rows[0].id, created: true };
  }
  // Outro processo criou o registro entre a consulta e o insert.
  return mergeInto(db, input, rows[0], slots);
}
