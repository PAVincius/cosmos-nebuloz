// seed-scaffold.mts — semeia os templates globais do método Nebuloz.
// Dado (TEMPLATES) mora em scaffold-templates.ts — ver o comentário lá.
// Run with: pnpm exec tsx --env-file=.env scripts/seed-scaffold.mts
//
// GRAVAÇÃO GLOBAL DE PROPÓSITO: `ScaffoldTemplate` e `ScaffoldTemplateVersion`
// não têm `tenantId`. São o método da Nebuloz, igual para todo cliente. O que
// é do cliente é o overlay, que chega em US5 e é por tenant.
//
// Idempotente e só insere:
//   • O template é criado se faltar (upsert com update vazio: um template que
//     já existe não é tocado).
//   • A VERSÃO é create-if-missing e NUNCA update. ST-01 diz que versão
//     publicada é imutável, e um seed que atualiza versão existente
//     reescreveria em silêncio o método sob o qual trilhas já rodam. Rodar
//     este script duas vezes não pode mudar uma trilha em curso — e não muda.

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/client";
import { TEMPLATES, type TemplateSeed } from "./scaffold-templates";

export { TEMPLATES };

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

type SeedDb = typeof db;

export async function upsertTemplate(
  seedDb: SeedDb,
  seed: TemplateSeed
): Promise<{ created: number; skipped: number }> {
  const template = await seedDb.scaffoldTemplate.upsert({
    where: { key: seed.key },
    create: { key: seed.key, name: seed.name, archetype: seed.archetype },
    // Só insere: template que já existe fica como está. Renomear ou trocar a
    // forma de um template em produção muda o que as trilhas dele mostram, e
    // isso é decisão de produto, não efeito colateral de um seed.
    update: {},
    select: { id: true },
  });

  let created = 0;
  let skipped = 0;

  for (const version of seed.versions) {
    const existing = await seedDb.scaffoldTemplateVersion.findUnique({
      where: {
        templateId_label: { templateId: template.id, label: version.label },
      },
      select: { id: true },
    });
    if (existing) {
      // ST-01. Não atualiza. Ver o cabeçalho.
      skipped++;
      continue;
    }

    // Uma transação por versão: uma versão publicada pela metade — com passos e
    // sem critérios — seria um gate que não bloqueia nada, que é o pior estado
    // possível deste produto.
    await seedDb.$transaction(async (tx) => {
      const row = await tx.scaffoldTemplateVersion.create({
        data: {
          templateId: template.id,
          label: version.label,
          authorLabel: version.authorLabel,
          note: version.note,
        },
        select: { id: true },
      });

      for (const phase of version.phases) {
        await tx.scaffoldStepTemplate.createMany({
          data: phase.steps.map((step, i) => ({
            versionId: row.id,
            phase: phase.phase,
            seq: i + 1,
            key: step.key,
            statement: step.statement,
            expectedArtefact: step.expectedArtefact,
            required: step.required ?? true,
            estimateMinutes: step.estimateMinutes,
          })),
        });
        if (phase.deliverables?.length) {
          await tx.scaffoldDeliverableTemplate.createMany({
            data: phase.deliverables.map((d, i) => ({
              versionId: row.id,
              phase: phase.phase,
              stepCode: d.stepCode,
              code: d.code,
              seq: i + 1,
              title: d.title,
              description: d.description,
              kind: d.kind,
              producer: d.producer,
              required: d.required ?? true,
              requiresModule: d.requiresModule ?? null,
            })),
          });
        }
        await tx.scaffoldGateCriterion.createMany({
          data: phase.criteria.map((c, i) => ({
            versionId: row.id,
            phase: phase.phase,
            seq: i + 1,
            key: c.key,
            statement: c.statement,
            evaluationType: c.evaluationType ?? "MANUAL",
          })),
        });
      }
    });
    created++;
  }

  return { created, skipped };
}

async function main() {
  for (const seed of TEMPLATES) {
    const { created, skipped } = await upsertTemplate(db, seed);
    console.log(
      `${seed.name} (${seed.key}): ${created} versão(ões) criada(s), ${skipped} já existente(s)`
    );
  }
}

// Guarda de entrypoint: um teste que importe TEMPLATES daqui não pode disparar
// main() e escrever no banco por acidente.
const isEntrypoint =
  !!process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (isEntrypoint) {
  main()
    .then(() => db.$disconnect())
    .catch(async (err) => {
      console.error(err);
      await db.$disconnect();
      process.exit(1);
    });
}
