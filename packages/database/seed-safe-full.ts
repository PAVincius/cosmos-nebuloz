/**
 * seed-safe-full.ts — SAFe Full Seed: MedCore Tecnologia
 * Software house de saúde (EHR, IA Clínica, Integração FHIR/HL7)
 * 50 funcionários — admin: vinicius.pratesaraujo@gmail.com
 *
 * Uso: pnpm --filter @repo/database seed:safe
 * (lê DATABASE_URL/BETTER_AUTH_* de packages/database/.env via --env-file)
 */

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "./generated/index.js";

// ─── Config ───────────────────────────────────────────────────────────────────
const ADMIN_EMAIL = "vinicius.pratesaraujo@gmail.com";
const DEFAULT_PASS = "Cosmos@2026!";
const TENANT_NAME = "MedCore Tecnologia";
const TENANT_SLUG = "medcore";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ago = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
};
const fwd = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};
const pick = <T>(arr: T[], i: number) => arr[i % arr.length];

// ─── People ───────────────────────────────────────────────────────────────────
const PEOPLE = [
  { email: ADMIN_EMAIL, name: "Vinicius Prates Araújo", role: "ADMIN" },
  {
    email: "carlos.mendes@medcore.com.br",
    name: "Carlos Eduardo Mendes",
    role: "STE",
  },
  {
    email: "ana.rodrigues@medcore.com.br",
    name: "Ana Luísa Rodrigues",
    role: "RTE",
  },
  // POs
  {
    email: "fernanda.costa@medcore.com.br",
    name: "Fernanda Costa",
    role: "PO",
  },
  {
    email: "rafael.oliveira@medcore.com.br",
    name: "Rafael Oliveira",
    role: "PO",
  },
  {
    email: "juliana.santos@medcore.com.br",
    name: "Juliana Santos",
    role: "PO",
  },
  {
    email: "marcos.ferreira@medcore.com.br",
    name: "Marcos Ferreira",
    role: "PO",
  },
  { email: "beatriz.lima@medcore.com.br", name: "Beatriz Lima", role: "PO" },
  // SMs
  { email: "pedro.alves@medcore.com.br", name: "Pedro Alves", role: "SM" },
  { email: "camila.nunes@medcore.com.br", name: "Camila Nunes", role: "SM" },
  {
    email: "lucas.carvalho@medcore.com.br",
    name: "Lucas Carvalho",
    role: "SM",
  },
  {
    email: "tatiana.barbosa@medcore.com.br",
    name: "Tatiana Barbosa",
    role: "SM",
  },
  { email: "diego.martins@medcore.com.br", name: "Diego Martins", role: "SM" },
  // Team 1 — Prontuário (7 devs)
  { email: "gabriel.silva@medcore.com.br", name: "Gabriel Silva", role: "DEV" },
  {
    email: "amanda.pereira@medcore.com.br",
    name: "Amanda Pereira",
    role: "DEV",
  },
  { email: "rodrigo.sousa@medcore.com.br", name: "Rodrigo Sousa", role: "DEV" },
  {
    email: "isabela.nascimento@medcore.com.br",
    name: "Isabela Nascimento",
    role: "DEV",
  },
  {
    email: "felipe.rezende@medcore.com.br",
    name: "Felipe Rezende",
    role: "DEV",
  },
  { email: "natalia.cruz@medcore.com.br", name: "Natalia Cruz", role: "DEV" },
  { email: "thiago.moraes@medcore.com.br", name: "Thiago Moraes", role: "DEV" },
  // Team 2 — IA & Analytics (8 devs)
  {
    email: "leonardo.santos@medcore.com.br",
    name: "Leonardo Santos",
    role: "DEV",
  },
  {
    email: "priscila.gomes@medcore.com.br",
    name: "Priscila Gomes",
    role: "DEV",
  },
  {
    email: "andre.teixeira@medcore.com.br",
    name: "André Teixeira",
    role: "DEV",
  },
  { email: "vanessa.rocha@medcore.com.br", name: "Vanessa Rocha", role: "DEV" },
  { email: "bruno.cardoso@medcore.com.br", name: "Bruno Cardoso", role: "DEV" },
  { email: "carolina.dias@medcore.com.br", name: "Carolina Dias", role: "DEV" },
  {
    email: "guilherme.araujo@medcore.com.br",
    name: "Guilherme Araujo",
    role: "DEV",
  },
  {
    email: "mariana.freitas@medcore.com.br",
    name: "Mariana Freitas",
    role: "DEV",
  },
  // Team 3 — Plataforma Core (8 devs)
  { email: "eduardo.pinto@medcore.com.br", name: "Eduardo Pinto", role: "DEV" },
  { email: "larissa.melo@medcore.com.br", name: "Larissa Melo", role: "DEV" },
  {
    email: "renato.andrade@medcore.com.br",
    name: "Renato Andrade",
    role: "DEV",
  },
  {
    email: "patricia.torres@medcore.com.br",
    name: "Patrícia Torres",
    role: "DEV",
  },
  {
    email: "flavio.ribeiro@medcore.com.br",
    name: "Flávio Ribeiro",
    role: "DEV",
  },
  {
    email: "simone.correia@medcore.com.br",
    name: "Simone Correia",
    role: "DEV",
  },
  {
    email: "victor.fonseca@medcore.com.br",
    name: "Victor Fonseca",
    role: "DEV",
  },
  { email: "aline.batista@medcore.com.br", name: "Aline Batista", role: "DEV" },
  // Team 4 — Integrações HL7 (7 devs)
  {
    email: "henrique.lopes@medcore.com.br",
    name: "Henrique Lopes",
    role: "DEV",
  },
  {
    email: "daniela.castro@medcore.com.br",
    name: "Daniela Castro",
    role: "DEV",
  },
  { email: "marcos.vieira@medcore.com.br", name: "Marcos Vieira", role: "DEV" },
  {
    email: "roberta.mendonca@medcore.com.br",
    name: "Roberta Mendonça",
    role: "DEV",
  },
  { email: "caio.duarte@medcore.com.br", name: "Caio Duarte", role: "DEV" },
  {
    email: "leticia.campos@medcore.com.br",
    name: "Letícia Campos",
    role: "DEV",
  },
  {
    email: "alexandre.ramos@medcore.com.br",
    name: "Alexandre Ramos",
    role: "DEV",
  },
  // Team 5 — Mobile & UX (7 devs)
  {
    email: "gustavo.ferreira@medcore.com.br",
    name: "Gustavo Ferreira",
    role: "DEV",
  },
  { email: "vitoria.gomes@medcore.com.br", name: "Vitória Gomes", role: "DEV" },
  { email: "thales.sousa@medcore.com.br", name: "Thales Sousa", role: "DEV" },
  { email: "monica.alves@medcore.com.br", name: "Monica Alves", role: "DEV" },
  { email: "fabio.costa@medcore.com.br", name: "Fábio Costa", role: "DEV" },
  { email: "raquel.lima@medcore.com.br", name: "Raquel Lima", role: "DEV" },
  {
    email: "otavio.rodrigues@medcore.com.br",
    name: "Otávio Rodrigues",
    role: "DEV",
  },
] as const;

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const { Pool } = require("pg");
  const { PrismaPg } = require("@prisma/adapter-pg");
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
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  });
  const ctx = await auth.$context;

  console.log("\n🏥 MedCore Tecnologia — SAFe Full Seed\n");

  // ── 1. Usuários ─────────────────────────────────────────────────────────────
  const hashedPassword = await ctx.password.hash(DEFAULT_PASS);
  const userMap: Record<string, string> = {}; // email → id

  for (const p of PEOPLE) {
    const user = await db.user.upsert({
      where: { email: p.email },
      create: { email: p.email, name: p.name, emailVerified: true },
      update: { name: p.name, emailVerified: true },
    });
    userMap[p.email] = user.id;

    const hasAcct = await db.account.findFirst({
      where: { userId: user.id, providerId: "credential" },
    });
    if (!hasAcct) {
      await db.account.create({
        data: {
          accountId: p.email,
          providerId: "credential",
          userId: user.id,
          password: hashedPassword,
        },
      });
    }
  }
  console.log(`✅ ${PEOPLE.length} usuários criados/atualizados`);

  // ── 2. Tenant ────────────────────────────────────────────────────────────────
  const tenant = await db.tenant.upsert({
    where: { slug: TENANT_SLUG },
    create: {
      name: TENANT_NAME,
      slug: TENANT_SLUG,
      metadata: {
        plan: "enterprise",
        safeTier: "full",
        industry: "healthtech",
      },
    },
    update: { name: TENANT_NAME },
  });
  console.log(`✅ Tenant: ${tenant.name}`);

  // ── 3. Memberships ──────────────────────────────────────────────────────────
  for (const p of PEOPLE) {
    const exists = await db.tenantMember.findFirst({
      where: { userId: userMap[p.email], tenantId: tenant.id },
    });
    if (!exists) {
      await db.tenantMember.create({
        data: { userId: userMap[p.email], tenantId: tenant.id, role: p.role },
      });
    }
  }
  console.log(`✅ ${PEOPLE.length} memberships criadas`);

  const tid = tenant.id;
  const adminId = userMap[ADMIN_EMAIL];

  // ── 4. ART ──────────────────────────────────────────────────────────────────
  const art = await db.aRT.create({
    data: { tenantId: tid, name: "Plataforma de Saúde ART", cadence: 10 },
  });
  console.log(`✅ ART: ${art.name}`);

  // ── 5. Teams ─────────────────────────────────────────────────────────────────
  // PO indices in PEOPLE: 3,4,5,6,7  SM: 8,9,10,11,12  DEV: 13..
  const teamDefs = [
    {
      name: "Equipe Prontuário",
      velocity: 42,
      po: "fernanda.costa@medcore.com.br",
      sm: "pedro.alves@medcore.com.br",
      devEmails: [
        "gabriel.silva",
        "amanda.pereira",
        "rodrigo.sousa",
        "isabela.nascimento",
        "felipe.rezende",
        "natalia.cruz",
        "thiago.moraes",
      ].map((n) => `${n}@medcore.com.br`),
      skills: ["React", "Node.js", "PostgreSQL", "TypeScript", "HL7"],
    },
    {
      name: "Equipe IA & Analytics",
      velocity: 35,
      po: "rafael.oliveira@medcore.com.br",
      sm: "camila.nunes@medcore.com.br",
      devEmails: [
        "leonardo.santos",
        "priscila.gomes",
        "andre.teixeira",
        "vanessa.rocha",
        "bruno.cardoso",
        "carolina.dias",
        "guilherme.araujo",
        "mariana.freitas",
      ].map((n) => `${n}@medcore.com.br`),
      skills: ["Python", "PyTorch", "MLflow", "FastAPI", "dbt", "Kafka"],
    },
    {
      name: "Equipe Plataforma Core",
      velocity: 38,
      po: "juliana.santos@medcore.com.br",
      sm: "lucas.carvalho@medcore.com.br",
      devEmails: [
        "eduardo.pinto",
        "larissa.melo",
        "renato.andrade",
        "patricia.torres",
        "flavio.ribeiro",
        "simone.correia",
        "victor.fonseca",
        "aline.batista",
      ].map((n) => `${n}@medcore.com.br`),
      skills: [
        "Kubernetes",
        "Terraform",
        "Go",
        "Postgres",
        "Redis",
        "Prometheus",
      ],
    },
    {
      name: "Equipe Integrações HL7",
      velocity: 30,
      po: "marcos.ferreira@medcore.com.br",
      sm: "tatiana.barbosa@medcore.com.br",
      devEmails: [
        "henrique.lopes",
        "daniela.castro",
        "marcos.vieira",
        "roberta.mendonca",
        "caio.duarte",
        "leticia.campos",
        "alexandre.ramos",
      ].map((n) => `${n}@medcore.com.br`),
      skills: ["Java", "HL7 FHIR", "Mirth Connect", "Spring Boot", "RabbitMQ"],
    },
    {
      name: "Equipe Mobile & UX",
      velocity: 32,
      po: "beatriz.lima@medcore.com.br",
      sm: "diego.martins@medcore.com.br",
      devEmails: [
        "gustavo.ferreira",
        "vitoria.gomes",
        "thales.sousa",
        "monica.alves",
        "fabio.costa",
        "raquel.lima",
        "otavio.rodrigues",
      ].map((n) => `${n}@medcore.com.br`),
      skills: [
        "React Native",
        "Expo",
        "Figma",
        "Next.js",
        "Tailwind",
        "Accessibility",
      ],
    },
  ];

  const teams: { id: string; name: string; devIds: string[]; poId: string }[] =
    [];
  for (const td of teamDefs) {
    const memberJson = [
      {
        name: PEOPLE.find((p) => p.email === td.po)!.name,
        role: "PO",
        skills: ["Product", "SAFe"],
        hoursPerWeek: 40,
      },
      {
        name: PEOPLE.find((p) => p.email === td.sm)!.name,
        role: "SM",
        skills: ["Scrum", "Facilitation"],
        hoursPerWeek: 40,
      },
      ...td.devEmails.map((e) => ({
        name: PEOPLE.find((p) => p.email === e)!.name,
        role: "DEV",
        skills: td.skills,
        hoursPerWeek: 40,
      })),
    ];
    const team = await db.team.create({
      data: {
        tenantId: tid,
        artId: art.id,
        name: td.name,
        velocity: td.velocity,
        sprintLengthDays: 14,
        members: memberJson,
      },
    });
    teams.push({
      id: team.id,
      name: td.name,
      devIds: td.devEmails.map((e) => userMap[e]),
      poId: userMap[td.po],
    });
  }
  console.log(`✅ ${teams.length} times criados`);

  // ── 6. PI Plans ──────────────────────────────────────────────────────────────
  const pi1 = await db.pIPlan.create({
    data: {
      tenantId: tid,
      artId: art.id,
      name: "PI 2025-Q4 — Fundações Clínicas",
      startDate: ago(150),
      endDate: ago(30),
    },
  });
  const pi2 = await db.pIPlan.create({
    data: {
      tenantId: tid,
      artId: art.id,
      name: "PI 2026-Q1 — Plataforma & IA",
      startDate: ago(28),
      endDate: fwd(42),
    },
  });
  const pi3 = await db.pIPlan.create({
    data: {
      tenantId: tid,
      artId: art.id,
      name: "PI 2026-Q2 — Escala & Integrações",
      startDate: fwd(44),
      endDate: fwd(114),
    },
  });
  console.log("✅ 3 PI Plans criados");

  // ── 7. Sprints (6 por time) ───────────────────────────────────────────────
  // 4 no PI1 (COMPLETED), 1 COMPLETED + 1 ACTIVE no PI2
  const allSprints: { teamIdx: number; sprintId: string; status: string }[] =
    [];
  for (let t = 0; t < teams.length; t++) {
    const teamId = teams[t].id;
    const teamName = teams[t].name.replace("Equipe ", "");
    const sprintData = [
      {
        name: `Sprint 1 — ${teamName}`,
        status: "COMPLETED",
        start: ago(148),
        end: ago(134),
        piId: pi1.id,
      },
      {
        name: `Sprint 2 — ${teamName}`,
        status: "COMPLETED",
        start: ago(133),
        end: ago(119),
        piId: pi1.id,
      },
      {
        name: `Sprint 3 — ${teamName}`,
        status: "COMPLETED",
        start: ago(118),
        end: ago(104),
        piId: pi1.id,
      },
      {
        name: `Sprint 4 — ${teamName}`,
        status: "COMPLETED",
        start: ago(103),
        end: ago(31),
        piId: pi1.id,
      },
      {
        name: `Sprint 5 — ${teamName}`,
        status: "COMPLETED",
        start: ago(28),
        end: ago(14),
        piId: pi2.id,
      },
      {
        name: `Sprint 6 — ${teamName}`,
        status: "ACTIVE",
        start: ago(13),
        end: fwd(1),
        piId: pi2.id,
      },
    ];
    for (const s of sprintData) {
      const sprint = await db.sprint.create({
        data: {
          tenantId: tid,
          teamId,
          name: s.name,
          goal: `Entrega de valor ${s.name}`,
          startDate: s.start,
          endDate: s.end,
          status: s.status,
          capacity: teams[t].devIds.length * 10,
        },
      });
      allSprints.push({ teamIdx: t, sprintId: sprint.id, status: s.status });
    }
  }
  console.log(`✅ ${allSprints.length} sprints criados`);

  // ── 8. Strategic Themes ────────────────────────────────────────────────────
  const themes = await Promise.all([
    db.strategicTheme.create({
      data: {
        tenantId: tid,
        code: "THEME-001",
        title: "Prontuário Eletrônico 360°",
        color: "#6366f1",
        order: 0,
        status: "ACTIVE",
        themeType: "CUSTOMER_EXPERIENCE",
        ownerUserId: adminId,
        budgetTotal: 800_000,
      },
    }),
    db.strategicTheme.create({
      data: {
        tenantId: tid,
        code: "THEME-002",
        title: "IA Diagnóstica & Preventiva",
        color: "#10b981",
        order: 1,
        status: "ACTIVE",
        themeType: "INNOVATION",
        ownerUserId: userMap["carlos.mendes@medcore.com.br"],
        budgetTotal: 1_200_000,
      },
    }),
    db.strategicTheme.create({
      data: {
        tenantId: tid,
        code: "THEME-003",
        title: "Interoperabilidade FHIR/HL7",
        color: "#f59e0b",
        order: 2,
        status: "ACTIVE",
        themeType: "COMPLIANCE",
        ownerUserId: userMap["ana.rodrigues@medcore.com.br"],
        budgetTotal: 600_000,
      },
    }),
    db.strategicTheme.create({
      data: {
        tenantId: tid,
        code: "THEME-004",
        title: "Plataforma Cloud-Native",
        color: "#3b82f6",
        order: 3,
        status: "ACTIVE",
        themeType: "EFFICIENCY",
        ownerUserId: userMap["juliana.santos@medcore.com.br"],
        budgetTotal: 500_000,
      },
    }),
    db.strategicTheme.create({
      data: {
        tenantId: tid,
        code: "THEME-005",
        title: "Jornada Digital do Paciente",
        color: "#ec4899",
        order: 4,
        status: "ACTIVE",
        themeType: "GROWTH",
        ownerUserId: userMap["beatriz.lima@medcore.com.br"],
        budgetTotal: 700_000,
      },
    }),
  ]);
  console.log("✅ 5 Strategic Themes criados");

  // ── 9. Epics ──────────────────────────────────────────────────────────────
  const epics = await Promise.all([
    db.epic.create({
      data: {
        tenantId: tid,
        title: "EHR Core Module",
        statusId: "IN_PROGRESS",
        strategicThemeId: themes[0].id,
        order: 0,
      },
    }),
    db.epic.create({
      data: {
        tenantId: tid,
        title: "Prescrição Digital",
        statusId: "IN_PROGRESS",
        strategicThemeId: themes[0].id,
        order: 1,
      },
    }),
    db.epic.create({
      data: {
        tenantId: tid,
        title: "Modelo Preditivo de Risco Clínico",
        statusId: "IN_PROGRESS",
        strategicThemeId: themes[1].id,
        order: 2,
      },
    }),
    db.epic.create({
      data: {
        tenantId: tid,
        title: "Análise de Imagens Médicas por IA",
        statusId: "BACKLOG",
        strategicThemeId: themes[1].id,
        order: 3,
      },
    }),
    db.epic.create({
      data: {
        tenantId: tid,
        title: "Gateway FHIR R4",
        statusId: "IN_PROGRESS",
        strategicThemeId: themes[2].id,
        order: 4,
      },
    }),
    db.epic.create({
      data: {
        tenantId: tid,
        title: "Conector com Sistemas Legados",
        statusId: "DONE",
        strategicThemeId: themes[2].id,
        order: 5,
      },
    }),
    db.epic.create({
      data: {
        tenantId: tid,
        title: "Migração para Kubernetes",
        statusId: "DONE",
        strategicThemeId: themes[3].id,
        order: 6,
      },
    }),
    db.epic.create({
      data: {
        tenantId: tid,
        title: "Observabilidade & SRE",
        statusId: "IN_PROGRESS",
        strategicThemeId: themes[3].id,
        order: 7,
      },
    }),
    db.epic.create({
      data: {
        tenantId: tid,
        title: "App Mobile do Paciente",
        statusId: "IN_PROGRESS",
        strategicThemeId: themes[4].id,
        order: 8,
      },
    }),
    db.epic.create({
      data: {
        tenantId: tid,
        title: "Portal Web do Médico",
        statusId: "BACKLOG",
        strategicThemeId: themes[4].id,
        order: 9,
      },
    }),
  ]);
  console.log("✅ 10 Epics criados");

  // ── 10. Features ──────────────────────────────────────────────────────────
  const featureDefs = [
    // EHR Core (epic 0)
    {
      title: "Cadastro e Prontuário do Paciente",
      epicIdx: 0,
      pi: pi1,
      bv: 9,
      tc: 8,
      rr: 5,
      js: 3,
      sp: 21,
      status: "DONE",
      team: 0,
    },
    {
      title: "Histórico Clínico Unificado",
      epicIdx: 0,
      pi: pi1,
      bv: 9,
      tc: 7,
      rr: 6,
      js: 4,
      sp: 34,
      status: "DONE",
      team: 0,
    },
    {
      title: "Agenda e Marcação de Consultas",
      epicIdx: 0,
      pi: pi2,
      bv: 8,
      tc: 6,
      rr: 4,
      js: 3,
      sp: 21,
      status: "IN_PROGRESS",
      team: 0,
    },
    // Prescrição Digital (epic 1)
    {
      title: "Prescrição Eletrônica Assinada",
      epicIdx: 1,
      pi: pi1,
      bv: 8,
      tc: 9,
      rr: 7,
      js: 3,
      sp: 13,
      status: "DONE",
      team: 0,
    },
    {
      title: "Verificação de Interações Medicamentosas",
      epicIdx: 1,
      pi: pi2,
      bv: 9,
      tc: 8,
      rr: 9,
      js: 5,
      sp: 34,
      status: "IN_PROGRESS",
      team: 1,
    },
    // IA Preditiva (epic 2)
    {
      title: "Pipeline de Treinamento MLflow",
      epicIdx: 2,
      pi: pi1,
      bv: 7,
      tc: 6,
      rr: 8,
      js: 5,
      sp: 34,
      status: "DONE",
      team: 1,
    },
    {
      title: "API de Predição de Risco Cardíaco",
      epicIdx: 2,
      pi: pi2,
      bv: 9,
      tc: 7,
      rr: 9,
      js: 4,
      sp: 21,
      status: "IN_PROGRESS",
      team: 1,
    },
    {
      title: "Dashboard de Indicadores de Risco",
      epicIdx: 2,
      pi: pi2,
      bv: 8,
      tc: 6,
      rr: 7,
      js: 3,
      sp: 13,
      status: "BACKLOG",
      team: 4,
    },
    // Imagens (epic 3)
    {
      title: "Módulo de Upload e Visualização DICOM",
      epicIdx: 3,
      pi: pi2,
      bv: 7,
      tc: 5,
      rr: 6,
      js: 5,
      sp: 34,
      status: "BACKLOG",
      team: 1,
    },
    {
      title: "Inferência de Laudos por IA",
      epicIdx: 3,
      pi: pi3,
      bv: 9,
      tc: 6,
      rr: 8,
      js: 6,
      sp: 55,
      status: "BACKLOG",
      team: 1,
    },
    // Gateway FHIR (epic 4)
    {
      title: "Endpoints FHIR R4 Patient/Observation",
      epicIdx: 4,
      pi: pi1,
      bv: 8,
      tc: 9,
      rr: 8,
      js: 4,
      sp: 34,
      status: "DONE",
      team: 3,
    },
    {
      title: "Autenticação SMART on FHIR",
      epicIdx: 4,
      pi: pi2,
      bv: 7,
      tc: 8,
      rr: 9,
      js: 3,
      sp: 21,
      status: "IN_PROGRESS",
      team: 3,
    },
    // Conector Legados (epic 5)
    {
      title: "Conector HL7 v2 (ADT/ORM/ORU)",
      epicIdx: 5,
      pi: pi1,
      bv: 7,
      tc: 8,
      rr: 6,
      js: 5,
      sp: 34,
      status: "DONE",
      team: 3,
    },
    {
      title: "ETL de Migração de Dados Históricos",
      epicIdx: 5,
      pi: pi1,
      bv: 6,
      tc: 7,
      rr: 5,
      js: 6,
      sp: 55,
      status: "DONE",
      team: 3,
    },
    // Kubernetes (epic 6)
    {
      title: "Migração de Serviços Críticos para K8s",
      epicIdx: 6,
      pi: pi1,
      bv: 6,
      tc: 7,
      rr: 7,
      js: 6,
      sp: 55,
      status: "DONE",
      team: 2,
    },
    {
      title: "Autoscaling (HPA) e Resource Quotas",
      epicIdx: 6,
      pi: pi1,
      bv: 5,
      tc: 6,
      rr: 7,
      js: 4,
      sp: 21,
      status: "DONE",
      team: 2,
    },
    // Observabilidade (epic 7)
    {
      title: "Stack OpenTelemetry + Grafana",
      epicIdx: 7,
      pi: pi1,
      bv: 7,
      tc: 7,
      rr: 8,
      js: 4,
      sp: 34,
      status: "DONE",
      team: 2,
    },
    {
      title: "Alertas e Runbooks SRE",
      epicIdx: 7,
      pi: pi2,
      bv: 6,
      tc: 6,
      rr: 7,
      js: 3,
      sp: 21,
      status: "IN_PROGRESS",
      team: 2,
    },
    // Mobile (epic 8)
    {
      title: "App Mobile — Agendamento e Resultados",
      epicIdx: 8,
      pi: pi2,
      bv: 9,
      tc: 8,
      rr: 5,
      js: 4,
      sp: 34,
      status: "IN_PROGRESS",
      team: 4,
    },
    {
      title: "App Mobile — Teleconsulta",
      epicIdx: 8,
      pi: pi3,
      bv: 9,
      tc: 7,
      rr: 6,
      js: 5,
      sp: 55,
      status: "BACKLOG",
      team: 4,
    },
    // Portal Médico (epic 9)
    {
      title: "Portal Médico — Visão Consolidada",
      epicIdx: 9,
      pi: pi3,
      bv: 8,
      tc: 6,
      rr: 5,
      js: 4,
      sp: 34,
      status: "BACKLOG",
      team: 4,
    },
  ];

  const features: string[] = [];
  for (const fd of featureDefs) {
    const wsjf = (fd.bv + fd.tc + fd.rr) / fd.js;
    const f = await db.feature.create({
      data: {
        tenantId: tid,
        epicId: epics[fd.epicIdx].id,
        piPlanId: fd.pi.id,
        title: fd.title,
        statusId: fd.status,
        bv: fd.bv,
        tc: fd.tc,
        rr: fd.rr,
        js: fd.js,
        wsjfScore: wsjf,
        storyPoints: fd.sp,
        assigneeUserId: teams[fd.team].poId,
        completedAt:
          fd.status === "DONE"
            ? ago(Math.floor(Math.random() * 60) + 15)
            : null,
      },
    });
    features.push(f.id);
  }
  console.log(`✅ ${features.length} Features criadas`);

  // ── 11. Stories & Tasks ────────────────────────────────────────────────────
  // 5 stories per sprint × 30 sprints = 150 stories; 3 tasks per story = 450 tasks
  const storyTitles = [
    "Como médico, quero visualizar o histórico de alergias do paciente",
    "Como enfermeiro, quero registrar sinais vitais durante a triagem",
    "Como paciente, quero agendar consulta pelo app mobile",
    "Como farmacêutico, quero validar prescrição eletrônica",
    "Como gestor, quero exportar relatório de atendimentos do mês",
    "Como médico, quero assinar eletronicamente o prontuário",
    "Como dev, quero endpoint REST para busca de pacientes por CPF",
    "Como analista, quero pipeline de dados para modelo de risco",
    "Como dev, quero integração HL7 ADT A01 para admissões",
    "Como QA, quero testes automatizados de integração FHIR",
    "Como dev, quero autoscaling configurado no Kubernetes",
    "Como SRE, quero alertas Grafana para latência p99 > 500ms",
    "Como dev mobile, quero tela de resultados de exames no app",
    "Como UX, quero fluxo de teleconsulta mapeado e validado",
    "Como dev, quero cache Redis para sessões de usuário",
  ];

  const taskTitles = [
    [
      "Implementar endpoint na API",
      "Escrever testes unitários",
      "Code review e merge",
    ],
    ["Criar componente React", "Adicionar validação Zod", "Deploy em staging"],
    [
      "Modelar schema Prisma",
      "Migration e seed de teste",
      "Documentar no Swagger",
    ],
    [
      "Treinar modelo v1",
      "Avaliar métricas F1/AUC",
      "Publicar endpoint FastAPI",
    ],
    [
      "Configurar Mirth Connect",
      "Testar mensagem HL7 ADT A01",
      "Homologar com sistema parceiro",
    ],
  ];

  let storyCount = 0;
  for (const { teamIdx, sprintId, status } of allSprints) {
    const devIds = teams[teamIdx].devIds;
    const numStories = status === "ACTIVE" ? 4 : 5;
    for (let s = 0; s < numStories; s++) {
      const isDone = status === "COMPLETED" || (status === "ACTIVE" && s < 2);
      const story = await db.story.create({
        data: {
          tenantId: tid,
          sprintId,
          featureId: pick(features, storyCount),
          title: pick(storyTitles, storyCount + s),
          storyPoints: [2, 3, 5, 8][s % 4],
          status: isDone ? "DONE" : s === 2 ? "IN_PROGRESS" : "TODO",
          priority: ["critical", "high", "medium", "low"][s % 4],
          assigneeUserId: pick(devIds, s),
          completedAt: isDone ? ago(Math.floor(Math.random() * 20) + 1) : null,
        },
      });

      const tpl = pick(taskTitles, teamIdx);
      for (let k = 0; k < 3; k++) {
        await db.task.create({
          data: {
            tenantId: tid,
            storyId: story.id,
            title: tpl[k],
            status: isDone ? "DONE" : k === 0 ? "IN_PROGRESS" : "TODO",
            assigneeUserId: pick(devIds, s + k),
            estimateHours: [2, 4, 6, 8][k % 4],
            taskType: ["backend", "frontend", "ml", "infra", "qa"][teamIdx],
            complexity: ["low", "medium", "high"][k % 3],
          },
        });
      }
      storyCount++;
    }
  }
  console.log(`✅ ~${storyCount} Stories e ~${storyCount * 3} Tasks criados`);

  // ── 12. PI Objectives ────────────────────────────────────────────────────
  const piObjDefs = [
    {
      pi: pi2,
      title: "Entregar Gateway FHIR R4 em produção",
      bv: 9,
      stretch: false,
      status: "IN_PROGRESS",
    },
    {
      pi: pi2,
      title: "Lançar modelo preditivo de risco cardíaco v1",
      bv: 8,
      stretch: false,
      status: "IN_PROGRESS",
    },
    {
      pi: pi2,
      title: "Migrar 80% dos serviços para Kubernetes",
      bv: 7,
      stretch: true,
      status: "ACHIEVED",
    },
    {
      pi: pi2,
      title: "Reduzir MTTR de incidentes para < 30 min",
      bv: 6,
      stretch: false,
      status: "IN_PROGRESS",
    },
    {
      pi: pi2,
      title: "Lançar beta do app mobile com 500 pacientes",
      bv: 8,
      stretch: false,
      status: "IN_PROGRESS",
    },
    {
      pi: pi2,
      title: "Suporte a autenticação SMART on FHIR",
      bv: 7,
      stretch: true,
      status: "NOT_STARTED",
    },
    {
      pi: pi1,
      title: "Entregar EHR Core com cadastro de pacientes",
      bv: 9,
      stretch: false,
      status: "ACHIEVED",
    },
    {
      pi: pi1,
      title: "Conector HL7 v2 homologado com 3 hospitais",
      bv: 8,
      stretch: false,
      status: "ACHIEVED",
    },
    {
      pi: pi1,
      title: "Plataforma Kubernetes em produção",
      bv: 7,
      stretch: false,
      status: "ACHIEVED",
    },
    {
      pi: pi1,
      title: "Stack de observabilidade com Grafana/OTel",
      bv: 6,
      stretch: false,
      status: "ACHIEVED",
    },
  ];
  for (const o of piObjDefs) {
    await db.pIObjective.create({
      data: {
        tenantId: tid,
        piPlanId: o.pi.id,
        title: o.title,
        businessValue: o.bv,
        isStretch: o.stretch,
        status: o.status,
      },
    });
  }
  console.log("✅ 10 PI Objectives criados");

  // ── 13. OKRs & Key Results ────────────────────────────────────────────────
  const okrDefs = [
    {
      type: "portfolio_theme",
      themeId: themes[0].id,
      piId: pi2.id,
      title:
        "Tornar o prontuário digital o principal canal de registro clínico",
      status: "ON_TRACK",
      horizon: "2026-Q1",
      krs: [
        {
          title: "% de unidades de saúde com EHR ativo",
          baseline: 10,
          current: 42,
          target: 80,
        },
        {
          title: "Tempo médio de cadastro de paciente (minutos)",
          baseline: 15,
          current: 6,
          target: 3,
        },
        {
          title: "NPS do módulo de prontuário",
          baseline: 32,
          current: 51,
          target: 65,
        },
      ],
    },
    {
      type: "portfolio_theme",
      themeId: themes[1].id,
      piId: pi2.id,
      title: "Posicionar MedCore como referência em IA clínica no Brasil",
      status: "ON_TRACK",
      horizon: "2026-Q1",
      krs: [
        {
          title: "Precisão do modelo de risco cardíaco (AUC)",
          baseline: 0,
          current: 0.81,
          target: 0.87,
        },
        {
          title: "Número de pacientes monitorados pelo modelo",
          baseline: 0,
          current: 3200,
          target: 10_000,
        },
        {
          title: "Redução de reinternações via alerta preditivo (%)",
          baseline: 0,
          current: 8,
          target: 20,
        },
      ],
    },
    {
      type: "pi_art",
      piId: pi2.id,
      title: "Entregar Plataforma de Saúde ART com alto valor no PI 2026-Q1",
      status: "ON_TRACK",
      horizon: "2026-Q1",
      krs: [
        {
          title: "PI Predictability Measure (%)",
          baseline: 72,
          current: 78,
          target: 85,
        },
        {
          title: "Features entregues no PI",
          baseline: 0,
          current: 8,
          target: 12,
        },
        { title: "Incidentes P1 no PI", baseline: 5, current: 2, target: 0 },
      ],
    },
    {
      type: "team_pi",
      piId: pi2.id,
      title: "Equipe IA & Analytics — Entregar modelo de risco em produção",
      status: "AT_RISK",
      horizon: "2026-Q1",
      krs: [
        {
          title: "Acurácia do modelo em dados de validação (%)",
          baseline: 0,
          current: 79,
          target: 87,
        },
        {
          title: "Latência média da API de predição (ms)",
          baseline: 0,
          current: 320,
          target: 150,
        },
      ],
    },
    {
      type: "portfolio_theme",
      themeId: themes[4].id,
      piId: pi2.id,
      title: "Engajar pacientes na plataforma digital MedCore",
      status: "ON_TRACK",
      horizon: "2026-Q1",
      krs: [
        {
          title: "DAU do app mobile",
          baseline: 0,
          current: 1800,
          target: 5000,
        },
        {
          title: "Taxa de agendamento digital vs. telefone (%)",
          baseline: 12,
          current: 31,
          target: 55,
        },
        {
          title: "Churn mensal de pacientes ativos (%)",
          baseline: 8,
          current: 5,
          target: 3,
        },
      ],
    },
  ];

  for (const od of okrDefs) {
    const okr = await db.oKR.create({
      data: {
        tenantId: tid,
        type: od.type,
        piPlanId: od.piId,
        strategicThemeId: (od as any).themeId ?? null,
        title: od.title,
        status: od.status,
        horizon: od.horizon,
        ownerId: adminId,
      },
    });
    for (const kr of od.krs) {
      const kRes = await db.keyResult.create({
        data: {
          tenantId: tid,
          okrId: okr.id,
          title: kr.title,
          baseline: kr.baseline,
          current: kr.current,
          target: kr.target,
          ownerId: adminId,
        },
      });
      // Add a couple of snapshots
      await db.keyResultSnapshot.create({
        data: {
          tenantId: tid,
          keyResultId: kRes.id,
          value: kr.baseline,
          note: "Baseline inicial",
          recordedAt: ago(90),
        },
      });
      await db.keyResultSnapshot.create({
        data: {
          tenantId: tid,
          keyResultId: kRes.id,
          value: kr.current,
          note: "Check-in PI 2026-Q1",
          recordedAt: ago(7),
        },
      });
    }
  }
  console.log("✅ 5 OKRs + Key Results + Snapshots criados");

  // ── 14. Risks ─────────────────────────────────────────────────────────────
  const risks = [
    {
      title:
        "Dependência crítica de integração com HIS legado do hospital parceiro",
      status: "OWNED",
      cat: "technical",
      impact: "critical",
      probability: "high",
      owner: "marcos.ferreira@medcore.com.br",
      pi: pi2,
    },
    {
      title: "Conformidade LGPD para dados de saúde em ambiente cloud",
      status: "MITIGATED",
      cat: "compliance",
      impact: "high",
      probability: "medium",
      owner: "carlos.mendes@medcore.com.br",
      pi: pi2,
    },
    {
      title: "Latência do modelo IA acima do SLA em produção",
      status: "OWNED",
      cat: "technical",
      impact: "high",
      probability: "medium",
      owner: "rafael.oliveira@medcore.com.br",
      pi: pi2,
    },
    {
      title: "Rotatividade elevada no time de Integrações HL7",
      status: "ACCEPTED",
      cat: "organizational",
      impact: "medium",
      probability: "medium",
      owner: "ana.rodrigues@medcore.com.br",
      pi: pi2,
    },
    {
      title: "Certificação FHIR R4 pendente com parceiro regulatório",
      status: "IDENTIFIED",
      cat: "compliance",
      impact: "high",
      probability: "high",
      owner: "marcos.ferreira@medcore.com.br",
      pi: pi2,
    },
    {
      title: "Custo crescente de infraestrutura cloud acima do orçamento do PI",
      status: "ACCEPTED",
      cat: "financial",
      impact: "medium",
      probability: "high",
      owner: adminId,
      pi: pi2,
    },
    {
      title:
        "Qualidade dos dados históricos dos hospitais para treinamento de modelos",
      status: "MITIGATED",
      cat: "data",
      impact: "high",
      probability: "medium",
      owner: "rafael.oliveira@medcore.com.br",
      pi: pi1,
    },
    {
      title: "Tempo de onboarding de hospitais parceiros maior que estimado",
      status: "OWNED",
      cat: "operational",
      impact: "medium",
      probability: "high",
      owner: adminId,
      pi: pi2,
    },
  ];
  for (const r of risks) {
    await db.risk.create({
      data: {
        tenantId: tid,
        piPlanId: r.pi.id,
        title: r.title,
        status: r.status,
        category: r.cat,
        impact: r.impact,
        probability: r.probability,
        description: `Plano de mitigação: ${r.title.slice(0, 80)}`,
        ownerUserId:
          typeof r.owner === "string" && r.owner.includes("@")
            ? userMap[r.owner]
            : r.owner,
      },
    });
  }
  console.log("✅ 8 Risks criados");

  // ── 15. Competency Assessments & Improvement Actions ──────────────────────
  const competencies = [
    "TEAM_TECHNICAL_AGILITY",
    "AGILE_PRODUCT_DELIVERY",
    "LEAN_PORTFOLIO_MANAGEMENT",
    "ORGANIZATIONAL_AGILITY",
    "CONTINUOUS_LEARNING_CULTURE",
  ] as const;

  const assessmentNotes = [
    "Time demonstra boas práticas de TDD e CI/CD, mas ainda carece de pair programming sistematizado.",
    "Backlog bem priorizado; falta cadência de refinamento com mais de 2 sprints de visibilidade.",
    "Portfólio SAFe implantado; ainda há dificuldade em priorizar pelo valor vs urgência.",
    "Estrutura ART consolidada; necessita melhorar colaboração entre times de produto e plataforma.",
    "InnovationSprints ocorrem; falta sistema formal de compartilhamento de aprendizados entre ARTs.",
  ];

  for (let i = 0; i < teams.length; i++) {
    const assessment = await db.competencyAssessment.create({
      data: {
        tenantId: tid,
        scope: "team",
        scopeId: teams[i].id,
        competency: competencies[i],
        score: 2.5 + i * 0.4,
        assessedAt: ago(30),
        assessedById: teams[i].poId,
        piPlanId: pi2.id,
        notes: assessmentNotes[i],
      },
    });

    await db.improvementAction.create({
      data: {
        tenantId: tid,
        title: `Melhorar ${competencies[i].replaceAll("_", " ").toLowerCase()} no time ${teams[i].name}`,
        description: `Ação derivada da avaliação de competência com score ${(2.5 + i * 0.4).toFixed(1)}/5. ${assessmentNotes[i]}`,
        scope: "team",
        scopeId: teams[i].id,
        status: i < 2 ? "IN_PROGRESS" : "OPEN",
        dueDate: fwd(30 + i * 7),
        assigneeId: teams[i].poId,
        assessmentId: assessment.id,
        source: "manual",
      },
    });
  }
  // ART-level assessment
  await db.competencyAssessment.create({
    data: {
      tenantId: tid,
      scope: "art",
      scopeId: art.id,
      competency: "LEAN_AGILE_LEADERSHIP",
      score: 3.2,
      assessedAt: ago(45),
      assessedById: adminId,
      piPlanId: pi2.id,
      notes:
        "Liderança engajada com SAFe; falta maior visibilidade das OKRs para todo o ART.",
    },
  });
  console.log("✅ Competency Assessments + Improvement Actions criados");

  // ── 16. Person Skill Profiles (amostra) ───────────────────────────────────
  const skillCompetencies = [
    "TEAM_TECHNICAL_AGILITY",
    "AGILE_PRODUCT_DELIVERY",
    "CONTINUOUS_LEARNING_CULTURE",
  ] as const;
  const sampleDevs = teams.flatMap((t) => t.devIds.slice(0, 3));
  for (const userId of sampleDevs) {
    for (const comp of skillCompetencies) {
      const existing = await db.personSkillProfile.findFirst({
        where: { tenantId: tid, userId, competency: comp },
      });
      if (!existing) {
        await db.personSkillProfile.create({
          data: {
            tenantId: tid,
            userId,
            competency: comp,
            skillLevel: Math.floor(Math.random() * 3) + 2,
            proficiency: 0.5 + Math.random() * 0.4,
            assessedAt: ago(60),
            assessedBy: adminId,
            confidence: 75,
            isDraft: false,
            isVerified: true,
          },
        });
      }
    }
  }
  console.log("✅ Person Skill Profiles criados");

  // ── 17. Flow Metric Snapshots ─────────────────────────────────────────────
  for (let t = 0; t < teams.length; t++) {
    const completedSprints = allSprints.filter(
      (s) => s.teamIdx === t && s.status === "COMPLETED"
    );
    for (const { sprintId } of completedSprints.slice(0, 4)) {
      await db.flowMetricSnapshot.create({
        data: {
          tenantId: tid,
          scope: "team",
          scopeId: teams[t].id,
          period: "sprint",
          periodRef: sprintId,
          recordedAt: ago(Math.floor(Math.random() * 80) + 5),
          flowVelocityTotal: Math.floor(
            (teamDefs[t].velocity ?? 30) * (0.85 + Math.random() * 0.3)
          ),
          flowVelocityByType: {
            story: 60,
            defect: 15,
            feature: 20,
            enabler: 5,
          },
          flowDistribution: {
            story: 0.6,
            defect: 0.15,
            feature: 0.2,
            enabler: 0.05,
          },
          flowTimeAvgHours: 48 + Math.random() * 24,
          flowTimeMedianHours: 36 + Math.random() * 18,
          flowTimeByType: { story: 42, defect: 18, feature: 72 },
          flowLoadAvg: teams[t].devIds.length * 1.2,
          flowLoadCurrent: teams[t].devIds.length,
          flowEfficiency: 0.55 + Math.random() * 0.25,
          flowPredictability: 0.7 + Math.random() * 0.2,
          plannedItems: 18,
          deliveredItems: Math.floor(15 + Math.random() * 5),
          staleness: "FRESH",
        },
      });
    }
  }
  console.log("✅ Flow Metric Snapshots criados");

  // ── 18. Standups (última semana) ──────────────────────────────────────────
  const standupMessages = [
    {
      yesterday: "Implementei endpoint de busca por CPF com paginação",
      today: "Vou revisar PR do colega e iniciar testes de integração",
      blockers: null,
    },
    {
      yesterday: "Refinei histórias do próximo sprint com PO",
      today: "Facilitarei daily e revisarei métricas de flow",
      blockers: null,
    },
    {
      yesterday: "Treinei nova versão do modelo com dados de fevereiro",
      today: "Avaliarei AUC e abrirei PR se métricas OK",
      blockers: "Aguardando acesso ao dataset de validação do hospital",
    },
    {
      yesterday: "Configurei alerta de latência no Grafana",
      today: "Documentarei runbook de incidente P1",
      blockers: null,
    },
    {
      yesterday: "Implementei tela de agendamento no app",
      today: "Farei testes no dispositivo iOS e corrigirei layout",
      blockers: null,
    },
  ];

  for (let t = 0; t < teams.length; t++) {
    const devId = teams[t].devIds[0];
    const msg = standupMessages[t];
    for (let d = 0; d < 3; d++) {
      const date = ago(d);
      date.setHours(0, 0, 0, 0);
      await db.standupEntry.upsert({
        where: {
          teamId_userId_date: { teamId: teams[t].id, userId: devId, date },
        },
        create: {
          tenantId: tid,
          teamId: teams[t].id,
          userId: devId,
          date,
          ...msg,
        },
        update: {},
      });
    }
  }
  console.log("✅ Standups criados");

  // ── Resumo ───────────────────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────────────────────");
  console.log("🎉 Seed SAFe Full concluído!\n");
  console.log("  Empresa: MedCore Tecnologia");
  console.log("  Usuários: 50 (1 admin, 1 STE, 1 RTE, 5 POs, 5 SMs, 37 DEVs)");
  console.log("  ART: Plataforma de Saúde ART (5 times)");
  console.log(
    "  PI Plans: 3 (PI 2025-Q4 concluído, PI 2026-Q1 ativo, PI 2026-Q2 planejado)"
  );
  console.log("  Strategic Themes: 5 | Epics: 10 | Features: 21");
  console.log("  OKRs: 5 | Risks: 8 | Assessments: 6");
  console.log("\n  Login admin:");
  console.log(`  Email: ${ADMIN_EMAIL}`);
  console.log(`  Senha: ${DEFAULT_PASS}`);
  console.log("─────────────────────────────────────────────────────────\n");

  await db.$disconnect();
}

main().catch((err) => {
  console.error("❌ Seed falhou:", err);
  process.exit(1);
});
