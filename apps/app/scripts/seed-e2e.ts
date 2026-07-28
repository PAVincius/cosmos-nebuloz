/**
 * scripts/seed-e2e.ts
 *
 * Seed completo para testes E2E. Cria uma empresa simulada com todas as
 * entidades do Cosmos preenchidas:
 *
 * Auth & Org
 *   - 1 Usuário admin (E2E_EMAIL / E2E_PASSWORD)
 *   - 1 Tenant COSMOS Dev (UNIVERSE) + membership ADMIN
 *   - OnboardingProgress (company_setup concluído)
 *
 * SAFe Delivery
 *   - LACE (Large Solution)
 *   - 1 ART → 1 Time (5 membros)
 *   - 5 Sprints (3 CLOSED com velocity / 1 ACTIVE / 1 PLANNING)
 *   - 1 SprintReview + 1 Retrospective (sprint COMPLETED)
 *   - 1 PI Plan → 4 PI Objectives
 *
 * Portfolio
 *   - 3 Temas Estratégicos → 3 OKRs → 7 Key Results + snapshots
 *   - 3 Épicos → 4 Features → DependencyLink entre features
 *   - 7 Stories em todos os status → 12 Tasks em todos os status
 *
 * Gestão de Riscos & Qualidade
 *   - 5 Risks (ROAM completo: IDENTIFIED/OWNED/ACCEPTED/MITIGATED/RESOLVED)
 *   - 3 Impediments (OPEN/IN_PROGRESS/RESOLVED)
 *   - 3 Defects (severidades: critical/high/medium)
 *
 * Flow & Competências
 *   - 2 FlowMetricSnapshots (sprints concluídos)
 *   - 2 StandupEntries (últimos 2 dias)
 *   - 1 CompetencyAssessment (team) + 1 (ART)
 *   - 2 ImprovementActions
 *   - 1 PersonSkillProfile
 *
 * Idempotente — limpa dados do tenant antes do re-seed.
 *
 * Uso:
 *   cd apps/app
 *   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cosmos_dev" \
 *   BETTER_AUTH_SECRET="cosmos-dev-secret-key-min-32-chars-placeholder" \
 *   BETTER_AUTH_URL="http://localhost:3012" \
 *   npx tsx scripts/seed-e2e.ts
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { Pool } from "pg";
import type { MemberRole } from "../../../packages/database/generated";
import { Prisma, PrismaClient } from "../../../packages/database/generated";
import { TaskBlocksSchema } from "../app/(cosmos)/actions/epic-tree.constants";

/**
 * Contexto acumulado pelo seed — ids e o client Prisma que as tasks
 * seguintes do plano de seed reutilizam em vez de refazer lookups.
 */
export type SeedContext = {
  prisma: PrismaClient;
  tenantId: string;
  tenantSlug: string;
  users: Record<MemberRole, string>;
  artIds: string[];
  teamIds: string[];
  epicIds: string[];
  featureIds: string[];
  storyIds: string[];
  piPlanIds: string[];
  themeIds: string[];
};

const E2E_EMAIL = process.env.E2E_EMAIL ?? "admin@cosmos.local";
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "Cosmos@2026!";
const TENANT_SLUG = process.env.SEED_TENANT_SLUG ?? "cosmos-dev";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  session: {
    additionalFields: {
      activeTenantId: { type: "string", nullable: true, input: false },
    },
  },
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "cosmos-dev-secret-key-min-32-chars-placeholder",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3012",
});

function wsjf(bv: number, tc: number, rr: number, js: number) {
  return Math.round(((bv + tc + rr) / js) * 10) / 10;
}

// Per-letter INVEST decomposition in the shape the analyze-invest route
// persists ({ I: { score, rationale }, … }); getEpicDetailFull parses it into
// the per-dimension bars on the epic screen. Without it the epic detail shows
// "ainda não recebeu uma análise INVEST" no matter what investScore says.
function investBreakdown(
  scores: [number, number, number, number, number, number],
  rationale: string
) {
  const letters = ["I", "N", "V", "E", "S", "T"] as const;
  return Object.fromEntries(
    letters.map((letter, i) => [letter, { score: scores[i], rationale }])
  );
}

const lbc = (...texts: string[]) =>
  texts.map((text, i) => ({ id: `lbc-${i + 1}`, text }));

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const addWeeks = (d: Date, w: number) => addDays(d, w * 7);

/**
 * Semeia Integration (provider connections) e as Task importadas/nativas que
 * dependem delas. Sem isto a tela `integrations` fica vazia e os estados
 * "importado de provider conectado" / "importado de provider não conectado"
 * do drill-down Epic→Feature→Story→Task ficam inalcançáveis.
 */
async function seedIntegrations(ctx: SeedContext): Promise<void> {
  const { prisma, tenantId, storyIds } = ctx;
  const now = new Date();

  console.log("\n  Criando integrations e tasks importadas/nativas...");

  // jira e linear ficam ACTIVE (sincronizadas); github fica INACTIVE — é o
  // provider "não conectado" que torna demonstrável o estado "Conectar" da
  // UI. Os valores de config/mapping são obviamente falsos: nunca algo que
  // se pareça com uma credencial real.
  const integrationDefs = [
    {
      source: "jira",
      name: "Jira Software (seed)",
      status: "ACTIVE",
      config: { apiKey: "seed-fake-not-a-real-key", org: "cosmos-seed" },
      mapping: { statusMap: { TODO: "To Do", DONE: "Done" } },
      lastSyncAt: addDays(now, -1),
    },
    {
      source: "linear",
      name: "Linear (seed)",
      status: "ACTIVE",
      config: { apiKey: "seed-fake-not-a-real-key", teamId: "seed-team" },
      mapping: { statusMap: { TODO: "Todo", DONE: "Done" } },
      lastSyncAt: addDays(now, -2),
    },
    {
      source: "github",
      name: "GitHub Issues (seed, desconectado)",
      status: "INACTIVE",
      config: { apiKey: "seed-fake-not-a-real-key", repo: "cosmos/cosmos" },
      mapping: Prisma.DbNull,
      lastSyncAt: null,
    },
  ];

  for (const def of integrationDefs) {
    const existing = await prisma.integration.findFirst({
      where: { tenantId, source: def.source },
      select: { id: true },
    });
    const data = {
      tenantId,
      source: def.source,
      name: def.name,
      status: def.status,
      config: def.config,
      mapping: def.mapping,
      lastSyncAt: def.lastSyncAt,
    };
    if (existing) {
      await prisma.integration.update({ where: { id: existing.id }, data });
    } else {
      await prisma.integration.create({ data });
    }
  }
  console.log(
    "  ✓ 3 Integrations (jira ACTIVE, linear ACTIVE, github INACTIVE)"
  );

  // Nota nativa validada contra o mesmo schema que a UI usa para ler
  // noteBlocks — um payload que não bata é lido como null pela UI, então o
  // seed mentiria sobre a tela mostrar conteúdo.
  const validatedNoteBlocks = TaskBlocksSchema.parse([
    { id: "seed-native-heading", kind: "heading", text: "Contexto da task" },
    {
      id: "seed-native-paragraph",
      kind: "paragraph",
      text: "Nota nativa criada pelo seed para validar o editor de blocos.",
    },
    {
      id: "seed-native-checklist",
      kind: "checklist",
      items: [
        {
          id: "seed-native-item-1",
          text: "Levantar critérios de aceite",
          done: true,
        },
        { id: "seed-native-item-2", text: "Validar com o PO", done: false },
      ],
    },
  ]);

  const [storyA, storyB, storyC] = storyIds;

  // Três feitios: importada de provider ativo (jira/linear), importada de
  // provider inativo (github) e nativa. externalUrl varia entre preenchido e
  // nulo — a UI cai para buildUrl(provider, externalId) quando é nulo, e os
  // dois ramos precisam de dado para serem exercitados.
  const taskDefs: {
    storyId: string;
    title: string;
    externalSource: string | null;
    externalId: string | null;
    externalUrl: string | null;
    noteBlocks: Prisma.InputJsonValue | typeof Prisma.DbNull;
  }[] = [
    {
      storyId: storyA,
      title: "[Jira] Corrigir paginação do board de riscos",
      externalSource: "jira",
      externalId: "COS-142",
      externalUrl: "https://cosmos.atlassian.net/browse/COS-142",
      noteBlocks: Prisma.DbNull,
    },
    {
      storyId: storyA,
      title: "[Linear] Revisar copy do onboarding",
      externalSource: "linear",
      externalId: "COS-77",
      externalUrl: null,
      noteBlocks: Prisma.DbNull,
    },
    {
      storyId: storyB,
      title: "[GitHub] Corrigir flake no pipeline de E2E",
      externalSource: "github",
      externalId: "#418",
      externalUrl: "https://github.com/cosmos/cosmos/issues/418",
      noteBlocks: Prisma.DbNull,
    },
    {
      storyId: storyB,
      title: "[GitHub] Atualizar dependências do worker de sync",
      externalSource: "github",
      externalId: "#421",
      externalUrl: null,
      noteBlocks: Prisma.DbNull,
    },
    {
      storyId: storyC,
      title: "Detalhar critérios de aceite da task nativa",
      externalSource: null,
      externalId: null,
      externalUrl: null,
      noteBlocks: validatedNoteBlocks,
    },
  ];

  for (const def of taskDefs) {
    const existing = await prisma.task.findFirst({
      where: { tenantId, storyId: def.storyId, title: def.title },
      select: { id: true },
    });
    const data = {
      tenantId,
      storyId: def.storyId,
      title: def.title,
      externalSource: def.externalSource,
      externalId: def.externalId,
      externalUrl: def.externalUrl,
      noteBlocks: def.noteBlocks,
    };
    if (existing) {
      await prisma.task.update({ where: { id: existing.id }, data });
    } else {
      await prisma.task.create({ data });
    }
  }
  console.log(
    "  ✓ 5 Tasks (2 importadas de provider ACTIVE, 2 de provider INACTIVE, 1 nativa com noteBlocks)"
  );
}

/**
 * Semeia o nível Large Solution do SAFe (SolutionTrain, Capability, LACE
 * members, Supplier/SupplierDeliverable, SolutionRisk, CrossArtDependency).
 * Sem isto a tela `solution` fica permanentemente vazia.
 *
 * O LACE em si já é criado na seção 5 de main() (LACE.tenantId é @unique),
 * então esta função só acrescenta membros a ele — não cria um segundo.
 *
 * O seed até aqui só produz 1 ART (ctx.artIds tem um único id), mas
 * CrossArtDependency só é demonstrável entre dois ARTs distintos. Por isso
 * esta função cria um segundo ART, já vinculado ao SolutionTrain — o que é
 * o modelo natural da SAFe: um Solution Train coordena vários ARTs.
 */
async function seedLargeSolution(ctx: SeedContext): Promise<void> {
  const { prisma, tenantId, featureIds, users } = ctx;
  const [artId] = ctx.artIds;

  console.log(
    "\n  Criando Large Solution (SolutionTrain, Capabilities, LACE members, Suppliers, Risks, CrossArtDependency)..."
  );

  // ─── SolutionTrain ─────────────────────────────────────────────────────
  let solutionTrain = await prisma.solutionTrain.findFirst({
    where: { tenantId, name: "Solution Train COSMOS" },
  });
  if (!solutionTrain) {
    solutionTrain = await prisma.solutionTrain.create({
      data: {
        tenantId,
        name: "Solution Train COSMOS",
        description:
          "Coordena os ARTs da plataforma COSMOS na entrega de valor de solução ponta a ponta.",
      },
    });
  }

  // Segundo ART, para o CrossArtDependency ter dois lados reais.
  let art2 = await prisma.aRT.findFirst({
    where: { tenantId, name: "Plataforma COSMOS — Mobile" },
  });
  if (!art2) {
    art2 = await prisma.aRT.create({
      data: {
        tenantId,
        name: "Plataforma COSMOS — Mobile",
        cadence: 10,
        solutionTrainId: solutionTrain.id,
      },
    });
  }

  // ─── Capability (2, cada uma ligada a >= 1 Feature existente) ──────────
  const capabilityDefs = [
    {
      title: "Portfolio Management Platform",
      description:
        "Capacidade de solução para consolidar Kanban, OKRs e governança de portfólio num único produto.",
      milestone: "Marco Q2 2026",
      featureId: featureIds[0],
    },
    {
      title: "AI Risk Intelligence",
      description:
        "Capacidade de solução para scoring e mitigação de riscos assistidos por IA através dos ARTs.",
      milestone: "Marco Q3 2026",
      featureId: featureIds[2],
    },
  ];

  for (const def of capabilityDefs) {
    let capability = await prisma.capability.findFirst({
      where: { tenantId, title: def.title },
    });
    if (!capability) {
      capability = await prisma.capability.create({
        data: {
          tenantId,
          solutionTrainId: solutionTrain.id,
          title: def.title,
          description: def.description,
          status: "IMPLEMENTING",
          milestone: def.milestone,
        },
      });
    }
    await prisma.feature.updateMany({
      where: { id: def.featureId, tenantId, capabilityId: null },
      data: { capabilityId: capability.id },
    });
  }
  console.log(
    "  ✓ 1 SolutionTrain + 2 ARTs + 2 Capabilities ligadas a Feature"
  );

  // ─── LACE members (o LACE em si já existe, criado na seção 5) ─────────
  const lace = await prisma.lACE.findUnique({ where: { tenantId } });
  if (lace) {
    const laceMemberDefs = [
      { userId: users.STE, laceRole: "SOLUTION_TRAIN_ENGINEER" as const },
      { userId: users.ADMIN, laceRole: "BUSINESS_OWNER" as const },
      { userId: users.PO, laceRole: "PRODUCT_MANAGER" as const },
    ];
    for (const def of laceMemberDefs) {
      await prisma.lACEMember.upsert({
        where: { laceId_userId: { laceId: lace.id, userId: def.userId } },
        update: { laceRole: def.laceRole },
        create: {
          tenantId,
          laceId: lace.id,
          userId: def.userId,
          laceRole: def.laceRole,
        },
      });
    }
    console.log("  ✓ 3 LACEMembers (STE, BUSINESS_OWNER, PRODUCT_MANAGER)");
  }

  // ─── Supplier + SupplierDeliverable (2 suppliers, 1 deliverable cada) ──
  const supplierDefs = [
    {
      name: "Acme Cloud Services",
      contact: "contas@acmecloud.example",
      description:
        "Fornecedor de infraestrutura cloud para a plataforma COSMOS.",
      artId,
      featureId: featureIds[0],
      status: "DELIVERED" as const,
    },
    {
      name: "DataSecure LGPD Consultoria",
      contact: "contato@datasecure.example",
      description: "Consultoria de compliance LGPD para o épico de SSO/SCIM.",
      artId: art2.id,
      featureId: featureIds[3],
      status: "IN_PROGRESS" as const,
    },
  ];

  for (const def of supplierDefs) {
    let supplier = await prisma.supplier.findFirst({
      where: { tenantId, name: def.name },
    });
    if (supplier) {
      // artId aponta para um ART recriado a cada seed (cleanup do main() faz
      // aRT.deleteMany do tenant inteiro) — reatualiza para não deixar um id
      // órfão apontando para um ART já apagado.
      supplier = await prisma.supplier.update({
        where: { id: supplier.id },
        data: { artId: def.artId },
      });
    } else {
      supplier = await prisma.supplier.create({
        data: {
          tenantId,
          solutionTrainId: solutionTrain.id,
          artId: def.artId,
          name: def.name,
          contact: def.contact,
          description: def.description,
          status: "ACTIVE",
        },
      });
    }
    const existingDeliverable = await prisma.supplierDeliverable.findFirst({
      where: { tenantId, supplierId: supplier.id, featureId: def.featureId },
    });
    if (!existingDeliverable) {
      await prisma.supplierDeliverable.create({
        data: {
          tenantId,
          supplierId: supplier.id,
          featureId: def.featureId,
          expectedDate: addWeeks(new Date(), 2),
          actualDate:
            def.status === "DELIVERED" ? addWeeks(new Date(), -1) : null,
          status: def.status,
        },
      });
    }
  }
  console.log("  ✓ 2 Suppliers com 1 SupplierDeliverable cada");

  // ─── SolutionRisk (2, com roamStatus diferente — o model não tem campo de
  // "severidade"; roamStatus é o que a tela de solução usa para cor/filtro) ─
  const solutionRiskDefs = [
    {
      title: "Fornecedor de cloud sem SLA de disponibilidade multi-região",
      description:
        "Acme Cloud Services ainda não formalizou SLA de failover entre regiões para a plataforma COSMOS.",
      roamStatus: "OWNED" as const,
      owner: "Sofia Torres (STE)",
      affectedArtIds: [artId],
    },
    {
      title: "Certificação LGPD pode atrasar o go-live do SSO enterprise",
      description:
        "DataSecure LGPD Consultoria estimou 6 semanas para o parecer final de compliance.",
      roamStatus: "MITIGATED" as const,
      owner: "Rafael Teixeira (RTE)",
      affectedArtIds: [artId, art2.id],
    },
  ];

  for (const def of solutionRiskDefs) {
    const existing = await prisma.solutionRisk.findFirst({
      where: { tenantId, solutionTrainId: solutionTrain.id, title: def.title },
    });
    if (existing) {
      // affectedArtIds referencia ARTs recriados a cada seed — reatualiza
      // pelo mesmo motivo do artId do Supplier acima.
      await prisma.solutionRisk.update({
        where: { id: existing.id },
        data: { affectedArtIds: def.affectedArtIds },
      });
    } else {
      await prisma.solutionRisk.create({
        data: {
          tenantId,
          solutionTrainId: solutionTrain.id,
          title: def.title,
          description: def.description,
          roamStatus: def.roamStatus,
          owner: def.owner,
          affectedArtIds: def.affectedArtIds,
        },
      });
    }
  }
  console.log("  ✓ 2 SolutionRisks (roamStatus OWNED e MITIGATED)");

  // ─── CrossArtDependency (entre os dois ARTs) ───────────────────────────
  // Chave natural = o próprio SolutionTrain (o seed produz exatamente 1
  // CrossArtDependency): nem as Features nem os ARTs são estáveis entre runs
  // — o cleanup do main() apaga ART.deleteMany e Feature.deleteMany do
  // tenant inteiro a cada seed, então sourceArtId/targetArtId/
  // sourceFeatureId/targetFeatureId mudam de id a cada execução. Chavear por
  // qualquer um deles deixaria uma linha nova por run, com a antiga
  // apontando para linhas já apagadas.
  const sourceFeatureId = featureIds[0];
  const targetFeatureId = featureIds[3];
  const existingDependency = await prisma.crossArtDependency.findFirst({
    where: { tenantId, solutionTrainId: solutionTrain.id },
  });
  if (existingDependency) {
    await prisma.crossArtDependency.update({
      where: { id: existingDependency.id },
      data: {
        sourceFeatureId,
        targetFeatureId,
        sourceArtId: artId,
        targetArtId: art2.id,
      },
    });
  } else {
    await prisma.crossArtDependency.create({
      data: {
        tenantId,
        solutionTrainId: solutionTrain.id,
        sourceFeatureId,
        targetFeatureId,
        sourceArtId: artId,
        targetArtId: art2.id,
        type: "NEEDS",
      },
    });
  }
  console.log("  ✓ 1 CrossArtDependency entre os dois ARTs");
}

async function main(): Promise<SeedContext> {
  console.log("🌱 seed-e2e: Iniciando seed completo para E2E...\n");

  // ─── 1. Usuário ────────────────────────────────────────────────────────────
  let userId: string;
  const existingUser = await db.user.findUnique({
    where: { email: E2E_EMAIL },
  });
  const ctx = await auth.$context;
  const hashedPassword = await ctx.password.hash(E2E_PASSWORD);

  if (existingUser) {
    userId = existingUser.id;
    await db.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
    const credAccount = await db.account.findFirst({
      where: { userId, providerId: "credential" },
    });
    if (credAccount) {
      await db.account.update({
        where: { id: credAccount.id },
        data: { password: hashedPassword },
      });
    } else {
      await db.account.create({
        data: {
          userId,
          accountId: E2E_EMAIL,
          providerId: "credential",
          password: hashedPassword,
        },
      });
    }
    console.log(`  ✓ user (atualizado) ${E2E_EMAIL}`);
  } else {
    const user = await db.user.create({
      data: {
        email: E2E_EMAIL,
        name: "Admin E2E",
        emailVerified: true,
        accounts: {
          create: {
            accountId: E2E_EMAIL,
            providerId: "credential",
            password: hashedPassword,
          },
        },
      },
    });
    userId = user.id;
    console.log(`  ✓ user criado ${E2E_EMAIL}`);
  }

  // ─── 2. Tenant ─────────────────────────────────────────────────────────────
  let tenant = await db.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (tenant) {
    await db.tenant.update({
      where: { id: tenant.id },
      data: { plan: "UNIVERSE" },
    });
    console.log(`  ✓ tenant (já existe) ${TENANT_SLUG}`);
  } else {
    tenant = await db.tenant.create({
      data: {
        name: "COSMOS Dev",
        slug: TENANT_SLUG,
        plan: "UNIVERSE",
        metadata: { seeded: true },
      },
    });
    console.log(`  ✓ tenant criado ${TENANT_SLUG}`);
  }
  const TENANT_ID = tenant.id;

  const membership = await db.tenantMember.findFirst({
    where: { userId, tenantId: TENANT_ID },
  });
  if (!membership) {
    await db.tenantMember.create({
      data: { userId, tenantId: TENANT_ID, role: "ADMIN" },
    });
    console.log("  ✓ membership ADMIN criado");
  }

  // Remove memberships in other tenants (E2E user = only cosmos-dev)
  const removedMemberships = await db.tenantMember.deleteMany({
    where: { userId, tenantId: { not: TENANT_ID } },
  });
  if (removedMemberships.count > 0) {
    console.log(
      `  ✓ ${removedMemberships.count} membership(s) de outros tenants removido(s)`
    );
  }

  // Delete all sessions — forces fresh login, cookieCache bypass
  const deletedSessions = await db.session.deleteMany({ where: { userId } });
  console.log(
    `  ✓ ${deletedSessions.count} sessão(ões) deletada(s) — relogin necessário`
  );

  // ─── 2b. Um login por papel ────────────────────────────────────────────────
  // Until now this tenant had exactly one account, an ADMIN. That made two
  // things untestable: the persona specs (named after RTE/PO/SM/LPM but
  // probing routes signed out, because there was nobody to sign in as) and
  // RBAC itself — requireRole gates 130+ call sites on ADMIN/STE/RTE/PO/SM,
  // and none of it was exercised.
  //
  // Team.members stays as it is: that JSON is roster metadata (skills, hours)
  // for capacity maths, not identities. These are real User rows with
  // credentials, which is what signing in requires.
  //
  // DEV is seeded on purpose despite never appearing in a requireRole list —
  // it is the negative case, the role that proves a gate actually closes.
  const ROLE_USERS = [
    { role: "STE" as const, name: "Sofia Torres (STE)" },
    { role: "RTE" as const, name: "Rafael Teixeira (RTE)" },
    { role: "PO" as const, name: "Paula Oliveira (PO)" },
    { role: "SM" as const, name: "Samuel Moreira (SM)" },
    { role: "DEV" as const, name: "Diego Vieira (DEV)" },
    // MEMBER is the plain, no-elevated-permission role — the negative case
    // for default-deny RBAC checks that don't map to any of the roles above.
    { role: "MEMBER" as const, name: "Marina Alves (MEMBER)" },
  ];

  const roleUserIds: Partial<Record<MemberRole, string>> = { ADMIN: userId };

  for (const { role, name } of ROLE_USERS) {
    const email = `${role.toLowerCase()}@cosmos.local`;
    const roleUser = await db.user.upsert({
      where: { email },
      update: { name, emailVerified: true },
      create: { email, name, emailVerified: true },
      select: { id: true },
    });

    // Same password as the admin — these are fixtures, and one constant keeps
    // the runner's env surface to a single E2E_PASSWORD.
    const account = await db.account.findFirst({
      where: { userId: roleUser.id, providerId: "credential" },
      select: { id: true },
    });
    if (account) {
      await db.account.update({
        where: { id: account.id },
        data: { password: hashedPassword },
      });
    } else {
      await db.account.create({
        data: {
          userId: roleUser.id,
          accountId: email,
          providerId: "credential",
          password: hashedPassword,
        },
      });
    }

    const roleMembership = await db.tenantMember.findFirst({
      where: { userId: roleUser.id, tenantId: TENANT_ID },
      select: { id: true },
    });
    if (roleMembership) {
      await db.tenantMember.update({
        where: { id: roleMembership.id },
        data: { role },
      });
    } else {
      await db.tenantMember.create({
        data: { userId: roleUser.id, tenantId: TENANT_ID, role },
      });
    }

    // Same reason as the admin above: a stale session would keep the previous
    // role in its cookie cache.
    await db.session.deleteMany({ where: { userId: roleUser.id } });

    roleUserIds[role] = roleUser.id;
  }
  console.log(
    `  ✓ ${ROLE_USERS.length} logins por papel (${ROLE_USERS.map((r) => r.role).join(", ")}) + ADMIN`
  );

  // ─── 3. Cleanup ────────────────────────────────────────────────────────────
  console.log("\n  Limpando dados existentes...");
  await db.flowMetricSnapshot.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.standupEntry.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.improvementAction.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.competencyAssessment.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.personSkillProfile.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.defect.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.impediment.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.risk.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.dependencyLink.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.task.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.story.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.retrospective.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.sprintReview.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.teamCapacitySnapshot.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.sprint.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.feature.deleteMany({ where: { tenantId: TENANT_ID } });
  // Governance chain, innermost first (GovernedEpic would cascade from Epic,
  // but the workflow and the decision log would not).
  await db.approvalStepInstance.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.approvalRequest.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.approvalWorkflow.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.governedEpic.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.decisionLogEntry.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.epic.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.keyResultSnapshot.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.keyResult.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.oKR.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.themeART.deleteMany({ where: { theme: { tenantId: TENANT_ID } } });
  await db.leanBudget.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.strategicTheme.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.pIObjective.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.confidenceVoteTally.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.confidenceVoteSession.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.pISession.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.pIPlan.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.team.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.aRT.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.lACE.deleteMany({ where: { tenantId: TENANT_ID } });
  await db.onboardingProgress.deleteMany({ where: { tenantId: TENANT_ID } });
  console.log("  ✓ Cleanup concluído");

  // ─── 4. OnboardingProgress ─────────────────────────────────────────────────
  await db.onboardingProgress.create({
    data: {
      tenantId: TENANT_ID,
      flowType: "company_setup",
      currentStep: 5,
      completedSteps: ["welcome", "company", "art", "team", "pi"],
      status: "completed",
      data: {
        companyName: "COSMOS Dev",
        artName: "Plataforma COSMOS",
        teamSize: 5,
      },
    },
  });
  console.log("  ✓ OnboardingProgress (company_setup concluído)");

  // ─── 5. LACE ───────────────────────────────────────────────────────────────
  const lace = await db.lACE.create({
    data: {
      tenantId: TENANT_ID,
      name: "LACE COSMOS",
      description:
        "Lean-Agile Center of Excellence da plataforma COSMOS — coordena a implementação SAFe em todos os ARTs.",
      principles: [
        "Take an economic view",
        "Apply systems thinking",
        "Assume variability; preserve options",
        "Build incrementally with fast, integrated learning cycles",
        "Base milestones on objective evaluation of working systems",
        "Visualize and limit WIP, reduce batch sizes, and manage queue lengths",
        "Apply cadence, synchronize with cross-domain planning",
        "Unlock the intrinsic motivation of knowledge workers",
        "Decentralize decision-making",
      ],
    },
  });
  console.log(`  ✓ LACE "${lace.name}" (9 princípios)`);

  // ─── 6. ART ────────────────────────────────────────────────────────────────
  const art = await db.aRT.create({
    data: { tenantId: TENANT_ID, name: "Plataforma COSMOS", cadence: 10 },
  });
  console.log(`\n  ✓ ART "${art.name}"`);

  // ─── 7. Time ───────────────────────────────────────────────────────────────
  const team = await db.team.create({
    data: {
      tenantId: TENANT_ID,
      artId: art.id,
      name: "Team Nebula",
      velocity: 40,
      sprintLengthDays: 14,
      members: [
        {
          name: "Ana Lima",
          role: "SM",
          skills: ["Scrum", "Kanban", "SAFe Coaching"],
          hoursPerWeek: 40,
        },
        {
          name: "Bruno Melo",
          role: "PO",
          skills: ["Product Discovery", "SAFe", "BDD"],
          hoursPerWeek: 40,
        },
        {
          name: "Carla Nunes",
          role: "DEV",
          skills: ["TypeScript", "React", "Next.js"],
          hoursPerWeek: 40,
        },
        {
          name: "Diego Souza",
          role: "DEV",
          skills: ["Node.js", "PostgreSQL", "Prisma"],
          hoursPerWeek: 40,
        },
        {
          name: "Eva Costa",
          role: "DEV",
          skills: ["TypeScript", "Testing", "Playwright"],
          hoursPerWeek: 40,
        },
      ],
    },
  });
  console.log(`  ✓ Team "${team.name}" (5 membros)`);

  // ─── 8. Sprints ────────────────────────────────────────────────────────────
  const now = new Date();

  // Two sprints closed before the current PI, so velocity and predictability
  // have a trend instead of a single point. Closed sprints must carry both
  // capacity and velocity: the team console derives its velocity chart and
  // predictability ratio from that pair, and skips any sprint missing either.
  await db.sprint.createMany({
    data: [
      {
        tenantId: TENANT_ID,
        teamId: team.id,
        name: "Sprint -1 — Discovery",
        goal: "Descobrir domínio SAFe e desenhar o modelo de dados",
        startDate: addWeeks(now, -8),
        endDate: addWeeks(now, -6),
        status: "CLOSED",
        capacity: 40,
        velocity: 30,
        closedAt: addWeeks(now, -6),
      },
      {
        tenantId: TENANT_ID,
        teamId: team.id,
        name: "Sprint 0 — Setup",
        goal: "Preparar pipeline, ambientes e observabilidade",
        startDate: addWeeks(now, -6),
        endDate: addWeeks(now, -4),
        status: "CLOSED",
        capacity: 40,
        velocity: 36,
        closedAt: addWeeks(now, -4),
      },
    ],
  });

  const sprint1 = await db.sprint.create({
    data: {
      tenantId: TENANT_ID,
      teamId: team.id,
      name: "Sprint 1 — Foundation",
      goal: "Implementar infraestrutura base e auth multi-tenant",
      startDate: addWeeks(now, -4),
      endDate: addWeeks(now, -2),
      // "CLOSED", not "COMPLETED": every reader of a finished sprint
      // (getTeamDetail, closeSprint's history query, the snapshot backfill)
      // matches on "CLOSED", so the old value made this sprint invisible to
      // all of them — the team console reported "nenhuma sprint fechada".
      status: "CLOSED",
      capacity: 40,
      velocity: 34,
      closedAt: addWeeks(now, -2),
    },
  });
  const sprint2 = await db.sprint.create({
    data: {
      tenantId: TENANT_ID,
      teamId: team.id,
      name: "Sprint 2 — Portfolio Core",
      goal: "Entregar temas estratégicos, épicos e OKRs funcionais",
      startDate: addWeeks(now, -2),
      endDate: addWeeks(now, 0),
      status: "ACTIVE",
      capacity: 40,
    },
  });
  await db.sprint.create({
    data: {
      tenantId: TENANT_ID,
      teamId: team.id,
      name: "Sprint 3 — AI Features",
      goal: "Iniciar AI Risk Copilot e dependency detection",
      startDate: addWeeks(now, 0),
      endDate: addWeeks(now, 2),
      status: "PLANNING",
      capacity: 40,
    },
  });
  console.log("  ✓ 5 Sprints (3 CLOSED com velocity, 1 ACTIVE, 1 PLANNING)");

  // ─── 9. SprintReview + Retrospectiva ───────────────────────────────────────
  await db.sprintReview.create({
    data: {
      tenantId: TENANT_ID,
      sprintId: sprint1.id,
      velocity: 38,
      goalMet: true,
      demoNotes:
        "Auth multi-tenant entregue. DnD do Kanban demonstrado com sucesso. Feedback positivo do PO.",
    },
  });
  await db.retrospective.create({
    data: {
      tenantId: TENANT_ID,
      sprintId: sprint1.id,
      wentWell: [
        "Pair programming acelerou resolução de bugs críticos",
        "CI/CD zerou deploys manuais",
        "Ambiente de staging estável durante toda a sprint",
      ],
      toImprove: [
        "Refinamento de histórias precisa começar mais cedo",
        "Testes E2E deixados para o final — integrar na DoD",
      ],
      actions: [
        {
          title: "Adicionar E2E à DoD",
          owner: "Eva Costa",
          dueDate: "sprint-2",
        },
        {
          title: "Refinamento às terças a partir do sprint 3",
          owner: "Bruno Melo",
          dueDate: "sprint-3",
        },
      ],
    },
  });
  console.log("  ✓ SprintReview + Retrospectiva (Sprint 1)");

  // ─── 10. PI Plan ───────────────────────────────────────────────────────────
  const piPlan = await db.pIPlan.create({
    data: {
      tenantId: TENANT_ID,
      artId: art.id,
      name: "PI 2026-Q2",
      startDate: addWeeks(now, -4),
      endDate: addWeeks(now, 6),
      // Mid-flight, matching the dates above. Not the "DRAFT" default: the PI
      // Planning and Program Board screens both resolve the *active* PI via
      // status in (PLANNING, COMMITTED, EXECUTING), so a DRAFT plan leaves
      // both rendering "Nenhum PI ativo" no matter how much else is seeded.
      status: "EXECUTING",
    },
  });
  console.log(`  ✓ PI Plan "${piPlan.name}"`);

  // Sprints are created before the PI exists, so the link is set here. The
  // capacity grid (listTeamCapacityAcrossPI) selects sprints by piPlanId —
  // unlinked sprints leave it with no columns even when snapshots exist.
  await db.sprint.updateMany({
    where: { tenantId: TENANT_ID, teamId: team.id },
    data: { piPlanId: piPlan.id },
  });

  // One capacity snapshot per started sprint — backs the "Capacidade" KPI on
  // the team console (latest snapshot) and the per-sprint capacity grid. The
  // PLANNING sprint is excluded on purpose: a snapshot carries delivered story
  // points, which a sprint that has not started cannot have.
  const sprintsForCapacity = await db.sprint.findMany({
    where: {
      tenantId: TENANT_ID,
      teamId: team.id,
      status: { in: ["CLOSED", "ACTIVE"] },
    },
    orderBy: { startDate: "asc" },
    select: { id: true, capacity: true, velocity: true },
  });
  await db.teamCapacitySnapshot.createMany({
    data: sprintsForCapacity.map((s, i) => {
      const expected = s.capacity ?? 40;
      // Closed sprints report what they actually delivered; the in-flight one
      // is still tracking against plan.
      const actual = s.velocity ?? Math.round(expected * 0.8);
      return {
        tenantId: TENANT_ID,
        teamId: team.id,
        sprintId: s.id,
        totalMembersCommitted: 5,
        totalCapacityFactor: 0.8,
        expectedSpNextSprint: expected,
        minCapacityEstimate: Math.round(expected * 0.85),
        maxCapacityEstimate: Math.round(expected * 1.15),
        actualSpDelivered: actual,
        actualCapacityUtil: actual / expected,
        recordedAt: addWeeks(now, -8 + i * 2),
      };
    }),
  });
  console.log(
    `  ✓ ${sprintsForCapacity.length} TeamCapacitySnapshots (1 por sprint iniciada)`
  );

  // Confidence vote (fist-of-five) — the PI Planning "Confiança média" KPI
  // reads ConfidenceVoteTally.aggregateScore for the plan, which requires the
  // PISession → ConfidenceVoteSession → tally chain to exist.
  const piSession = await db.pISession.create({
    data: {
      tenantId: TENANT_ID,
      piPlanId: piPlan.id,
      type: "PLANNING",
      scheduledAt: addWeeks(now, -4),
      notes: "PI Planning presencial — 1 ART, 1 time.",
    },
  });
  const voteSession = await db.confidenceVoteSession.create({
    data: {
      tenantId: TENANT_ID,
      piSessionId: piSession.id,
      roundNumber: 1,
      xStateStatus: "CLOSED",
      votes: [4, 4, 5, 3, 4],
      averageScore: 4,
    },
  });
  await db.confidenceVoteTally.create({
    data: {
      tenantId: TENANT_ID,
      voteSessionId: voteSession.id,
      piPlanId: piPlan.id,
      round: 1,
      score3Count: 1,
      score4Count: 3,
      score5Count: 1,
      totalVotes: 5,
      participantCount: 5,
      participationRate: 1,
      aggregateScore: 4,
      revealedAt: addWeeks(now, -4),
      closedAt: addWeeks(now, -4),
      facilitatorNote: "Confiança acima do threshold — PI comprometido.",
    },
  });
  console.log("  ✓ PISession + ConfidenceVote (fist-of-five, média 4.0)");

  await db.pIObjective.createMany({
    data: [
      {
        tenantId: TENANT_ID,
        piPlanId: piPlan.id,
        teamId: team.id,
        title: "Lançar Portfolio Kanban em produção",
        businessValue: 9,
        isStretch: false,
        status: "IN_PROGRESS",
      },
      {
        tenantId: TENANT_ID,
        piPlanId: piPlan.id,
        teamId: team.id,
        title: "Implementar OKRs de portfolio",
        businessValue: 8,
        isStretch: false,
        status: "IN_PROGRESS",
      },
      {
        tenantId: TENANT_ID,
        piPlanId: piPlan.id,
        teamId: team.id,
        title: "Zero erros críticos em produção",
        businessValue: 10,
        isStretch: false,
        status: "IN_PROGRESS",
      },
      {
        tenantId: TENANT_ID,
        piPlanId: piPlan.id,
        teamId: team.id,
        title: "AI Risk Copilot MVP",
        businessValue: 7,
        isStretch: true,
        status: "NOT_STARTED",
      },
    ],
  });
  console.log("  ✓ 4 PI Objectives (3 committed + 1 stretch)");

  // ─── 11. Temas Estratégicos ────────────────────────────────────────────────
  console.log("\n  Criando temas estratégicos, OKRs e KRs...");

  const theme1 = await db.strategicTheme.create({
    data: {
      tenantId: TENANT_ID,
      code: "THEME-001",
      title: "Acelerar time-to-market enterprise",
      description:
        "Reduzir lead time de épicos críticos para clientes enterprise via SAFe + automação.",
      color: "#6366f1",
      horizon: "2026",
      themeType: "GROWTH",
      status: "ACTIVE",
      budgetTotal: 2_500_000,
      order: 0,
    },
  });
  const theme2 = await db.strategicTheme.create({
    data: {
      tenantId: TENANT_ID,
      code: "THEME-002",
      title: "Inovação com IA aplicada ao SAFe",
      description:
        "AI Copilots em PI Planning, risk scoring e dependency detection.",
      color: "#8b5cf6",
      horizon: "H1 2026",
      themeType: "INNOVATION",
      status: "ACTIVE",
      budgetTotal: 1_800_000,
      order: 1,
    },
  });
  const theme3 = await db.strategicTheme.create({
    data: {
      tenantId: TENANT_ID,
      code: "THEME-003",
      title: "Compliance & Segurança Enterprise",
      description:
        "LGPD, SOC2, multi-tenant RLS e auditoria completa para vendas enterprise.",
      color: "#ef4444",
      horizon: "2026",
      themeType: "COMPLIANCE",
      status: "APPROVED",
      budgetTotal: 1_200_000,
      order: 2,
    },
  });

  await db.themeART.createMany({
    data: [
      { themeId: theme1.id, artId: art.id },
      { themeId: theme2.id, artId: art.id },
      { themeId: theme3.id, artId: art.id },
    ],
  });

  // ─── 12. OKRs + Key Results + Snapshots ───────────────────────────────────
  const okrDefs = [
    {
      theme: theme1,
      title: "Reduzir lead time de portfolio em 40%",
      krs: [
        {
          title: "Lead time médio de épicos",
          metric: "Lead time",
          baseline: 90,
          current: 65,
          target: 54,
          unit: "dias",
          measurementType: "absolute" as const,
        },
        {
          title: "Predictability score do portfólio",
          metric: "Predictability",
          baseline: 60,
          current: 72,
          target: 90,
          unit: "%",
          measurementType: "percentage" as const,
        },
        {
          title: "Épicos entregues por PI",
          metric: "Throughput",
          baseline: 5,
          current: 8,
          target: 12,
          unit: "épicos",
          measurementType: "absolute" as const,
        },
      ],
    },
    {
      theme: theme2,
      title: "Lançar 3 features de IA em produção",
      krs: [
        {
          title: "Features de IA em GA",
          metric: "Features GA",
          baseline: 0,
          current: 1,
          target: 3,
          unit: "features",
          measurementType: "absolute" as const,
        },
        {
          title: "Adoção de Risk Copilot por RTEs",
          metric: "Adoção %",
          baseline: 0,
          current: 12,
          target: 50,
          unit: "%",
          measurementType: "percentage" as const,
        },
      ],
    },
    {
      theme: theme3,
      title: "Atingir SOC2 Type II + LGPD compliance pleno",
      krs: [
        {
          title: "Controles SOC2 implementados",
          metric: "Controles SOC2",
          baseline: 10,
          current: 18,
          target: 64,
          unit: "controles",
          measurementType: "absolute" as const,
        },
        {
          title: "Cobertura de audit log",
          metric: "% auditado",
          baseline: 0,
          current: 45,
          target: 100,
          unit: "%",
          measurementType: "percentage" as const,
        },
      ],
    },
  ];

  for (const def of okrDefs) {
    const okr = await db.oKR.create({
      data: {
        tenantId: TENANT_ID,
        type: "portfolio_theme",
        strategicThemeId: def.theme.id,
        title: def.title,
        horizon: "2026",
        status: "ON_TRACK",
      },
    });
    for (const kr of def.krs) {
      const keyResult = await db.keyResult.create({
        data: { tenantId: TENANT_ID, okrId: okr.id, ...kr },
      });
      await db.keyResultSnapshot.createMany({
        data: [
          {
            tenantId: TENANT_ID,
            keyResultId: keyResult.id,
            value: kr.baseline,
            note: "Baseline inicial",
            recordedAt: addWeeks(now, -8),
          },
          {
            tenantId: TENANT_ID,
            keyResultId: keyResult.id,
            value: kr.current * 0.6,
            note: "Check-in mid-quarter",
            recordedAt: addWeeks(now, -4),
          },
          {
            tenantId: TENANT_ID,
            keyResultId: keyResult.id,
            value: kr.current,
            note: "Check-in PI 2026-Q2",
            recordedAt: addDays(now, -3),
          },
        ],
      });
    }
  }
  console.log(
    "  ✓ 3 Temas + 3 OKRs + 7 Key Results + snapshots + 3 ThemeART links"
  );

  // ─── 13. Épicos ────────────────────────────────────────────────────────────
  console.log("\n  Criando épicos, features e dependências...");

  // lifecycleStatus is what the Kanban de Épicos board columns read — it is a
  // separate field from statusId, so setting only statusId (as this seed used
  // to) left all three epics stacked in Funnel. The Lean Business Case fields
  // below (wsjf/sizePoints/INVEST/hypothesis/outcomes/budget) are what the epic
  // detail screen renders; unset, every KPI on it reads "—".
  const epicMain = await db.epic.create({
    data: {
      tenantId: TENANT_ID,
      title: "Portfolio Kanban & OKR Dashboard",
      statusId: "IMPLEMENTING",
      lifecycleStatus: "IMPLEMENTING",
      order: 0,
      lifecycleOrder: 0,
      strategicThemeId: theme1.id,
      wsjf: wsjf(20, 13, 8, 8),
      sizePoints: 8,
      hot: true,
      leanBudgetAllocation: 850_000,
      investScore: 82,
      investBreakdown: investBreakdown(
        [85, 75, 95, 80, 70, 85],
        "Escopo fechado, valor de negócio claro e fatiável por sprint."
      ),
      hypothesis:
        "Acreditamos que consolidar portfólio e OKRs em um board único reduz o tempo de preparação de review de portfólio de 2 dias para menos de 2 horas.",
      businessOutcomes: lbc(
        "Reduzir o tempo de consolidação de status de portfólio em 80%",
        "Elevar a taxa de OKRs com progresso atualizado para 90%"
      ),
      leadingIndicators: lbc(
        "Épicos com WSJF calculado nos últimos 30 dias",
        "Key results atualizados por ciclo"
      ),
    },
  });
  const epicAI = await db.epic.create({
    data: {
      tenantId: TENANT_ID,
      title: "AI-Powered Risk Copilot",
      statusId: "ANALYSIS",
      lifecycleStatus: "ANALYZING",
      order: 1,
      lifecycleOrder: 0,
      strategicThemeId: theme2.id,
      wsjf: wsjf(13, 8, 13, 5),
      sizePoints: 5,
      leanBudgetAllocation: 420_000,
      investScore: 64,
      investBreakdown: investBreakdown(
        [60, 70, 80, 45, 65, 65],
        "Valor claro, mas a estimativa depende de validar o custo de inferência."
      ),
      hypothesis:
        "Acreditamos que sugerir mitigação de riscos a partir do histórico do ART aumenta a proporção de riscos movidos de Identified para Owned na mesma sprint.",
      businessOutcomes: lbc(
        "Aumentar a taxa de riscos com dono definido em 40%",
        "Reduzir riscos que chegam ao fim do PI sem mitigação"
      ),
      leadingIndicators: lbc(
        "Sugestões de mitigação aceitas por sprint",
        "Tempo médio entre identificação e ROAM do risco"
      ),
    },
  });
  const epicSec = await db.epic.create({
    data: {
      tenantId: TENANT_ID,
      title: "SAML SSO & SCIM Provisioning",
      statusId: "BACKLOG",
      lifecycleStatus: "FUNNEL",
      order: 2,
      lifecycleOrder: 0,
      strategicThemeId: theme3.id,
      wsjf: wsjf(8, 5, 13, 13),
      sizePoints: 13,
      leanBudgetAllocation: 300_000,
      investScore: 48,
      investBreakdown: investBreakdown(
        [40, 55, 70, 35, 40, 50],
        "Hipótese ainda vaga e job size alto — precisa de refinamento antes do gate."
      ),
      hypothesis:
        "Acreditamos que SSO corporativo e provisionamento automático removem o bloqueio de segurança citado em negociações enterprise.",
      businessOutcomes: lbc(
        "Destravar contas enterprise bloqueadas por requisito de SSO"
      ),
      leadingIndicators: lbc("Contas enterprise com SSO configurado"),
    },
  });
  console.log(
    "  ✓ 3 Épicos (IMPLEMENTING, ANALYZING, FUNNEL) com LBC completo"
  );

  // ─── 14. Features ──────────────────────────────────────────────────────────
  const featKanban = await db.feature.create({
    data: {
      tenantId: TENANT_ID,
      epicId: epicMain.id,
      piPlanId: piPlan.id,
      // The Program Board derives its swimlanes from feature.assignedTeamId —
      // features in the PI with no assigned team leave the board at "0 times".
      assignedTeamId: team.id,
      title: "Portfolio Kanban Board (5 colunas SAFe)",
      statusId: "DONE",
      bv: 20,
      tc: 13,
      rr: 5,
      js: 8,
      wsjfScore: wsjf(20, 13, 5, 8),
      storyPoints: 13,
      assigneeUserId: userId,
      completedAt: addDays(now, -7),
    },
  });
  const featOKR = await db.feature.create({
    data: {
      tenantId: TENANT_ID,
      epicId: epicMain.id,
      piPlanId: piPlan.id,
      assignedTeamId: team.id,
      title: "OKR Dashboard com Key Results",
      statusId: "IMPLEMENTING",
      bv: 13,
      tc: 8,
      rr: 5,
      js: 5,
      wsjfScore: wsjf(13, 8, 5, 5),
      storyPoints: 8,
      assigneeUserId: userId,
    },
  });
  const featRisk = await db.feature.create({
    data: {
      tenantId: TENANT_ID,
      epicId: epicAI.id,
      piPlanId: piPlan.id,
      assignedTeamId: team.id,
      title: "Risk Score Engine baseado em histórico de entregas",
      statusId: "BACKLOG",
      bv: 13,
      tc: 8,
      rr: 8,
      js: 3,
      wsjfScore: wsjf(13, 8, 8, 3),
      storyPoints: 8,
    },
  });
  const featSaml = await db.feature.create({
    data: {
      tenantId: TENANT_ID,
      epicId: epicSec.id,
      title: "SAML 2.0 IdP Integration (Okta, Azure AD)",
      statusId: "BACKLOG",
      bv: 13,
      tc: 13,
      rr: 8,
      js: 5,
      wsjfScore: wsjf(13, 13, 8, 5),
      storyPoints: 8,
    },
  });
  console.log("  ✓ 4 Features (DONE, IMPLEMENTING, BACKLOG x2)");

  // ─── 15. DependencyLink ────────────────────────────────────────────────────
  await db.dependencyLink.create({
    data: {
      tenantId: TENANT_ID,
      blockingFeatureId: featKanban.id,
      blockedFeatureId: featOKR.id,
      type: "technical",
      severity: "high",
      status: "completed",
      description:
        "OKR Dashboard requer Kanban Board concluído para exibir épicos vinculados a OKRs.",
    },
  });
  await db.dependencyLink.create({
    data: {
      tenantId: TENANT_ID,
      blockingFeatureId: featOKR.id,
      blockedFeatureId: featRisk.id,
      type: "business",
      severity: "medium",
      status: "on-track",
      description:
        "Risk Score Engine depende dos dados de OKRs para calcular impacto de risco.",
      dueDate: addWeeks(now, 4),
    },
  });
  console.log("  ✓ 2 DependencyLinks entre features");

  // ─── 15b. Governança de portfólio ──────────────────────────────────────────
  // Backs three screens that render entirely from these tables and were
  // otherwise empty: Governance Board (GovernedEpic + the approval chain),
  // Decision Log (DecisionLogEntry) and Lean Budgets (LeanBudget).
  const gateWorkflow = await db.approvalWorkflow.create({
    data: {
      tenantId: TENANT_ID,
      tipo: "epic_investment",
      nome: "Aprovação de Épico de Portfólio",
      etapas: [
        {
          order: 1,
          roleRequired: "lpm",
          criteria: "Aderência ao tema e ao WSJF",
        },
        {
          order: 2,
          roleRequired: "enterprise_architect",
          criteria: "Viabilidade técnica e impacto arquitetural",
        },
        {
          order: 3,
          roleRequired: "cfo",
          criteria: "Investimento dentro do guardrail",
        },
      ],
    },
  });

  // Approved: already through every gate.
  await db.governedEpic.create({
    data: {
      tenantId: TENANT_ID,
      epicId: epicMain.id,
      valueStreamId: art.id,
      themeId: theme1.id,
      investmentEstimate: 850_000,
      governanceStatus: "approved",
      submittedBy: userId,
      submittedAt: addWeeks(now, -5),
    },
  });

  // In review: the gate pipeline mid-flight — step 1 approved, step 2 with the
  // enterprise architect, step 3 still queued. This is the row the board's
  // "aguardando decisão" KPI counts.
  const governedAI = await db.governedEpic.create({
    data: {
      tenantId: TENANT_ID,
      epicId: epicAI.id,
      valueStreamId: art.id,
      themeId: theme2.id,
      investmentEstimate: 420_000,
      governanceStatus: "review",
      submittedBy: userId,
      submittedAt: addWeeks(now, -1),
      currentStepIndex: 1,
    },
  });
  const aiRequest = await db.approvalRequest.create({
    data: {
      tenantId: TENANT_ID,
      workflowId: gateWorkflow.id,
      targetType: "epic",
      targetId: epicAI.id,
      governedEpicId: governedAI.id,
      estado: "in_review",
      initiatorId: userId,
      stepIndex: 1,
      steps: {
        create: [
          {
            tenantId: TENANT_ID,
            etapaOrdem: 1,
            roleRequired: "lpm",
            estado: "approved",
            approverId: userId,
            comentario:
              "WSJF alto e alinhado ao tema de IA. Segue para arquitetura.",
            timestamp: addDays(now, -5),
          },
          {
            tenantId: TENANT_ID,
            etapaOrdem: 2,
            roleRequired: "enterprise_architect",
            estado: "pending",
            slaDeadline: addDays(now, 2),
          },
          {
            tenantId: TENANT_ID,
            etapaOrdem: 3,
            roleRequired: "cfo",
            estado: "pending",
            slaDeadline: addDays(now, 5),
          },
        ],
      },
    },
  });
  await db.governedEpic.update({
    where: { id: governedAI.id },
    data: { currentApprovalRequestId: aiRequest.id },
  });

  // Draft: entered governance but not yet submitted to the gate.
  await db.governedEpic.create({
    data: {
      tenantId: TENANT_ID,
      epicId: epicSec.id,
      valueStreamId: art.id,
      themeId: theme3.id,
      investmentEstimate: 300_000,
      governanceStatus: "draft",
    },
  });
  console.log(
    "  ✓ ApprovalWorkflow + 3 GovernedEpics (approved / review com gate / draft)"
  );

  await db.decisionLogEntry.createMany({
    data: [
      {
        tenantId: TENANT_ID,
        tipo: "epic_decision",
        targetType: "epic",
        targetId: epicMain.id,
        valueStreamId: art.id,
        decisao: "approved",
        titulo: "Aprovar Portfolio Kanban & OKR Dashboard",
        justificativa:
          "WSJF mais alto do funil e dependência direta do OKR de lead time. Investimento dentro do guardrail do tema.",
        decisorId: userId,
        dataDecisao: addWeeks(now, -5),
        tags: ["portfolio", "wsjf"],
      },
      {
        tenantId: TENANT_ID,
        tipo: "epic_decision",
        targetType: "epic",
        targetId: epicSec.id,
        valueStreamId: art.id,
        decisao: "deferred",
        titulo: "Adiar SAML SSO & SCIM para o próximo PI",
        justificativa:
          "Job size alto e hipótese ainda vaga. Refinar o Lean Business Case antes de consumir orçamento.",
        decisorId: userId,
        dataDecisao: addWeeks(now, -2),
        tags: ["compliance"],
      },
      {
        tenantId: TENANT_ID,
        tipo: "budget_decision",
        targetType: "theme",
        targetId: theme2.id,
        decisao: "changed",
        titulo: "Realocar orçamento para Inovação com IA",
        justificativa:
          "Realocação de 8% do tema de compliance para IA aplicada, acompanhando a demanda do board.",
        decisorId: userId,
        dataDecisao: addWeeks(now, -1),
        tags: ["budget", "realocação"],
      },
    ],
  });
  console.log("  ✓ 3 DecisionLogEntries (approved / deferred / changed)");

  // One budget, not one per theme: LeanBudget is @@unique([artId, piPlanId]),
  // i.e. it models the ART's budget for a given PI. Per-theme allocation is
  // already carried by StrategicTheme.budgetTotal / targetAllocationPct.
  await db.leanBudget.create({
    data: {
      tenantId: TENANT_ID,
      artId: art.id,
      piPlanId: piPlan.id,
      themeId: theme1.id,
      name: "Plataforma COSMOS · PI 2026-Q2",
      amount: 5_500_000,
      spent: 2_120_000,
      capexPct: 55,
      opexPct: 45,
      spendLimitUsd: 6_000_000,
      approvalThresholdUsd: 500_000,
      period: "PI 2026-Q2",
    },
  });
  console.log("  ✓ 1 LeanBudget do ART no PI (alocado vs. consumido)");

  // ─── 16. Stories em todos os status ────────────────────────────────────────
  console.log("\n  Criando stories (todos os status)...");

  const storyDone = await db.story.create({
    data: {
      tenantId: TENANT_ID,
      featureId: featKanban.id,
      sprintId: sprint1.id,
      title: "Drag-and-drop entre colunas do Kanban",
      description:
        "Arrastar épico entre colunas SAFe (Backlog → Review → Analysis → Implementing → Done).",
      acceptanceCriteria:
        "- DnD funciona em mouse e touch\n- Persiste no banco via server action\n- Optimistic update sem flicker",
      storyPoints: 8,
      status: "DONE",
      priority: "critical",
      order: 0,
      assigneeUserId: userId,
      completedAt: addDays(now, -10),
    },
  });
  const storyReview = await db.story.create({
    data: {
      tenantId: TENANT_ID,
      featureId: featOKR.id,
      sprintId: sprint2.id,
      title: "Filtrar OKRs por horizonte (2026, H1, H2)",
      description:
        "Dropdown para filtrar por horizonte com URL state (searchParams).",
      acceptanceCriteria:
        "- URL reflete filtro selecionado\n- Reset limpa filtro\n- Funciona sem JS via searchParams",
      storyPoints: 2,
      status: "REVIEW",
      priority: "medium",
      order: 0,
      assigneeUserId: userId,
    },
  });
  const storyInProgress = await db.story.create({
    data: {
      tenantId: TENANT_ID,
      featureId: featOKR.id,
      sprintId: sprint2.id,
      title: "Criar/editar OKR via modal",
      description:
        "Formulário com campos: título, descrição, horizonte, status. Salva via server action.",
      acceptanceCriteria:
        "- Form valida campos obrigatórios\n- Salva via server action\n- Toast de sucesso/erro\n- Fecha modal após salvar",
      storyPoints: 5,
      status: "IN_PROGRESS",
      priority: "critical",
      order: 1,
      assigneeUserId: userId,
    },
  });
  const storyTodo = await db.story.create({
    data: {
      tenantId: TENANT_ID,
      featureId: featOKR.id,
      sprintId: sprint2.id,
      title: "Gráfico de progresso por Key Result",
      description:
        "Gauge/progress bar mostrando baseline → current → target para cada KR.",
      acceptanceCriteria:
        "- Gauge visível para cada KR\n- Tooltip com valores numéricos\n- Cor muda com status",
      storyPoints: 3,
      status: "TODO",
      priority: "high",
      order: 2,
      assigneeUserId: userId,
    },
  });
  const storyBacklog = await db.story.create({
    data: {
      tenantId: TENANT_ID,
      featureId: featOKR.id,
      sprintId: sprint2.id,
      title: "Exibir lista de OKRs agrupados por tema",
      description:
        "Como LPM, quero ver todos os OKRs agrupados por tema estratégico.",
      acceptanceCriteria:
        "- Lista carrega em < 2s\n- Agrupamento por tema correto\n- Sem erros de hidratação",
      storyPoints: 3,
      status: "BACKLOG",
      priority: "high",
      order: 3,
    },
  });
  const storyRisk = await db.story.create({
    data: {
      tenantId: TENANT_ID,
      featureId: featRisk.id,
      sprintId: sprint2.id,
      title: "Definir modelo de scoring de riscos SAFe",
      description:
        "Pesquisar e definir algoritmo base para risk score baseado em histórico de PIs.",
      acceptanceCriteria:
        "- ADR aprovado\n- Modelo validado com dados históricos",
      storyPoints: 3,
      status: "TODO",
      priority: "medium",
      order: 0,
    },
  });
  // featSaml (BACKLOG, sem sprint) é a única feature sem story antes desta —
  // sem ela o drill-down do épico de segurança fica sem ramo para expandir.
  const storySaml = await db.story.create({
    data: {
      tenantId: TENANT_ID,
      featureId: featSaml.id,
      title: "Configurar metadata SAML do IdP (Okta)",
      description:
        "Cadastrar Entity ID, ACS URL e certificado do IdP Okta para o primeiro tenant piloto.",
      acceptanceCriteria:
        "- Metadata XML do Okta importado e validado\n- Login SAML redireciona corretamente para o ACS URL\n- Certificado expirado é rejeitado com erro claro",
      storyPoints: 5,
      status: "BACKLOG",
      priority: "high",
      order: 0,
    },
  });
  console.log("  ✓ 7 Stories (DONE, REVIEW, IN_PROGRESS, TODO x2, BACKLOG x2)");

  // ─── 17. Tasks em todos os status ──────────────────────────────────────────
  console.log("\n  Criando tasks (todos os status)...");

  await db.task.createMany({
    data: [
      {
        tenantId: TENANT_ID,
        storyId: storyInProgress.id,
        title: "Criar schema Zod para formulário de OKR",
        status: "DONE",
        assigneeUserId: userId,
        estimateHours: 2,
        completedAt: addDays(now, -2),
      },
      {
        tenantId: TENANT_ID,
        storyId: storyInProgress.id,
        title: "Implementar server action createOKR / updateOKR",
        status: "IN_PROGRESS",
        assigneeUserId: userId,
        estimateHours: 3,
      },
      {
        tenantId: TENANT_ID,
        storyId: storyInProgress.id,
        title: "Construir componente OKRFormModal",
        status: "IN_PROGRESS",
        assigneeUserId: userId,
        estimateHours: 4,
      },
      {
        tenantId: TENANT_ID,
        storyId: storyInProgress.id,
        title: "Adicionar toast de sucesso/erro com Sonner",
        status: "TODO",
        estimateHours: 1,
      },
      {
        tenantId: TENANT_ID,
        storyId: storyInProgress.id,
        title: "Escrever testes E2E do modal de OKR",
        status: "TODO",
        estimateHours: 2,
      },
    ],
  });
  await db.task.createMany({
    data: [
      {
        tenantId: TENANT_ID,
        storyId: storyTodo.id,
        title: "Pesquisar biblioteca de gauge/radial para Radix UI",
        status: "DONE",
        assigneeUserId: userId,
        estimateHours: 1,
        completedAt: addDays(now, -1),
      },
      {
        tenantId: TENANT_ID,
        storyId: storyTodo.id,
        title: "Implementar componente KeyResultProgress",
        status: "TODO",
        estimateHours: 3,
      },
    ],
  });
  await db.task.createMany({
    data: [
      {
        tenantId: TENANT_ID,
        storyId: storyDone.id,
        title: "Integrar @dnd-kit/core no Portfolio Kanban",
        status: "DONE",
        assigneeUserId: userId,
        estimateHours: 4,
        completedAt: addDays(now, -12),
      },
      {
        tenantId: TENANT_ID,
        storyId: storyDone.id,
        title: "Server action updateEpicStatus com optimistic UI",
        status: "DONE",
        assigneeUserId: userId,
        estimateHours: 3,
        completedAt: addDays(now, -11),
      },
    ],
  });
  // storyBacklog, storyRisk e storySaml eram os únicos ramos do drill-down
  // que paravam na Story: sem task aqui, "toda Story tem Task" falha.
  await db.task.createMany({
    data: [
      {
        tenantId: TENANT_ID,
        storyId: storyBacklog.id,
        title: "Mapear campos de agrupamento por tema estratégico",
        status: "TODO",
        estimateHours: 2,
      },
      {
        tenantId: TENANT_ID,
        storyId: storyRisk.id,
        title: "Levantar histórico de PIs para calibrar o modelo de scoring",
        status: "TODO",
        estimateHours: 3,
      },
      {
        tenantId: TENANT_ID,
        storyId: storySaml.id,
        title: "Importar e validar metadata XML do IdP Okta",
        status: "TODO",
        estimateHours: 3,
      },
    ],
  });
  console.log("  ✓ 12 Tasks (5 TODO, 2 IN_PROGRESS, 5 DONE)");

  // ─── SeedContext (montado aqui, não só no final) ───────────────────────────
  // Fields cast with `as MemberRole` are keys that ROLE_USERS always
  // populates (ADMIN above the loop, the six ROLE_USERS entries inside it) —
  // Partial<Record<...>> is only needed to build the map incrementally.
  const context: SeedContext = {
    prisma: db,
    tenantId: TENANT_ID,
    tenantSlug: TENANT_SLUG,
    users: roleUserIds as Record<MemberRole, string>,
    artIds: [art.id],
    teamIds: [team.id],
    epicIds: [epicMain.id, epicAI.id, epicSec.id],
    featureIds: [featKanban.id, featOKR.id, featRisk.id, featSaml.id],
    storyIds: [
      storyDone.id,
      storyReview.id,
      storyInProgress.id,
      storyTodo.id,
      storyBacklog.id,
      storyRisk.id,
      storySaml.id,
    ],
    piPlanIds: [piPlan.id],
    themeIds: [theme1.id, theme2.id, theme3.id],
  };

  // ─── 17b. Integrations e tasks importadas/nativas ──────────────────────────
  await seedIntegrations(context);

  // ─── 17c. Large Solution (SolutionTrain, Capability, LACE members, ────────
  //          Supplier, SolutionRisk, CrossArtDependency) ─────────────────────
  await seedLargeSolution(context);

  // ─── 18. Risks (ROAM completo) ─────────────────────────────────────────────
  console.log("\n  Criando riscos, impedimentos e defeitos...");

  await db.risk.createMany({
    data: [
      {
        tenantId: TENANT_ID,
        piPlanId: piPlan.id,
        title: "Dependência de API externa sem SLA garantido",
        // roamStatus is a field of its own, separate from status — the PI
        // Planning ROAM panel reads it, so risks classified only via `status`
        // showed up as UNCLASSIFIED. Left unset here on purpose: this one is
        // identified but not yet ROAMed, which is what the board should show.
        status: "IDENTIFIED",
        category: "technical",
        impact: "high",
        probability: "medium",
        description:
          "Serviço de autenticação terceiro sem SLA. Plano: implementar fallback local.",
        ownerUserId: userId,
      },
      {
        tenantId: TENANT_ID,
        piPlanId: piPlan.id,
        title: "Capacidade do team reduzida por 2 semanas (férias)",
        status: "OWNED",
        roamStatus: "OWNED",
        category: "organizational",
        impact: "medium",
        probability: "high",
        description:
          "2 devs em férias na semana 3. Plano: priorizar histórias menores e aumentar WIP.",
        ownerUserId: userId,
      },
      {
        tenantId: TENANT_ID,
        piPlanId: piPlan.id,
        title: "Dados históricos incompletos para treinamento do modelo IA",
        status: "MITIGATED",
        roamStatus: "MITIGATED",
        category: "technical",
        impact: "high",
        probability: "low",
        description:
          "Migração de dados concluída. Backfill de 6 meses de histórico realizado.",
        ownerUserId: userId,
      },
      {
        tenantId: TENANT_ID,
        piPlanId: piPlan.id,
        title: "Custo de infraestrutura acima do orçamento do PI",
        status: "ACCEPTED",
        roamStatus: "ACCEPTED",
        category: "financial" as string,
        impact: "medium",
        probability: "medium",
        description:
          "Board aprovou aumento de 15% no budget de infra para o PI. Monitorar mensalmente.",
        ownerUserId: userId,
      },
      {
        tenantId: TENANT_ID,
        piPlanId: piPlan.id,
        title: "Certificação LGPD concluída antes do PI",
        status: "RESOLVED",
        roamStatus: "RESOLVED",
        category: "compliance",
        impact: "critical",
        probability: "low",
        description:
          "DPO confirmou conformidade. Auditoria externa aprovada em 2026-05.",
        ownerUserId: userId,
      },
    ],
  });
  console.log("  ✓ 5 Risks (IDENTIFIED/OWNED/MITIGATED/ACCEPTED/RESOLVED)");

  // ─── 19. Impediments ───────────────────────────────────────────────────────
  await db.impediment.createMany({
    data: [
      {
        tenantId: TENANT_ID,
        teamId: team.id,
        title:
          "Acesso ao ambiente de staging bloqueado pelo firewall corporativo",
        status: "RESOLVED",
        ownerUserId: userId,
        description:
          "TI liberou acesso após ticket #4521. Resolvido em 2 dias.",
        resolvedAt: addDays(now, -8),
      },
      {
        tenantId: TENANT_ID,
        teamId: team.id,
        title: "Licença do Playwright expirada no CI/CD",
        status: "IN_PROGRESS",
        ownerUserId: userId,
        description: "DevOps atualizando pipeline. ETA: fim da semana.",
      },
      {
        tenantId: TENANT_ID,
        teamId: team.id,
        title: "PO indisponível para refinamento na próxima semana",
        status: "OPEN",
        ownerUserId: userId,
        description:
          "Impacta Sprint 3. SM buscando substituto para sessão de refinamento.",
      },
    ],
  });
  console.log("  ✓ 3 Impediments (RESOLVED/IN_PROGRESS/OPEN)");

  // ─── 20. Defects ───────────────────────────────────────────────────────────
  await db.defect.createMany({
    data: [
      {
        tenantId: TENANT_ID,
        teamId: team.id,
        storyId: storyReview.id,
        title: "Filtro de OKR por horizonte não persiste ao recarregar página",
        severity: "high",
        status: "IN_PROGRESS",
        reporterUserId: userId,
        assigneeUserId: userId,
        description:
          "searchParam correto na URL mas estado do componente não inicializa com o valor da URL.",
      },
      {
        tenantId: TENANT_ID,
        teamId: team.id,
        storyId: storyDone.id,
        title: "Drop target não aceita épico quando coluna está vazia",
        severity: "critical",
        status: "RESOLVED",
        reporterUserId: userId,
        assigneeUserId: userId,
        description:
          "Race condition no useDroppable. Corrigido com isOver === true guard.",
        resolvedAt: addDays(now, -9),
      },
      {
        tenantId: TENANT_ID,
        teamId: team.id,
        storyId: storyRisk.id,
        title: "Tooltip do risk score aparece fora da viewport em telas small",
        severity: "medium",
        status: "OPEN",
        reporterUserId: userId,
        description:
          "Reproduzível em viewport 375px. Radix Tooltip precisa de collisionPadding configurado.",
      },
    ],
  });
  console.log(
    "  ✓ 3 Defects (critical RESOLVED / high IN_PROGRESS / medium OPEN)"
  );

  // ─── 21. StandupEntries ────────────────────────────────────────────────────
  console.log("\n  Criando standups e flow metrics...");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = addDays(today, -1);

  await db.standupEntry.upsert({
    where: { teamId_userId_date: { teamId: team.id, userId, date: today } },
    create: {
      tenantId: TENANT_ID,
      teamId: team.id,
      userId,
      date: today,
      yesterday:
        "Implementei server action createOKR com validação Zod e error handling",
      today: "Vou construir OKRFormModal e integrar com server action",
      blockers: null,
    },
    update: {},
  });
  await db.standupEntry.upsert({
    where: { teamId_userId_date: { teamId: team.id, userId, date: yesterday } },
    create: {
      tenantId: TENANT_ID,
      teamId: team.id,
      userId,
      date: yesterday,
      yesterday: "Criei schema Zod para OKR e escrevi testes unitários",
      today: "Implementar server action e começar o modal",
      blockers: "Aguardando design final do modal — desbloqueado pelo PO",
    },
    update: {},
  });
  console.log("  ✓ 2 StandupEntries (hoje + ontem)");

  // ─── 22. FlowMetricSnapshots ───────────────────────────────────────────────
  await db.flowMetricSnapshot.create({
    data: {
      tenantId: TENANT_ID,
      scope: "team",
      scopeId: team.id,
      period: "sprint",
      periodRef: sprint1.id,
      recordedAt: addWeeks(now, -2),
      flowVelocityTotal: 38,
      flowVelocityByType: { story: 28, defect: 5, feature: 5, enabler: 0 },
      flowDistribution: {
        story: 0.58,
        defect: 0.16,
        feature: 0.21,
        enabler: 0.05,
      },
      flowTimeAvgHours: 52,
      flowTimeMedianHours: 42,
      flowTimeByType: { story: 48, defect: 20, feature: 80 },
      flowLoadAvg: 5.2,
      flowLoadCurrent: 5,
      flowEfficiency: 0.68,
      flowPredictability: 0.85,
      plannedItems: 12,
      deliveredItems: 11,
      staleness: "FRESH",
    },
  });
  await db.flowMetricSnapshot.create({
    data: {
      tenantId: TENANT_ID,
      scope: "art",
      scopeId: art.id,
      period: "pi",
      periodRef: piPlan.id,
      recordedAt: addDays(now, -1),
      flowVelocityTotal: 38,
      flowVelocityByType: { story: 28, defect: 5, feature: 5, enabler: 0 },
      flowDistribution: {
        story: 0.6,
        defect: 0.15,
        feature: 0.2,
        enabler: 0.05,
      },
      flowTimeAvgHours: 55,
      flowTimeMedianHours: 44,
      flowTimeByType: { story: 50, defect: 22, feature: 85 },
      flowLoadAvg: 5.0,
      flowLoadCurrent: 5,
      flowEfficiency: 0.65,
      flowPredictability: 0.8,
      plannedItems: 12,
      deliveredItems: 11,
      staleness: "FRESH",
    },
  });
  console.log("  ✓ 2 FlowMetricSnapshots (team/sprint + ART/PI)");

  // ─── 23. CompetencyAssessment + ImprovementActions ─────────────────────────
  const assessment = await db.competencyAssessment.create({
    data: {
      tenantId: TENANT_ID,
      scope: "team",
      scopeId: team.id,
      competency: "TEAM_TECHNICAL_AGILITY",
      score: 3.2,
      assessedAt: addDays(now, -14),
      assessedById: userId,
      piPlanId: piPlan.id,
      notes:
        "Time demonstra boas práticas de CI/CD e TDD, mas pair programming ainda é ad-hoc. Testes E2E ausentes da DoD.",
    },
  });
  await db.competencyAssessment.create({
    data: {
      tenantId: TENANT_ID,
      scope: "art",
      scopeId: art.id,
      competency: "LEAN_AGILE_LEADERSHIP",
      score: 3.8,
      assessedAt: addDays(now, -14),
      assessedById: userId,
      piPlanId: piPlan.id,
      notes:
        "Liderança engajada com SAFe. OKRs visíveis mas não suficientemente conectados às métricas de time.",
    },
  });

  await db.improvementAction.createMany({
    data: [
      {
        tenantId: TENANT_ID,
        assessmentId: assessment.id,
        title: "Institucionalizar pair programming — mínimo 2h/semana por dev",
        description:
          "Derivado da avaliação Team Technical Agility (3.2/5). Criar kanban de pairs no Slack com rotação semanal.",
        scope: "team",
        scopeId: team.id,
        status: "IN_PROGRESS",
        dueDate: addWeeks(now, 4),
        assigneeId: userId,
        source: "manual",
      },
      {
        tenantId: TENANT_ID,
        assessmentId: assessment.id,
        title: "Adicionar testes E2E Playwright à Definition of Done",
        description:
          "Nenhuma story encerra sem ao menos 1 cenário E2E cobrindo o caminho feliz.",
        scope: "team",
        scopeId: team.id,
        status: "OPEN",
        dueDate: addWeeks(now, 2),
        assigneeId: userId,
        source: "manual",
      },
    ],
  });
  console.log(
    "  ✓ 2 CompetencyAssessments (team + ART) + 2 ImprovementActions"
  );

  // ─── 24. PersonSkillProfile ────────────────────────────────────────────────
  await db.personSkillProfile.create({
    data: {
      tenantId: TENANT_ID,
      userId,
      competency: "TEAM_TECHNICAL_AGILITY",
      skillLevel: 4,
      proficiency: 0.82,
      assessedAt: addDays(now, -30),
      assessedBy: userId,
      confidence: 85,
      isDraft: false,
      isVerified: true,
    },
  });
  console.log("  ✓ PersonSkillProfile (admin E2E)");

  // context (SeedContext) já foi montado logo após a criação de Stories/Tasks,
  // acima, para que seedIntegrations pudesse consumi-lo.

  // ─── Resumo ─────────────────────────────────────────────────────────────────
  console.log(
    "\n─────────────────────────────────────────────────────────────────"
  );
  console.log("🎉 seed-e2e concluído! Todas as entidades Cosmos populadas.\n");
  console.log("  Credenciais E2E:");
  console.log(`  Email:    ${E2E_EMAIL}`);
  console.log(`  Senha:    ${E2E_PASSWORD}`);
  console.log(`  Tenant:   COSMOS Dev (${TENANT_SLUG}) — UNIVERSE`);
  console.log("\n  Dados criados:");
  console.log("  Auth & Org");
  console.log("    • LACE (9 princípios SAFe)");
  console.log("    • OnboardingProgress (company_setup concluído)");
  console.log("  SAFe Delivery");
  console.log("    • 1 ART → 1 Time (5 membros)");
  console.log(
    "    • 5 Sprints (3 CLOSED/1 ACTIVE/1 PLANNING) + SprintReview + Retrospectiva"
  );
  console.log("    • 1 PI Plan → 4 PI Objectives (3 committed + 1 stretch)");
  console.log("  Portfolio");
  console.log(
    "    • 3 Temas Estratégicos → 3 OKRs → 7 Key Results + 21 snapshots"
  );
  console.log("    • 3 Épicos → 4 Features → 2 DependencyLinks");
  console.log("    • 7 Stories (todos os status) → 12 Tasks (todos os status)");
  console.log("  Riscos & Qualidade");
  console.log(
    "    • 5 Risks (ROAM: IDENTIFIED/OWNED/MITIGATED/ACCEPTED/RESOLVED)"
  );
  console.log("    • 3 Impediments (OPEN/IN_PROGRESS/RESOLVED)");
  console.log("    • 3 Defects (critical/high/medium)");
  console.log("  Flow & Competências");
  console.log("    • 2 FlowMetricSnapshots (team/sprint + ART/PI)");
  console.log("    • 2 StandupEntries (hoje + ontem)");
  console.log(
    "    • 2 CompetencyAssessments (team + ART) + 2 ImprovementActions"
  );
  console.log("    • 1 PersonSkillProfile");
  console.log("\n  Variáveis para E2E runners:");
  console.log(`  E2E_EMAIL="${E2E_EMAIL}" E2E_PASSWORD="${E2E_PASSWORD}"`);
  console.log(
    "─────────────────────────────────────────────────────────────────\n"
  );

  await db.$disconnect();
  return context;
}

main().catch((err) => {
  console.error("❌ seed-e2e falhou:", err);
  process.exit(1);
});
