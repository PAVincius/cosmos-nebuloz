"use server";

import {
  createRebalanceTrace,
  flushLangfuse,
  resolveModelName,
} from "@repo/ai/lib/langfuse";
import { getActiveProvider, getAIModel } from "@repo/ai/lib/models";
import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { generateObject } from "ai";
import { headers } from "next/headers";
import { z } from "zod";
import { getMemberVelocityStats } from "@/app/actions/velocity";
import { getWSJFConfig } from "@/app/actions/wsjf";
import type { AIAccessStatus, RebalancingResult } from "./rebalance-schema";

// ─── Plan gating ─────────────────────────────────────────────────────────────

const AI_REBALANCE_LIMITS: Record<string, number> = {
  ORBIT: 1, // trial vitalício
  GALAXY: 5, // por PI
  NEBULA: 20, // por PI
  UNIVERSE: Number.POSITIVE_INFINITY,
};

type AIUsageMeta = {
  currentPiId: string | null;
  usedThisPi: number;
  usedTotal: number;
};

export async function getAIAccessStatus(): Promise<AIAccessStatus> {
  const ctx = await requireTenantSession(await headers());

  const tenant = await database.tenant.findFirst({
    where: { id: ctx.tenantId },
    select: { plan: true, metadata: true },
  });
  if (!tenant) {
    throw new Error("Tenant não encontrado");
  }

  const plan = tenant.plan as string;
  const limit = AI_REBALANCE_LIMITS[plan] ?? 0;
  // Use dedicated namespace `wsjfAiUsage` to avoid collision with copilot chat quota
  // which writes to `aiUsage` with different field names (copilotUsedTotal etc.)
  const rawUsage = (tenant.metadata as Record<string, unknown>)?.wsjfAiUsage as
    | Partial<AIUsageMeta>
    | undefined;
  const meta: AIUsageMeta = {
    currentPiId: rawUsage?.currentPiId ?? null,
    usedThisPi: rawUsage?.usedThisPi ?? 0,
    usedTotal: rawUsage?.usedTotal ?? 0,
  };

  // Detect PI rotation
  const latestPi = await database.pIPlan.findFirst({
    where: { tenantId: ctx.tenantId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const currentPiId = latestPi?.id ?? null;
  const piChanged = currentPiId && currentPiId !== meta.currentPiId;
  const usedThisPi = piChanged ? 0 : meta.usedThisPi;

  if (limit === Number.POSITIVE_INFINITY) {
    return {
      allowed: true,
      plan,
      limit,
      usedThisPi,
      usedTotal: meta.usedTotal,
      remainingUses: -1,
    };
  }

  // ORBIT: lifetime limit (1 trial)
  if (plan === "ORBIT") {
    const allowed = meta.usedTotal < limit;
    return {
      allowed,
      plan,
      limit,
      usedThisPi: meta.usedTotal,
      usedTotal: meta.usedTotal,
      remainingUses: Math.max(0, limit - meta.usedTotal),
      reason: allowed
        ? undefined
        : "Seu plano ORBIT inclui 1 uso trial gratuito. Faça upgrade para continuar.",
    };
  }

  const allowed = usedThisPi < limit;
  return {
    allowed,
    plan,
    limit,
    usedThisPi,
    usedTotal: meta.usedTotal,
    remainingUses: Math.max(0, limit - usedThisPi),
    reason: allowed
      ? undefined
      : `Limite de ${limit} usos por PI atingido no plano ${plan}. Próximo PI libera novo ciclo.`,
  };
}

async function incrementAIUsage(tenantId: string): Promise<void> {
  const tenant = await database.tenant.findFirst({
    where: { id: tenantId },
    select: { metadata: true },
  });

  const latestPi = await database.pIPlan.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const currentMeta = (tenant?.metadata as Record<string, unknown>) ?? {};
  const rawUsage = currentMeta.wsjfAiUsage as Partial<AIUsageMeta> | undefined;
  const currentUsage: AIUsageMeta = {
    currentPiId: rawUsage?.currentPiId ?? null,
    usedThisPi: rawUsage?.usedThisPi ?? 0,
    usedTotal: rawUsage?.usedTotal ?? 0,
  };
  const piChanged = latestPi?.id && latestPi.id !== currentUsage.currentPiId;

  await database.tenant.update({
    where: { id: tenantId },
    data: {
      metadata: {
        ...currentMeta,
        wsjfAiUsage: {
          currentPiId: latestPi?.id ?? currentUsage.currentPiId,
          usedThisPi: piChanged ? 1 : currentUsage.usedThisPi + 1,
          usedTotal: currentUsage.usedTotal + 1,
        } satisfies AIUsageMeta,
      },
    },
  });
}

// ─── Output Schema ────────────────────────────────────────────────────────────
// Modelos às vezes devolvem números como string ou rótulos fora do enum; coerção
// + normalização reduz falhas de validação ("response did not match schema").
// featureTitle/epicTitle são omitidos do schema LLM e enriquecidos via lookup
// após a chamada — evita o LLM repetir dados que já temos (economiza ~15% output).

const IMPACT_FACTOR_VALUES = [
  "team_capacity",
  "dependency",
  "deadline",
  "member_availability",
  "velocity_trend",
  "priority_drift",
] as const;

type ImpactFactor = (typeof IMPACT_FACTOR_VALUES)[number];

function normalizeImpactFactor(raw: unknown): ImpactFactor {
  if (typeof raw !== "string") {
    return "priority_drift";
  }
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if ((IMPACT_FACTOR_VALUES as readonly string[]).includes(s)) {
    return s as ImpactFactor;
  }
  const aliases: Record<string, ImpactFactor> = {
    capacidade: "team_capacity",
    capacidade_do_time: "team_capacity",
    dependencia: "dependency",
    prazo: "deadline",
    disponibilidade: "member_availability",
    disponibilidade_do_membro: "member_availability",
    velocidade: "velocity_trend",
    tendencia_de_velocidade: "velocity_trend",
    deriva: "priority_drift",
    deriva_de_prioridade: "priority_drift",
    drift: "priority_drift",
  };
  return aliases[s] ?? "priority_drift";
}

// Schema interno: sem featureTitle/epicTitle (enriquecidos pós-chamada)
const FeatureSuggestionLLMSchema = z.object({
  featureId: z.string(),
  currentBV: z.coerce.number(),
  currentTC: z.coerce.number(),
  currentRR: z.coerce.number(),
  currentJS: z.coerce.number(),
  currentWSJF: z.coerce.number(),
  suggestedBV: z.coerce.number(),
  suggestedTC: z.coerce.number(),
  suggestedRR: z.coerce.number(),
  suggestedJS: z.coerce.number(),
  suggestedWSJF: z.coerce.number(),
  delta: z.coerce.number(),
  justification: z.string(),
  impactFactor: z.preprocess(
    (v) => normalizeImpactFactor(v),
    z.enum(IMPACT_FACTOR_VALUES)
  ),
  confidence: z.coerce.number().min(0).max(1),
});

const RebalancingLLMSchema = z.object({
  modifiedCount: z.coerce.number(),
  unchangedCount: z.coerce.number(),
  portfolioInsight: z.string(),
  suggestions: z.array(FeatureSuggestionLLMSchema),
});

// ─── Agent 1: Context Collector ───────────────────────────────────────────────

type PortfolioContext = Awaited<ReturnType<typeof buildPortfolioContext>>;

async function buildPortfolioContext(tenantId: string) {
  const [epics, teams, config] = await Promise.all([
    database.epic.findMany({
      where: { tenantId },
      include: {
        features: {
          include: {
            blocks: { select: { blockedFeatureId: true } },
            blockedBy: { select: { blockingFeatureId: true } },
          },
        },
      },
    }),
    database.team.findMany({ where: { tenantId } }),
    getWSJFConfig(),
  ]);

  const assigneeIds = [
    ...new Set(
      epics.flatMap((e) =>
        e.features
          .map((f) => f.assigneeUserId)
          .filter((id): id is string => !!id)
      )
    ),
  ];

  const memberVelocities = await Promise.all(
    assigneeIds.map(async (userId) => {
      const stats = await getMemberVelocityStats(userId).catch(() => null);
      return stats ? { userId, avgSPPerSprint: stats.avgSPPerSprint } : null;
    })
  );
  const velocityMap = Object.fromEntries(
    memberVelocities
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .map((v) => [v.userId, v.avgSPPerSprint])
  );

  return {
    epics: epics.map((epic) => ({
      id: epic.id,
      title: epic.title,
      status: epic.statusId,
      features: epic.features.map((f) => ({
        id: f.id,
        title: f.title,
        status: f.statusId,
        sp: f.storyPoints,
        bv: f.bv,
        tc: f.tc,
        rr: f.rr,
        js: f.js,
        wsjf: f.wsjfScore,
        velSP: f.assigneeUserId
          ? (velocityMap[f.assigneeUserId] ?? null)
          : null,
        // Send counts only — UUID arrays add noise without semantic value
        blocks: f.blocks.length,
        blockedBy: f.blockedBy.length,
        completedAt: f.completedAt?.toISOString() ?? null,
      })),
    })),
    teams: teams.map((t) => ({
      name: t.name,
      velocity: t.velocity,
      sprintDays: t.sprintLengthDays,
      members: Array.isArray(t.members) ? (t.members as unknown[]).length : 0,
    })),
    scale: config.scale,
    totalFeatures: epics.reduce((s, e) => s + e.features.length, 0),
    totalEpics: epics.length,
  };
}

// ─── Title lookup ─────────────────────────────────────────────────────────────

function buildTitleMap(
  context: PortfolioContext
): Map<string, { featureTitle: string; epicTitle: string }> {
  const map = new Map<string, { featureTitle: string; epicTitle: string }>();
  for (const epic of context.epics) {
    for (const f of epic.features) {
      map.set(f.id, { featureTitle: f.title, epicTitle: epic.title });
    }
  }
  return map;
}

// ─── Role personas ────────────────────────────────────────────────────────────

const ROLE_PERSONAS: Record<
  string,
  { title: string; audience: string; tone: string }
> = {
  ADMIN: {
    title: "Administrador de Plataforma",
    audience: "liderança executiva e gestores de portfólio",
    tone: "executivo e orientado a governança — linguagem de C-level, foco em risco, ROI e alinhamento estratégico",
  },
  STE: {
    title: "System Team Engineer",
    audience: "arquitetos de solução e líderes técnicos sênior",
    tone: "técnico-gerencial — equilibra viabilidade de entrega, dívida técnica e valor de negócio com precisão de engenharia",
  },
  RTE: {
    title: "Release Train Engineer",
    audience: "Product Managers, Product Owners e Scrum Masters do ART",
    tone: "operacional e orientado a fluxo — linguagem SAFe, foco em impedimentos, capacidade de time e cadência de entrega",
  },
};

// ─── Prompt caching: parte estática separada da dinâmica ─────────────────────
// Anthropic: cache hit = 0.1x custo de input (90% desconto).
// OpenAI: automático para prompts >1024 tokens (50% desconto).
// A parte estática nunca muda entre chamadas → sempre cache hit após 1ª.

const STATIC_WSJF_RULES = `Você é um especialista SAFe 6.0 em priorização WSJF.

REGRAS OBRIGATÓRIAS:
1. Use SOMENTE valores da escala fornecida para BV, TC, RR, JS
2. WSJF = (BV+TC+RR)/JS — arredonde 1 casa decimal
3. Só sugira mudança com evidência concreta (velSP, blocks, blockedBy, status, completedAt)
4. NÃO infle scores — features bem priorizadas: mantenha-as
5. Justificativa: 2 frases em português formal, citando dado específico
6. modifiedCount = features com delta≠0; unchangedCount = features com delta=0
7. delta = suggestedWSJF - currentWSJF (negativo = feature superestimada)
8. portfolioInsight: síntese executiva 2-3 frases
9. impactFactor: exatamente um de: team_capacity|dependency|deadline|member_availability|velocity_trend|priority_drift
10. Campos numéricos: números JSON, não strings
11. confidence: 0.0–1.0 refletindo certeza da sugestão com base nos dados disponíveis

EXEMPLOS DE RACIOCÍNIO CORRETO:

Exemplo A — feature bloqueando outras, assignee sem velocity histórica:
  Dados: {id:"f1", bv:5, tc:3, rr:2, js:2, wsjf:5.0, blocks:3, blockedBy:0, velSP:null, status:"IN_PROGRESS"}
  Raciocínio: Feature bloqueia 3 outras (alto TC implícito), mas assignee sem histórico de velocity
  torna o JS incerto. JS=2 subestima o risco de atraso; ajustar para 3 reduz WSJF corretamente.
  Resultado: suggestedBV=5,suggestedTC=5,suggestedRR=2,suggestedJS=3 → suggestedWSJF=4.0
  delta=-1.0, impactFactor=dependency, confidence=0.82

Exemplo B — feature entregue (completedAt preenchido), não rebalancear:
  Dados: {id:"f2", bv:8, tc:5, rr:3, js:1, wsjf:16.0, blocks:0, blockedBy:0, completedAt:"2025-03-01", status:"DONE"}
  Raciocínio: Feature já entregue. Alterar scores de feature concluída não afeta o portfólio ativo.
  Resultado: manter todos os valores, delta=0, impactFactor=priority_drift, confidence=0.95

Exemplo C — feature com velocity baixa e bloqueada, JS subestimado:
  Dados: {id:"f3", bv:3, tc:2, rr:1, js:1, wsjf:6.0, blockedBy:2, velSP:18, status:"TODO"}
  Raciocínio: velocity de 18 SP/sprint é baixa; estar bloqueada por 2 features aumenta o risco real.
  JS=1 é otimista demais — ajustar para 2 reflete melhor o custo de espera.
  Resultado: suggestedBV=3,suggestedTC=2,suggestedRR=1,suggestedJS=2 → suggestedWSJF=3.0
  delta=-3.0, impactFactor=velocity_trend, confidence=0.75`;

function buildWSJFMessages(context: PortfolioContext, role: string) {
  const persona = ROLE_PERSONAS[role] ?? ROLE_PERSONAS.RTE;
  const features = context.epics.flatMap((e) =>
    e.features.map((f) => ({
      id: f.id,
      epic: e.title,
      title: f.title,
      status: f.status,
      sp: f.sp,
      bv: f.bv,
      tc: f.tc,
      rr: f.rr,
      js: f.js,
      wsjf: f.wsjf,
      velSP: f.velSP,
      blocks: f.blocks,
      blockedBy: f.blockedBy,
      completedAt: f.completedAt,
    }))
  );

  const dynamicData = `PAPEL: ${persona.title}. Audiência: ${persona.audience}. Tom: ${persona.tone}.
PORTFÓLIO — Times: ${JSON.stringify(context.teams)} | Escala: ${context.scale.join(",")}
FEATURES: ${JSON.stringify(features)}`;

  return [
    {
      role: "user" as const,
      content: [
        {
          type: "text" as const,
          text: STATIC_WSJF_RULES,
          // Cache efêmero da Anthropic (TTL 5 min). Outros providers ignoram.
          //
          // O campo era `experimental_providerMetadata`, que é o nome do AI SDK
          // v4 — removido na v5, que este repo usa. A chave não existia no tipo
          // nem no runtime, então o `cache_control` nunca chegou a ser enviado:
          // dois anos de marcador inerte sem nenhum erro para denunciá-lo.
          //
          // Atenção ao mínimo de prefixo: no Haiku 4.5 são 4096 tokens, não os
          // 1024 que o comentário antigo afirmava. Abaixo disso a Anthropic
          // ignora o marcador em silêncio (`cache_creation_input_tokens: 0`).
          // STATIC_WSJF_RULES sozinho fica perto de 2,4k — só passa do mínimo
          // somando o schema de tool que o `generateObject` injeta. Confirme
          // em `usage.cachedInputTokens` antes de contar com a economia.
          providerOptions: {
            anthropic: { cacheControl: { type: "ephemeral" } },
          },
        },
        {
          type: "text" as const,
          text: dynamicData,
        },
      ],
    },
  ];
}

// ─── Main Server Action ───────────────────────────────────────────────────────

export async function rebalanceWSJFWithAI(): Promise<RebalancingResult> {
  const ctx = await requireTenantSession(await headers());
  requireRole(["ADMIN", "STE", "RTE"], ctx);

  // Check plan gating
  const access = await getAIAccessStatus();
  if (!access.allowed) {
    throw new Error(access.reason ?? "Limite de uso atingido para seu plano.");
  }

  // Check AI availability
  const provider = getActiveProvider();
  if (provider === "none") {
    throw new Error(
      "Nenhuma chave de IA configurada. Configure ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY ou OPENAI_API_KEY no servidor."
    );
  }

  const model = getAIModel(provider);

  // Agent 1: Build context
  const context = await buildPortfolioContext(ctx.tenantId);

  if (context.totalFeatures === 0) {
    throw new Error(
      "Nenhuma feature encontrada no portfólio para rebalancear."
    );
  }

  const userRole = ctx.role as string;
  const modelName = resolveModelName(provider);

  // ── Langfuse root trace ──────────────────────────────────────────────────
  const trace = createRebalanceTrace({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    role: userRole,
    provider,
    totalFeatures: context.totalFeatures,
    totalEpics: context.totalEpics,
  });

  // ── Agent 1: Context Collector (no AI) ──────────────────────────────────
  const span1 = trace?.span({
    name: "agent-1-context-collector",
    input: { tenantId: ctx.tenantId },
  });
  span1?.end({
    output: {
      totalEpics: context.totalEpics,
      totalFeatures: context.totalFeatures,
      teamsLoaded: context.teams.length,
      wsjfScale: context.scale,
    },
  });

  // ── Agent 2: WSJF Rebalancer (análise + rebalance em única chamada) ──────
  const messages = buildWSJFMessages(context, userRole);
  const titleMap = buildTitleMap(context);

  const gen = trace?.generation({
    name: "agent-wsjf-rebalancer",
    model: modelName,
    input: messages,
    metadata: {
      role: userRole,
      provider,
      schemaFields: Object.keys(RebalancingLLMSchema.shape),
    },
  });

  const {
    object: raw,
    usage,
    providerMetadata,
  } = await generateObject({
    model,
    schema: RebalancingLLMSchema,
    messages,
    maxRetries: 3,
    maxOutputTokens: 3000,
    // NOTE: extended thinking is incompatible with generateObject because
    // the Vercel AI SDK sets tool_choice="required" for schema enforcement,
    // and Anthropic rejects thinking when tool_choice forces a tool.
  });

  gen?.end({
    output: {
      modifiedCount: raw.modifiedCount,
      unchangedCount: raw.unchangedCount,
    },
    usage: {
      input: usage.inputTokens,
      output: usage.outputTokens,
      total:
        usage.totalTokens ??
        (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
      unit: "TOKENS",
    },
  });

  // Instrumentação do cache — é o que diz se `cacheControl` em buildMessages
  // está pegando. Falha de cache não gera erro: só zera silenciosamente.
  const cacheRead = usage.cachedInputTokens ?? 0;
  const cacheWrite = Number(
    (providerMetadata?.anthropic as Record<string, unknown> | undefined)
      ?.cacheCreationInputTokens ?? 0
  );

  // Enrich with titles + filter low-confidence suggestions (< 0.6 descartadas)
  const CONFIDENCE_THRESHOLD = 0.6;
  const enriched = raw.suggestions.map((s) => ({
    ...s,
    featureTitle: titleMap.get(s.featureId)?.featureTitle ?? s.featureId,
    epicTitle: titleMap.get(s.featureId)?.epicTitle ?? "",
  }));
  const confident = enriched.filter(
    (s) => s.confidence >= CONFIDENCE_THRESHOLD
  );
  const result: RebalancingResult = {
    ...raw,
    suggestions: confident,
    modifiedCount: confident.filter((s) => s.delta !== 0).length,
    unchangedCount: confident.filter((s) => s.delta === 0).length,
  };

  // ── Scores automáticos ───────────────────────────────────────────────────
  const totalTokens = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);

  trace?.score({ name: "features_modified", value: result.modifiedCount });
  trace?.score({
    name: "modification_rate",
    value:
      context.totalFeatures > 0
        ? Math.round((result.modifiedCount / context.totalFeatures) * 100) / 100
        : 0,
  });
  trace?.score({ name: "total_tokens_used", value: totalTokens });
  trace?.score({ name: "cache_read_tokens", value: cacheRead });
  trace?.score({ name: "cache_write_tokens", value: cacheWrite });
  trace?.update({
    output: {
      modifiedCount: result.modifiedCount,
      unchangedCount: result.unchangedCount,
      totalTokens,
    },
    metadata: {
      cacheRead,
      cacheWrite,
      avgDelta:
        result.suggestions.length > 0
          ? Math.round(
              (result.suggestions
                .filter((s) => s.delta !== 0)
                .reduce((sum, s) => sum + Math.abs(s.delta), 0) /
                Math.max(result.modifiedCount, 1)) *
                10
            ) / 10
          : 0,
    },
  });

  incrementAIUsage(ctx.tenantId).catch(() => null);
  flushLangfuse().catch(() => null);

  return result;
}
