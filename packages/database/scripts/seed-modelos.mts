// seed-modelos.mts — semeia os 5 modelos de medição do Signal e os 5 perfis de
// controle do Charter (o catálogo global, o método da Nebuloz).
// Dado em signal-measure-models.ts e charter-control-profiles.ts.
// Run with: pnpm --filter @repo/database seed:modelos
//
// SÓ INSERE. Nunca faz update, upsert nem delete:
//   • modelo/perfil: cria se não existir para a forma de trabalho;
//   • versão: cria se não existir para o rótulo, com todas as métricas/controles
//     na mesma transação. Versão publicada é imutável (mesma regra de
//     ST-01 do Scaffold), então uma versão que já existe é PULADA, nunca
//     atualizada. Rodar duas vezes não muda nada.
// Mudar o conteúdo = novo rótulo de versão no arquivo de dados.
//
// As tabelas são GLOBAIS (sem tenantId) e têm RLS forçada sem policy: o script
// precisa conectar como `postgres` (o mesmo papel das migrations), como o resto
// do app. Os perfis do Charter entram SEM assinatura (rascunho, CH-PO-01).

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/client";
import {
  CONTROL_PROFILES,
  type ControlProfileSeed,
} from "./charter-control-profiles";
import { MEASURE_MODELS, type MeasureModelSeed } from "./signal-measure-models";

export { CONTROL_PROFILES, MEASURE_MODELS };

export type SeedCounts = { created: number; skipped: number };

/** O que o seed usa do client. Sintaxe de método para o PrismaClient real ser
 *  atribuível; `$transaction` recebe o mesmo formato. */
export type SeedDb = {
  signalMeasureModel: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
  };
  signalMeasureModelVersion: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
  };
  signalMeasureModelMetric: { createMany(args: unknown): Promise<unknown> };
  charterControlProfile: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
  };
  charterControlProfileVersion: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
  };
  charterControlProfileControl: { createMany(args: unknown): Promise<unknown> };
  $transaction<T>(fn: (tx: SeedDb) => Promise<T>): Promise<T>;
};

export async function seedMeasureModel(
  db: SeedDb,
  seed: MeasureModelSeed
): Promise<SeedCounts> {
  const model =
    (await db.signalMeasureModel.findUnique({
      where: { workForm: seed.workForm },
      select: { id: true },
    })) ??
    (await db.signalMeasureModel.create({
      data: { workForm: seed.workForm, name: seed.name },
      select: { id: true },
    }));

  const existing = await db.signalMeasureModelVersion.findUnique({
    where: { modelId_label: { modelId: model.id, label: seed.label } },
    select: { id: true },
  });
  if (existing) {
    return { created: 0, skipped: 1 };
  }

  // Uma transação por versão: versão publicada sem métricas seria um modelo
  // sem primária, e o plano gerado dele não decide veredito nenhum.
  await db.$transaction(async (tx) => {
    const version = await tx.signalMeasureModelVersion.create({
      data: {
        modelId: model.id,
        label: seed.label,
        counterfactual: seed.counterfactual,
        sampleWindowWeeks: seed.sampleWindowWeeks,
        sources: seed.sources,
        traps: seed.traps,
        note: seed.note,
        publishedBy: "método Nebuloz (seed)",
      },
      select: { id: true },
    });
    await tx.signalMeasureModelMetric.createMany({
      data: seed.metrics.map((metric, i) => ({
        versionId: version.id,
        seq: i + 1,
        role: metric.role,
        name: metric.name,
        formula: metric.formula,
        direction: metric.direction,
      })),
    });
  });
  return { created: 1, skipped: 0 };
}

export async function seedControlProfile(
  db: SeedDb,
  seed: ControlProfileSeed
): Promise<SeedCounts> {
  const profile =
    (await db.charterControlProfile.findUnique({
      where: { workForm: seed.workForm },
      select: { id: true },
    })) ??
    (await db.charterControlProfile.create({
      data: { workForm: seed.workForm, name: seed.name },
      select: { id: true },
    }));

  const existing = await db.charterControlProfileVersion.findUnique({
    where: { profileId_label: { profileId: profile.id, label: seed.label } },
    select: { id: true },
  });
  if (existing) {
    return { created: 0, skipped: 1 };
  }

  await db.$transaction(async (tx) => {
    // Sem legalSignedBy/securitySignedBy: rascunho até as duas assinaturas.
    const version = await tx.charterControlProfileVersion.create({
      data: {
        profileId: profile.id,
        label: seed.label,
        dominantRisks: seed.dominantRisks,
        decisionRole: seed.decisionRole,
        note: seed.note,
        publishedBy: "método Nebuloz (seed)",
      },
      select: { id: true },
    });
    await tx.charterControlProfileControl.createMany({
      data: seed.controls.map((control, i) => ({
        versionId: version.id,
        seq: i + 1,
        code: control.code,
        name: control.name,
        category: control.category,
        evidence: control.evidence,
        acceptanceCriteria: control.acceptanceCriteria,
        role: control.role,
        cadence: control.cadence,
        minClass: control.minClass,
        dispensable: control.dispensable ?? true,
      })),
    });
  });
  return { created: 1, skipped: 0 };
}

export async function seedAll(db: SeedDb): Promise<void> {
  for (const seed of MEASURE_MODELS) {
    const { created, skipped } = await seedMeasureModel(db, seed);
    console.log(
      `Signal · ${seed.name} (${seed.workForm}) ${seed.label}: ${created} criada(s), ${skipped} já existente(s)`
    );
  }
  for (const seed of CONTROL_PROFILES) {
    const { created, skipped } = await seedControlProfile(db, seed);
    console.log(
      `Charter · ${seed.name} (${seed.workForm}) ${seed.label}: ${created} criada(s), ${skipped} já existente(s)`
    );
  }
}

// Guarda de entrypoint: um teste que importe daqui não pode abrir conexão nem
// escrever no banco por acidente.
const isEntrypoint =
  !!process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (isEntrypoint) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  seedAll(db as unknown as SeedDb)
    .then(() => db.$disconnect())
    .catch(async (err) => {
      console.error(err);
      await db.$disconnect();
      process.exit(1);
    });
}
