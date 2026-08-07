// seed-regulacao.mts — semeia os cinco corpora globais de regulação (EU AI
// Act, LGPD, NIST AI RMF 1.0, ISO/IEC 42001, Segurança em IA generativa) que
// o Charter usa como base do mapa de conformidade. Dado (CORPORA) mora em
// regulacao-corpora.ts — ver o comentário lá para o motivo da separação.
// Run: pnpm exec tsx scripts/seed-regulacao.mts   (from packages/database)
// Run with: pnpm exec tsx --env-file=.env scripts/seed-regulacao.mts
//
// GRAVAÇÃO GLOBAL DE PROPÓSITO: os cinco conjuntos entram com
// `tenantId: null` (valem para todo tenant, não só para quem os importou).
// CharterRequirementSet e CharterRequirement têm RLS habilitado em produção
// sem nenhuma policy, e hoje só funcionam porque a app conecta como dona da
// tabela com FORCE desligado. Se algum dia alguém adicionar uma policy com
// FORCE, upserts com tenantId nulo como este seed serão recusados — quem
// escrever essa policy precisa enxergar esta gravação global antes de
// restringir por tenant.
//
// Instantiate the client directly (the package index imports "server-only",
// which throws under plain tsx) using the same pg driver adapter Prisma 7 needs.
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/client";
import { CORPORA, type CorpusSeed } from "./regulacao-corpora";

export { CORPORA };

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

type SeedDb = typeof db;

export async function upsertCorpus(
  seedDb: SeedDb,
  corpus: CorpusSeed
): Promise<number> {
  // upsert "por (nome, versao)": não existe @@unique nesses dois campos no
  // schema (mudar isso é migração, fora do escopo desta task), então o
  // idempotente aqui é find + update/create, igual ao resto de seed-cosmos.mts.
  //
  // tenantId: null é obrigatório aqui, não decorativo: sem ele, um tenant que
  // já tenha um conjunto próprio com o mesmo (nome, versao) — coincidência ou
  // colisão deliberada — seria encontrado por este findFirst, e o update
  // abaixo sobrescreveria a RFP privada dele com o corpus global, virando
  // `tenantId: null` no processo. CharterRequirementSet não tem RLS, então
  // nada no banco impediria isso; o filtro é a única defesa.
  const existing = await seedDb.charterRequirementSet.findFirst({
    where: { nome: corpus.nome, versao: corpus.versao, tenantId: null },
    select: { id: true },
  });
  const setData = {
    tenantId: null,
    nome: corpus.nome,
    origem: corpus.origem,
    editor: corpus.editor,
    jurisdicao: corpus.jurisdicao,
    licenca: corpus.licenca,
    versao: corpus.versao,
    notas: corpus.notas,
  };
  const set = existing
    ? await seedDb.charterRequirementSet.update({
        where: { id: existing.id },
        data: setData,
        select: { id: true },
      })
    : await seedDb.charterRequirementSet.create({
        data: setData,
        select: { id: true },
      });

  let count = 0;
  for (const req of corpus.requisitos) {
    await seedDb.charterRequirement.upsert({
      where: { setId_codigo: { setId: set.id, codigo: req.codigo } },
      update: {
        citacao: req.citacao,
        resumo: req.resumo,
        texto: req.texto ?? null,
        categoria: req.categoria ?? null,
      },
      create: {
        setId: set.id,
        codigo: req.codigo,
        citacao: req.citacao,
        resumo: req.resumo,
        texto: req.texto ?? null,
        categoria: req.categoria ?? null,
      },
    });
    count++;
  }
  return count;
}

async function main() {
  for (const corpus of CORPORA) {
    const count = await upsertCorpus(db, corpus);
    console.log(`${corpus.nome} (${corpus.versao}): ${count} exigências`);
  }
}

// Guarda de entrypoint: licenca-copyright.test.ts importa CORPORA de
// regulacao-corpora.ts — sem a guarda aqui, rodar a suíte de testes seria uma
// oportunidade a menos, não uma garantia; é a importação de seed-regulacao.mts
// em si (feita por qualquer consumidor futuro) que não pode disparar main().
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
