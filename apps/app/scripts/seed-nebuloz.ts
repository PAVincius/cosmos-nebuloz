/**
 * scripts/seed-nebuloz.ts
 *
 * Cadastra a Nebuloz como tenant do COSMOS: um ART por produto, um time por
 * ART, os módulos contratados e o convite de quem falta entrar.
 *
 * Diferente de `seed-e2e.ts`, este script **não apaga nada**. Ele roda contra
 * um banco com gente usando: toda escrita é upsert por chave natural (slug do
 * tenant, nome do ART dentro do tenant, nome do time dentro do ART), então
 * rodar duas vezes não duplica ART nem inventa time novo. Não é um seed de
 * fixture — é provisionamento.
 *
 * O que ele NÃO faz, de propósito:
 *
 *   - Não cria usuário nem senha. Autenticação passa pelo Better Auth
 *     (scrypt, tabela Account); escrever hash por fora daqui seria um segundo
 *     lugar que sabe hashear senha, e o dia em que os dois divergirem alguém
 *     fica trancado para fora. Quem for ADMIN se cadastra pelo app primeiro.
 *   - Não dispara email. O convite é gravado como TenantInvitation PENDING e
 *     a URL de aceite sai no console. Mandar email daqui exigiria RESEND_TOKEN
 *     no shell de quem roda o script, e um erro de digitação no destinatário
 *     vira email de verdade na caixa de alguém de verdade.
 *
 * Uso:
 *   cd apps/app
 *   DATABASE_URL="postgresql://..." \
 *   ADMIN_EMAIL="voce@nebuloz.com" \
 *   INVITE_EMAIL="convidado@exemplo.com" \
 *   APP_URL="https://app.nebuloz.com" \
 *   npx tsx scripts/seed-nebuloz.ts
 *
 * Variáveis opcionais: TENANT_NAME, TENANT_SLUG, INVITE_ROLE (default ADMIN),
 * INVITE_DAYS (validade do convite, default 7).
 */

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import type { MemberRole } from "../../../packages/database/generated";
import { PrismaClient } from "../../../packages/database/generated";

const TENANT_NAME = process.env.TENANT_NAME ?? "Nebuloz";
const TENANT_SLUG = process.env.TENANT_SLUG ?? "nebuloz";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const INVITE_EMAIL = process.env.INVITE_EMAIL ?? "";
const INVITE_ROLE = (process.env.INVITE_ROLE ?? "ADMIN") as MemberRole;
const INVITE_DAYS = Number(process.env.INVITE_DAYS ?? 7);
const APP_URL = process.env.APP_URL ?? "http://localhost:3012";

/**
 * Um produto da casa = um ART. É o mapeamento direto do SAFe: o trem é o
 * container de execução do PI, e cada produto planeja o seu PI separado.
 *
 * A cadência é a mesma para todos porque hoje é: PI de 10 semanas com sprint
 * de 2 (4 regulares + IP), que é o default de `CreateARTSchema`. Quem quiser
 * outra muda na tela de ARTs — aqui não é o lugar de fixar política.
 */
const PRODUTOS = [
  { art: "Meridian", team: "Time Meridian" },
  { art: "Charter", team: "Time Charter" },
  { art: "Signal", team: "Time Signal" },
  { art: "Scaffold", team: "Time Scaffold" },
  { art: "Cosmos", team: "Time Cosmos" },
] as const;

/**
 * Módulos contratados. O enum `ProductModule` só conhece estes três: Meridian
 * e Scaffold são produtos com trem próprio, não módulos vendidos à parte, e
 * inventar linha para eles quebraria o `@@unique([tenantId, module])` no dia
 * em que virarem módulo de verdade.
 */
const MODULOS = ["COSMOS", "CHARTER", "SIGNAL"] as const;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL é obrigatório.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  console.log(`\n🛰  Provisionando ${TENANT_NAME} (${TENANT_SLUG})\n`);

  // ── Tenant ────────────────────────────────────────────────────────────────
  const tenant = await db.tenant.upsert({
    where: { slug: TENANT_SLUG },
    create: { name: TENANT_NAME, slug: TENANT_SLUG },
    update: { name: TENANT_NAME },
    select: { id: true, name: true },
  });
  console.log(`✅ Tenant ${tenant.name} (${tenant.id})`);

  // ── Módulos contratados ───────────────────────────────────────────────────
  for (const module of MODULOS) {
    await db.tenantModule.upsert({
      where: { tenantId_module: { tenantId: tenant.id, module } },
      create: { tenantId: tenant.id, module, status: "ACTIVE" },
      // Só o status: `contractedAt` é rastro comercial e não pode ser
      // reescrito toda vez que alguém roda o script de novo.
      update: { status: "ACTIVE" },
    });
  }
  console.log(`✅ Módulos ativos: ${MODULOS.join(", ")}`);

  // ── Administrador ─────────────────────────────────────────────────────────
  let adminUserId: string | null = null;
  if (ADMIN_EMAIL) {
    const user = await db.user.findUnique({
      where: { email: ADMIN_EMAIL },
      select: { id: true, email: true },
    });
    if (user) {
      adminUserId = user.id;
      await db.tenantMember.upsert({
        where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
        create: { tenantId: tenant.id, userId: user.id, role: "ADMIN" },
        update: { role: "ADMIN" },
      });
      console.log(`✅ ADMIN: ${user.email}`);
    } else {
      console.log(
        `⚠️  Nenhum usuário com email ${ADMIN_EMAIL}. Cadastre-se em ${APP_URL}/sign-up e rode o script de novo — sem isso o tenant fica sem administrador.`
      );
    }
  } else {
    console.log("⚠️  ADMIN_EMAIL não informado — nenhuma membership criada.");
  }

  // ── ARTs e times ──────────────────────────────────────────────────────────
  // `findFirst` + `create` em vez de upsert porque ART não tem chave única
  // composta no schema — o nome é único por convenção de tela (createART
  // recusa duplicata), não por constraint no banco.
  for (const produto of PRODUTOS) {
    let art = await db.aRT.findFirst({
      where: {
        tenantId: tenant.id,
        name: { equals: produto.art, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (art) {
      console.log(`ℹ️  ART ${produto.art} já existe — mantido como está`);
    } else {
      art = await db.aRT.create({
        data: {
          tenantId: tenant.id,
          name: produto.art,
          piCadenceWeeks: 10,
          sprintLengthWeeks: 2,
          ipSprintEnabled: true,
          status: "INACTIVE",
        },
        select: { id: true },
      });
      console.log(`✅ ART ${produto.art}`);
    }

    const time = await db.team.findFirst({
      where: { tenantId: tenant.id, artId: art.id, name: produto.team },
      select: { id: true },
    });
    if (time) {
      console.log(`ℹ️  ${produto.team} já existe`);
    } else {
      await db.team.create({
        data: { tenantId: tenant.id, artId: art.id, name: produto.team },
      });
      console.log(`✅ ${produto.team}`);
    }
  }

  // ── Convite ───────────────────────────────────────────────────────────────
  // Só com um ADMIN de verdade: `inviterId` grava quem convidou, e um convite
  // sem convidante identificável é um convite que ninguém consegue auditar
  // depois. Além disso, workspace sem administrador não tem quem receba o
  // convidado do outro lado.
  if (INVITE_EMAIL && !adminUserId) {
    console.log(
      "⚠️  Convite não criado: o tenant ainda não tem ADMIN. Resolva o ADMIN_EMAIL acima e rode de novo."
    );
  }
  if (INVITE_EMAIL && adminUserId) {
    const jaMembro = await db.tenantMember.findFirst({
      where: { tenantId: tenant.id, user: { email: INVITE_EMAIL } },
      select: { id: true },
    });
    if (jaMembro) {
      console.log(`ℹ️  ${INVITE_EMAIL} já é membro — nenhum convite criado`);
    } else {
      const pendente = await db.tenantInvitation.findFirst({
        where: {
          tenantId: tenant.id,
          email: INVITE_EMAIL,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });
      const convite =
        pendente ??
        (await db.tenantInvitation.create({
          data: {
            tenantId: tenant.id,
            email: INVITE_EMAIL,
            role: INVITE_ROLE,
            status: "PENDING",
            expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
            inviterId: adminUserId,
          },
          select: { id: true },
        }));
      console.log(
        `${pendente ? "ℹ️  Convite pendente reaproveitado" : "✅ Convite criado"} para ${INVITE_EMAIL} (${INVITE_ROLE})`
      );
      console.log(`   → ${APP_URL}/invite/${convite.id}`);
    }
  }

  console.log("\n─────────────────────────────────────────");
  console.log("Provisionamento concluído.\n");

  await db.$disconnect();
  await pool.end();
}

// Guarda de entrypoint: sem ela, importar este módulo para reusar PRODUTOS
// dispararia escrita em produção.
const isEntrypoint =
  !!process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (isEntrypoint) {
  main().catch((error) => {
    console.error("❌ seed-nebuloz falhou:", error);
    process.exit(1);
  });
}
