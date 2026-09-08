/**
 * scripts/seed-meridian.ts
 *
 * Popula o módulo Meridian (diagnóstico de prontidão para IA) num tenant
 * existente.
 *
 *   pnpm seed:meridian            → tenant "nebuloz"
 *   pnpm seed:meridian techcorp-sa → outro slug
 *
 * O que cria:
 *   - TenantModule MERIDIAN + 3 personas com MeridianMembership
 *   - Template v3.2 com a bateria dos cinco eixos
 *   - 4 assessments, um em cada estado (rascunho, coletando, revisão,
 *     finalizado) — incluindo uma reavaliação, para o diff ter contra o quê
 *     comparar
 *   - Respondentes com divergência real no eixo Data (é o que faz o eixo nascer
 *     contestado em vez de a tela ter de fingir)
 *   - Scores por eixo derivados do motor real, um override com justificativa,
 *     gaps com DAG de dependências e plano sequenciado
 *   - Coortes de benchmark acima e abaixo do limiar de leitura
 *
 * Dado fictício de propósito: organizações, pessoas e evidências são
 * inventadas. Não substituir por nomes reais em demo pública.
 *
 * Os scores NÃO são copiados do protótipo: são computados por
 * `computeAxisScore()` a partir das respostas semeadas. Copiá-los produziria um
 * banco onde o número da tela não corresponde às respostas — que é exatamente o
 * bug que o determinismo existe para impedir.
 *
 * Idempotente: apaga e recria todo o domínio Meridian do tenant alvo. Não toca
 * em nada do Cosmos nem do Charter.
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { createHash, randomBytes } from "node:crypto";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
// Caminho profundo, não o índice do pacote, pelo mesmo motivo já documentado em
// lib/charter/policy-generation.ts: o índice reexporta platform-db.ts, que
// importa "server-only" — inofensivo dentro do Next, mas o pacote real lança
// incondicionalmente fora da condição "react-server", e este script roda por
// tsx. Importar do índice aqui fazia `pnpm seed:meridian` morrer antes da
// primeira linha, com um erro que fala de Client Component e não diz nada sobre
// o seed. meridian.ts não importa nada assim — só dados e tipos.
import {
  MERIDIAN_BATTERY,
  MERIDIAN_TEMPLATE_NAME,
  MERIDIAN_TEMPLATE_VERSION,
} from "@repo/provisioning/src/meridian";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { Pool } from "pg";
import type {
  MeridianAxis,
  PrismaClient as PrismaClientType,
} from "../../../packages/database/generated";
import { PrismaClient } from "../../../packages/database/generated";
import { AXIS_IDS } from "../lib/meridian/axes";
import { cohortKeyOf, percentiles } from "../lib/meridian/benchmark";
import { buildPlan } from "../lib/meridian/plan";
import {
  computeAxisScore,
  normalizeAnswer,
  type ScoringQuestion,
} from "../lib/meridian/scoring";

// Default é um dos slugs que `seed:tenants` cria. Apontar para um tenant que
// nenhum seed produz faria o script falhar na primeira execução de uma base
// nova, que é justamente quando ele é mais usado.
const TENANT_SLUG = process.argv[2] ?? "nebuloz";

const PERSONA_PASSWORD = process.env.MERIDIAN_SEED_PASSWORD ?? "meridian123";

// Hoje congelado: as distâncias entre datas (prazo, atraso de respondente)
// precisam ser estáveis entre execuções.
const NOW = new Date("2026-08-28T12:00:00Z");
const d = (iso: string) => new Date(`${iso}T12:00:00Z`);
const daysAhead = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

const PERSONAS = [
  {
    email: "marina.duarte@nebuloz.exemplo",
    name: "Marina Duarte",
    role: "CONSULTANT" as const,
  },
  {
    email: "tiago.ferraz@nebuloz.exemplo",
    name: "Tiago Ferraz",
    role: "CONSULTANT" as const,
  },
  {
    email: "clara.nunes@nebuloz.exemplo",
    name: "Clara Nunes",
    role: "REVIEWER" as const,
  },
];

// ── Bateria v3.2 ──────────────────────────────────────────────────────────────
// A lista mora em `@repo/provisioning`, que é de onde o back-office também a
// cria: uma segunda cópia aqui envelheceria sozinha, e a divergência entre
// banco semeado e banco provisionado é invisível na leitura.

const QUESTIONS = MERIDIAN_BATTERY;

// ── Respondentes e respostas ──────────────────────────────────────────────────
// Jonas e Ana divergem em Data de propósito: é a divergência que faz o eixo
// nascer CONTESTED e a fila de revisão ter conteúdo real.

type SeedRespondent = {
  name: string;
  role: string;
  email: string;
  axis: MeridianAxis;
  status: "DONE" | "PENDING" | "OVERDUE";
  /** code da pergunta → índice da opção. Ausente = não respondeu. */
  answers: Record<string, number>;
};

const AS104_RESPONDENTS: SeedRespondent[] = [
  {
    name: "Jonas Reis",
    role: "Eng. de Dados sênior",
    email: "jonas.reis@vanta.exemplo",
    axis: "DATA",
    status: "DONE",
    answers: { "Q-D01": 3, "Q-D02": 2, "Q-D03": 1 },
  },
  {
    name: "Ana Kim",
    role: "Analista de BI",
    email: "ana.kim@vanta.exemplo",
    axis: "DATA",
    status: "DONE",
    answers: { "Q-D01": 1, "Q-D02": 0, "Q-D03": 3 },
  },
  {
    name: "Paula Rocha",
    role: "Diretora de Operações",
    email: "paula.rocha@vanta.exemplo",
    axis: "PROCESS",
    status: "DONE",
    answers: { "Q-P01": 3, "Q-P02": 0, "Q-P03": 2 },
  },
  {
    name: "Rui Castro",
    role: "Gerente de RH",
    email: "rui.castro@vanta.exemplo",
    axis: "PEOPLE",
    status: "OVERDUE",
    answers: { "Q-E01": 1 },
  },
  {
    name: "Dra. Lívia Prado",
    role: "Compliance",
    email: "livia.prado@vanta.exemplo",
    axis: "GOVERNANCE",
    status: "DONE",
    answers: { "Q-G01": 4, "Q-G02": 1, "Q-G03": 3 },
  },
  {
    name: "Caio Mendes",
    role: "Head de Plataforma",
    email: "caio.mendes@vanta.exemplo",
    axis: "INFRASTRUCTURE",
    status: "DONE",
    answers: { "Q-I01": 2, "Q-I02": 3, "Q-I03": 1 },
  },
];

const AS107_RESPONDENTS: SeedRespondent[] = [
  {
    name: "Sofia Lin",
    role: "Eng. chefe",
    email: "sofia.lin@helix.exemplo",
    axis: "INFRASTRUCTURE",
    status: "DONE",
    answers: { "Q-I01": 2, "Q-I02": 2, "Q-I03": 0 },
  },
  {
    name: "Téo Ramos",
    role: "Agrônomo-dados",
    email: "teo.ramos@helix.exemplo",
    axis: "DATA",
    status: "PENDING",
    answers: { "Q-D01": 1 },
  },
  {
    name: "Carla Dias",
    role: "Gerente de campo",
    email: "carla.dias@helix.exemplo",
    axis: "PROCESS",
    status: "PENDING",
    answers: {},
  },
];

// ── Gaps manuais do AS-104 ────────────────────────────────────────────────────
// Os derivados nascem do scoring. Estes são os que o consultor acrescenta, e
// são eles que carregam o DAG — sem dependência declarada não há plano
// sequenciado para demonstrar.

const MANUAL_GAPS = [
  {
    code: "G-01",
    axis: "DATA" as MeridianAxis,
    severity: "HIGH" as const,
    effort: "L" as const,
    costOfDelay: 88,
    confidence: "MEASURED" as const,
    ownerLabel: "Eng. de Dados",
    statement:
      "Sem catálogo unificado: 40% das fontes críticas vivem em planilhas fora do lake, sem linhagem nem dono.",
    dependsOn: [] as string[],
  },
  {
    code: "G-02",
    axis: "DATA" as MeridianAxis,
    severity: "HIGH" as const,
    effort: "M" as const,
    costOfDelay: 74,
    confidence: "MEASURED" as const,
    ownerLabel: "Eng. de Dados",
    statement:
      "Qualidade não medida: nenhuma checagem automática de completude ou frescor nas fontes clínicas.",
    dependsOn: ["G-01"],
  },
  {
    code: "G-03",
    axis: "GOVERNANCE" as MeridianAxis,
    severity: "HIGH" as const,
    effort: "M" as const,
    costOfDelay: 81,
    confidence: "MEASURED" as const,
    ownerLabel: "Compliance",
    statement:
      "Comitê de IA existe no papel mas não opera: zero casos revisados em seis meses.",
    dependsOn: [],
  },
  {
    code: "G-04",
    axis: "PEOPLE" as MeridianAxis,
    severity: "MEDIUM" as const,
    effort: "M" as const,
    costOfDelay: 62,
    confidence: "ESTIMATED" as const,
    ownerLabel: "RH",
    statement:
      "Nenhuma trilha de capacitação em IA por persona; conhecimento concentrado em duas pessoas.",
    dependsOn: [],
  },
  {
    code: "G-05",
    axis: "PROCESS" as MeridianAxis,
    severity: "MEDIUM" as const,
    effort: "S" as const,
    costOfDelay: 55,
    confidence: "MEASURED" as const,
    ownerLabel: "Operações",
    statement:
      "Casos de uso priorizados por opinião — sem critério econômico comparável.",
    dependsOn: ["G-03"],
  },
  {
    code: "G-06",
    axis: "INFRASTRUCTURE" as MeridianAxis,
    severity: "MEDIUM" as const,
    effort: "L" as const,
    costOfDelay: 49,
    confidence: "DECLARED" as const,
    ownerLabel: "Plataforma",
    statement:
      "Sem ambiente segregado para experimentos com dado sensível; PoCs rodam na produção analítica.",
    dependsOn: ["G-01"],
  },
  {
    code: "G-07",
    axis: "PEOPLE" as MeridianAxis,
    severity: "LOW" as const,
    effort: "S" as const,
    costOfDelay: 31,
    confidence: "ESTIMATED" as const,
    ownerLabel: "RH",
    statement:
      "Papéis de dado (steward, owner) não formalizados nas descrições de cargo.",
    dependsOn: ["G-04"],
  },
  {
    code: "G-08",
    axis: "INFRASTRUCTURE" as MeridianAxis,
    severity: "LOW" as const,
    effort: "M" as const,
    costOfDelay: 27,
    confidence: "DECLARED" as const,
    ownerLabel: "Plataforma",
    statement:
      "Observabilidade de custo de inferência inexistente — risco de estouro silencioso em escala.",
    dependsOn: ["G-06"],
  },
];

// Coortes sintéticas do pool: uma acima do limiar (leitura liberada), outra
// abaixo (retida). São contribuições de organizações que não existem no tenant
// — o pool é global e anônimo por definição.
const SYNTHETIC_COHORTS: { key: string; orgs: number; base: number }[] = [
  { key: cohortKeyOf("Saúde", "200–1.000"), orgs: 10, base: 52 },
  { key: cohortKeyOf("Fintech", "50–200"), orgs: 7, base: 64 },
  { key: cohortKeyOf("Agronegócio", "200–1.000"), orgs: 2, base: 45 },
];

function toScoringQuestions(axis: MeridianAxis): ScoringQuestion[] {
  return QUESTIONS.filter((q) => q.axis === axis).map((q) => ({
    code: q.code,
    ordinal: q.ordinal,
    type: q.type,
    weight: q.weight,
    inverted: q.inverted,
    scaleLabels: q.scaleLabels,
  }));
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({
    adapter: new PrismaPg(pool),
  }) as PrismaClientType;

  const tenant = await db.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (!tenant) {
    throw new Error(
      `Tenant "${TENANT_SLUG}" não encontrado. Slugs disponíveis: ${(
        await db.tenant.findMany({ select: { slug: true } })
      )
        .map((t) => t.slug)
        .join(", ")}`
    );
  }
  const tenantId = tenant.id;

  console.log(`\n🧭  Seed Meridian → ${tenant.name} (${tenant.slug})\n`);

  await db.tenantModule.upsert({
    where: { tenantId_module: { tenantId, module: "MERIDIAN" } },
    create: {
      tenantId,
      module: "MERIDIAN",
      status: "ACTIVE",
      contractedAt: d("2026-03-01"),
    },
    update: { status: "ACTIVE" },
  });
  console.log("  ✓ módulo MERIDIAN contratado");

  const auth = betterAuth({
    database: prismaAdapter(db, { provider: "postgresql" }),
    emailAndPassword: { enabled: true },
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3012",
  });
  const passwordHash = await (await auth.$context).password.hash(
    PERSONA_PASSWORD
  );

  const personaIds: Record<string, string> = {};
  for (const p of PERSONAS) {
    const user = await db.user.upsert({
      where: { email: p.email },
      create: { email: p.email, name: p.name, emailVerified: true },
      update: { name: p.name },
    });
    personaIds[p.email] = user.id;

    await db.tenantMember.upsert({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      create: { tenantId, userId: user.id, role: "MEMBER" },
      update: {},
    });
    await db.meridianMembership.upsert({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      create: { tenantId, userId: user.id, role: p.role },
      update: { role: p.role },
    });

    const existing = await db.account.findFirst({
      where: { accountId: p.email, providerId: "credential" },
      select: { id: true },
    });
    if (existing) {
      await db.account.update({
        where: { id: existing.id },
        data: { password: passwordHash },
      });
    } else {
      await db.account.create({
        data: {
          accountId: p.email,
          providerId: "credential",
          userId: user.id,
          password: passwordHash,
        },
      });
    }
  }
  console.log(`  ✓ ${PERSONAS.length} personas (senha: ${PERSONA_PASSWORD})`);

  // Limpeza: apaga o domínio Meridian do tenant, na ordem que respeita as FKs.
  // Gaps antes de assessments porque a relação é Restrict — apagar o run não
  // pode apagar o registro canônico, e é justamente o que a ordem prova.
  await db.meridianGapPromotion.deleteMany({ where: { tenantId } });
  await db.meridianPlanItem.deleteMany({ where: { tenantId } });
  await db.meridianGapDependency.deleteMany({ where: { tenantId } });
  await db.meridianGap.deleteMany({ where: { tenantId } });
  await db.meridianOverride.deleteMany({ where: { tenantId } });
  await db.meridianAxisScore.deleteMany({ where: { tenantId } });
  await db.meridianEvidence.deleteMany({ where: { tenantId } });
  await db.meridianResponse.deleteMany({ where: { tenantId } });
  await db.meridianRespondent.deleteMany({ where: { tenantId } });
  await db.meridianAssessment.deleteMany({ where: { tenantId } });
  await db.meridianQuestion.deleteMany({ where: { tenantId } });
  await db.meridianTemplate.deleteMany({ where: { tenantId } });
  await db.meridianSequence.deleteMany({ where: { tenantId } });
  console.log("  ✓ domínio Meridian anterior removido");

  const template = await db.meridianTemplate.create({
    data: {
      tenantId,
      name: MERIDIAN_TEMPLATE_NAME,
      version: MERIDIAN_TEMPLATE_VERSION,
      contestedSpread: 25,
      gapThreshold: 60,
      lockedAt: d("2026-04-02"),
    },
  });
  for (const q of QUESTIONS) {
    await db.meridianQuestion.create({
      data: {
        tenantId,
        templateId: template.id,
        code: q.code,
        axis: q.axis,
        ordinal: q.ordinal,
        type: q.type,
        text: q.text,
        weight: q.weight,
        inverted: q.inverted,
        scaleLabels: q.scaleLabels,
      },
    });
  }
  const questionRows = await db.meridianQuestion.findMany({
    where: { templateId: template.id },
    select: { id: true, code: true, type: true, scaleLabels: true },
  });
  const questionByCode = new Map(questionRows.map((q) => [q.code, q]));
  console.log(`  ✓ template v3.2 · ${QUESTIONS.length} perguntas`);

  const consultant = personaIds["marina.duarte@nebuloz.exemplo"] as string;
  const secondConsultant = personaIds["tiago.ferraz@nebuloz.exemplo"] as string;

  // Run anterior, fechado — é ele que dá ao AS-104 contra o quê comparar.
  const previous = await db.meridianAssessment.create({
    data: {
      tenantId,
      code: "AS-092",
      orgName: "Vanta Saúde",
      sector: "Saúde",
      sizeBand: "200–1.000",
      templateId: template.id,
      status: "FINALISED",
      consultantId: consultant,
      openedAt: d("2025-11-10"),
      deadline: d("2025-12-05"),
      closedAt: d("2025-12-12"),
      benchmarkOptIn: true,
    },
  });
  const PREV_SCORES: Record<MeridianAxis, number> = {
    DATA: 39,
    PROCESS: 52,
    PEOPLE: 35,
    GOVERNANCE: 58,
    INFRASTRUCTURE: 49,
  };
  for (const axis of AXIS_IDS) {
    await db.meridianAxisScore.create({
      data: {
        tenantId,
        assessmentId: previous.id,
        axis,
        computed: PREV_SCORES[axis],
        confidence: 0.8,
        respondentCount: 1,
        spread: 4,
        status: "COMPUTED",
        computedAt: d("2025-12-12"),
      },
    });
  }

  const current = await db.meridianAssessment.create({
    data: {
      tenantId,
      code: "AS-104",
      orgName: "Vanta Saúde",
      sector: "Saúde",
      sizeBand: "200–1.000",
      templateId: template.id,
      status: "REVIEW",
      consultantId: consultant,
      openedAt: d("2026-07-14"),
      deadline: d("2026-08-01"),
      closedAt: d("2026-08-01"),
      benchmarkOptIn: true,
      reassessmentOfId: previous.id,
    },
  });

  const collecting = await db.meridianAssessment.create({
    data: {
      tenantId,
      code: "AS-107",
      orgName: "Helix Agro",
      sector: "Agronegócio",
      sizeBand: "200–1.000",
      templateId: template.id,
      status: "COLLECTING",
      consultantId: consultant,
      openedAt: d("2026-07-28"),
      deadline: daysAhead(18),
      benchmarkOptIn: true,
    },
  });

  await db.meridianAssessment.create({
    data: {
      tenantId,
      code: "AS-109",
      orgName: "Mira Varejo",
      sector: "Varejo",
      sizeBand: "1.000+",
      templateId: template.id,
      status: "DRAFT",
      consultantId: secondConsultant,
      openedAt: NOW,
      deadline: daysAhead(45),
      benchmarkOptIn: false,
    },
  });
  console.log("  ✓ 4 assessments (rascunho, coletando, revisão, finalizado)");

  const tokens: string[] = [];

  async function seedRespondents(
    assessmentId: string,
    deadline: Date,
    list: SeedRespondent[]
  ) {
    for (const r of list) {
      const token = randomBytes(32).toString("hex");
      const respondent = await db.meridianRespondent.create({
        data: {
          tenantId,
          assessmentId,
          name: r.name,
          role: r.role,
          email: r.email,
          axis: r.axis,
          status: r.status,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          tokenExpiresAt: deadline,
          invitedAt: d("2026-07-15"),
          completedAt: r.status === "DONE" ? d("2026-07-30") : null,
        },
      });
      if (r.status === "PENDING" || r.status === "OVERDUE") {
        tokens.push(`${r.name} (${r.axis}): /meridian-responder/${token}`);
      }

      for (const [code, rawValue] of Object.entries(r.answers)) {
        const q = questionByCode.get(code);
        const meta = QUESTIONS.find((x) => x.code === code);
        if (!(q && meta)) {
          continue;
        }
        await db.meridianResponse.create({
          data: {
            tenantId,
            respondentId: respondent.id,
            questionId: q.id,
            rawValue,
            normalized: normalizeAnswer(
              {
                code: meta.code,
                ordinal: meta.ordinal,
                type: meta.type,
                weight: meta.weight,
                inverted: meta.inverted,
                scaleLabels: meta.scaleLabels,
              },
              rawValue
            ),
            answeredAt: d("2026-07-30"),
          },
        });
      }
    }
  }

  await seedRespondents(current.id, d("2026-08-01"), AS104_RESPONDENTS);
  await seedRespondents(collecting.id, daysAhead(18), AS107_RESPONDENTS);
  console.log(
    `  ✓ ${AS104_RESPONDENTS.length + AS107_RESPONDENTS.length} respondentes com respostas`
  );

  // Scores do AS-104 pelo motor real, a partir das respostas acima.
  for (const axis of AXIS_IDS) {
    const answers = AS104_RESPONDENTS.filter((r) => r.axis === axis).flatMap(
      (r) =>
        Object.entries(r.answers).map(([questionCode, rawValue]) => ({
          respondentId: r.email,
          questionCode,
          rawValue,
        }))
    );
    const result = computeAxisScore(
      toScoringQuestions(axis),
      answers,
      template.contestedSpread
    );
    await db.meridianAxisScore.create({
      data: {
        tenantId,
        assessmentId: current.id,
        axis,
        computed: result.score,
        confidence: result.confidence,
        respondentCount: result.respondentCount,
        spread: result.spread,
        status: result.status,
        note: result.note,
        computedAt: d("2026-08-01"),
      },
    });
  }

  // Override em Governance: o computado premia o documento, e a evidência mostra
  // que o comitê nunca operou. É o caso que a tela existe para tornar defensável.
  const governance = await db.meridianAxisScore.findUnique({
    where: {
      assessmentId_axis: { assessmentId: current.id, axis: "GOVERNANCE" },
    },
  });
  if (governance) {
    const to = Math.max(0, governance.computed - 8);
    await db.meridianOverride.create({
      data: {
        tenantId,
        assessmentId: current.id,
        axis: "GOVERNANCE",
        code: "OV-01",
        fromScore: governance.computed,
        toScore: to,
        rationale:
          "Política existe e é versionada, mas nunca passou por um ciclo real de enforcement — evidência mostra zero casos revisados pelo comitê em seis meses. O score computado premia documento, não prática.",
        reviewerId: consultant,
        createdAt: d("2026-08-04"),
      },
    });
    await db.meridianAxisScore.update({
      where: { id: governance.id },
      data: { final: to, status: "OVERRIDDEN" },
    });
  }
  console.log("  ✓ scores por eixo + 1 override com justificativa");

  const gapIdByCode = new Map<string, string>();
  for (const g of MANUAL_GAPS) {
    const created = await db.meridianGap.create({
      data: {
        tenantId,
        code: g.code,
        assessmentId: current.id,
        axis: g.axis,
        statement: g.statement,
        severity: g.severity,
        effort: g.effort,
        costOfDelay: g.costOfDelay,
        confidence: g.confidence,
        ownerLabel: g.ownerLabel,
        state: "OPEN",
        derived: false,
      },
    });
    gapIdByCode.set(g.code, created.id);
  }
  for (const g of MANUAL_GAPS) {
    for (const dep of g.dependsOn) {
      await db.meridianGapDependency.create({
        data: {
          tenantId,
          gapId: gapIdByCode.get(g.code) as string,
          dependsOnGapId: gapIdByCode.get(dep) as string,
        },
      });
    }
  }
  await db.meridianSequence.create({
    data: { tenantId, kind: "gap", next: MANUAL_GAPS.length + 1 },
  });
  await db.meridianSequence.create({
    data: { tenantId, kind: "assessment", next: 110 },
  });
  await db.meridianSequence.create({
    data: { tenantId, kind: "override", next: 2 },
  });
  console.log(`  ✓ ${MANUAL_GAPS.length} gaps com DAG de dependências`);

  const plan = buildPlan(
    MANUAL_GAPS.map((g) => ({ code: g.code, costOfDelay: g.costOfDelay })),
    MANUAL_GAPS.flatMap((g) => g.dependsOn.map((to) => ({ from: g.code, to })))
  );
  for (const item of plan) {
    await db.meridianPlanItem.create({
      data: {
        tenantId,
        assessmentId: current.id,
        gapId: gapIdByCode.get(item.gapCode) as string,
        quarter: item.quarter,
        seq: item.seq,
        capacityNote: "1 squad interna + retainer Nebuloz",
      },
    });
  }
  await db.meridianGap.updateMany({
    where: { tenantId, assessmentId: current.id, state: "OPEN" },
    data: { state: "PLANNED" },
  });

  // Um gap promovido, para a regra de fronteira ter caso concreto na tela.
  await db.meridianGapPromotion.create({
    data: {
      tenantId,
      gapId: gapIdByCode.get("G-01") as string,
      targetProduct: "COSMOS",
      targetEntityId: "EP-2140",
      targetLabel: "Catálogo e linhagem de fontes clínicas",
      promotedById: consultant,
      promotedAt: d("2026-08-05"),
    },
  });
  await db.meridianGap.update({
    where: { id: gapIdByCode.get("G-01") as string },
    data: { state: "PROMOTED" },
  });
  console.log(`  ✓ plano de 12 meses (${plan.length} itens) + 1 promoção`);

  // Pool de benchmark. Coortes sintéticas: uma acima do limiar, uma no limite e
  // uma abaixo — as três leituras que a tela precisa demonstrar.
  await db.meridianBenchmarkContribution.deleteMany({
    where: { assessmentId: { in: [current.id, previous.id] } },
  });
  for (const cohort of SYNTHETIC_COHORTS) {
    await db.meridianBenchmarkCohort.deleteMany({
      where: { cohortKey: cohort.key },
    });
    const bands = Object.fromEntries(
      AXIS_IDS.map((axis, i) => [
        axis,
        percentiles(
          Array.from(
            { length: Math.max(1, cohort.orgs) },
            (_, k) => cohort.base + ((k * 7 + i * 3) % 25) - 12
          )
        ),
      ])
    );
    await db.meridianBenchmarkCohort.create({
      data: { cohortKey: cohort.key, n: cohort.orgs, percentiles: bands },
    });
  }
  // Vanta contribui de verdade (opt-in ativo): é o que leva a coorte de saúde
  // de 10 para 11 e cruza com folga o limiar de leitura.
  const finalScores = await db.meridianAxisScore.findMany({
    where: { assessmentId: current.id },
  });
  const healthKey = cohortKeyOf("Saúde", "200–1.000");
  for (const s of finalScores) {
    await db.meridianBenchmarkContribution.create({
      data: {
        cohortKey: healthKey,
        assessmentId: current.id,
        axis: s.axis,
        score: s.final ?? s.computed,
      },
    });
  }
  await db.meridianBenchmarkCohort.update({
    where: { cohortKey: healthKey },
    data: { n: 11 },
  });
  console.log(
    `  ✓ ${SYNTHETIC_COHORTS.length} coortes (1 retida, abaixo do limiar)`
  );

  console.log(`
✅ Seed Meridian concluído.

  Login:  ${PERSONAS[0]?.email} / ${PERSONA_PASSWORD}
  Abrir:  /meridian

  Links de respondente (bateria por eixo, sem conta):
${tokens.map((t) => `    ${t}`).join("\n")}
`);

  await db.$disconnect();
  await pool.end();
}

/** Guarda de entrypoint: main() apaga e recria o domínio Meridian do tenant.
 *  Sem ela, qualquer import deste módulo dispararia o seed destrutivo. */
const isEntrypoint =
  !!process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (isEntrypoint) {
  main().catch((err) => {
    console.error("❌ seed-meridian falhou:", err);
    process.exit(1);
  });
}
