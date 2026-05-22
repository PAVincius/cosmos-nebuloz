import type { CoreMessage } from "ai";
import { sanitizeForPrompt } from "@/lib/prompt-sanitize";
import type { CopilotContext } from "../context";

// Static SAFe base rules — cached by Anthropic ephemeral cache after first call (90% cost reduction)
const COPILOT_BASE_RULES = `Você é o SAFe AI Copilot do COSMOS, especialista em SAFe 6.0.

PRINCÍPIOS OBRIGATÓRIOS:
1. Responda sempre com base nos dados reais do tenant fornecidos no contexto
2. Seja específico: cite entidades pelo nome, use números concretos
3. Respostas em português, estilo direto, sem rodeios desnecessários
4. Quando sugerir ações: use o formato de lista clara com bullets
5. Nunca invente dados — se não houver dado, diga claramente
6. Não execute ações de escrita — sugira e aguarde confirmação do usuário
7. Ao citar métricas SAFe: Flow Velocity = items/sprint, Flow Efficiency = %ativo/total, Flow Predictability = entregue/planejado
8. Riscos ROAM: Resolved, Owned, Accepted, Mitigated

CONTEXTO DISPONÍVEL (injetado dinamicamente por mensagem):
- PI Workspace: objetivos de PI, riscos, features, dependências, times
- Flow Dashboard: Flow Metrics (velocity, efficiency, predictability, load), ações de melhoria
- Lean Budget: temas estratégicos, orçamentos, épicos governados
- Portfolio: temas, épicos, OKRs ativos, resumo de fluxo

FORMATO DE SUGESTÕES DE AÇÃO:
Quando sugerir ações que o usuário pode executar no COSMOS, use este formato:
<suggestion type="create_risks|create_pi_objectives|flag_dependencies|create_improvement_action">
{ "items": [...] }
</suggestion>

FERRAMENTAS DISPONÍVEIS (use somente após confirmação explícita do usuário):
- createFeature: Cria uma feature no backlog com parâmetros WSJF (bv, tc, rr, js)
- moveFeature: Move uma feature para um novo status (BACKLOG, IN_PROGRESS, DONE, CANCELLED)
- queryFlowMetrics, queryLeanBudget, queryProgramBoard, queryRiskVectors: Consultas de dados (sem efeito colateral)

REGRAS PARA AÇÕES DE ESCRITA:
- SEMPRE apresente o que será criado/alterado e aguarde confirmação antes de executar createFeature ou moveFeature
- Informe o WSJF calculado antes de criar features: WSJF = (bv + tc + rr) / js
- Confirme as alterações após execução bem-sucedida`;

type ModePersona = {
  title: string;
  role: string;
  focus: string;
  style: string;
  audience: string;
};

const MODE_PERSONAS: Record<string, ModePersona> = {
  rte: {
    title: "RTE / ART Copilot",
    role: "Release Train Engineer",
    focus:
      "saúde do ART, PI Planning, dependências, riscos ROAM, Inspect & Adapt, Flow Metrics",
    style:
      "operacional, orientado a fluxo, linguagem SAFe, foco em impedimentos e cadência",
    audience: "RTE, liderança do ART, PMs e POs do trem",
  },
  lpm: {
    title: "LPM / Portfolio Copilot",
    role: "Lean Portfolio Manager",
    focus:
      "decisões de portfólio, Lean Budget & guardrails, temas estratégicos, governança de épicos",
    style:
      "executivo, orientado a investimento e ROI, linguagem de portfólio SAFe",
    audience: "LPM, Finance, C-level, Business Owners",
  },
  pm: {
    title: "PM / PO Copilot",
    role: "Product Manager / Product Owner",
    focus:
      "visão de produto, objetivos de PI, backlog, OKRs, riscos de features",
    style: "orientado a valor, centrado no cliente, linguagem de produto",
    audience: "Product Managers, Product Owners, stakeholders de produto",
  },
  team: {
    title: "Team / SM Copilot",
    role: "Scrum Master / Team Lead",
    focus: "saúde do time, impedimentos, WIP, flow local, acordos de time",
    style: "colaborativo, focado em time, linguagem ágil prática",
    audience: "Scrum Masters, Team Leads, membros do time",
  },
  spc: {
    title: "SPC / Coach Copilot",
    role: "SAFe Program Consultant / Agile Coach",
    focus:
      "Measure & Grow, evolução de competências, Inspect & Adapt, melhoria contínua",
    style: "analítico, orientado a dados, linguagem de coaching SAFe",
    audience: "SPCs, Agile Coaches, liderança de transformação",
  },
  global: {
    title: "COSMOS Copilot",
    role: "Assistente SAFe Geral",
    focus: "visão geral do ART, portfólio, fluxo e saúde organizacional",
    style: "adaptável ao contexto, linguagem SAFe acessível",
    audience: "todos os papéis SAFe",
  },
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: context summarizer needs to handle all SAFe domain branches
function summarizeContext(ctx: CopilotContext): string {
  const parts: string[] = [
    `MODO: ${ctx.mode.toUpperCase()} | SURFACE: ${ctx.surface}`,
  ];

  if (ctx.piWorkspace) {
    const pw = ctx.piWorkspace;
    parts.push(
      `\nPI WORKSPACE — ${sanitizeForPrompt(pw.artName)} | ${sanitizeForPrompt(pw.piName)} (${pw.piDates.start ?? "?"} → ${pw.piDates.end ?? "?"})`,
      `Objetivos de PI: ${pw.objectives.length} | Risks: ${pw.risks.length} (${pw.risks.filter((r) => r.status === "IDENTIFIED").length} IDENTIFIED)`,
      `Features: ${pw.features.length} | Bloqueadas: ${pw.features.filter((f) => f.blockedByCount > 0).length}`,
      `Times: ${pw.teams.map((t) => `${sanitizeForPrompt(t.name)}(vel:${t.velocity ?? "?"})`).join(", ")}`,
      `Objetivos: ${JSON.stringify(pw.objectives.slice(0, 5))}`,
      `Riscos críticos: ${JSON.stringify(pw.risks.filter((r) => r.impact === "critical" || r.impact === "high").slice(0, 5))}`
    );
  }

  if (ctx.flowMetrics) {
    const fm = ctx.flowMetrics;
    const latest = fm.snapshots[0];
    if (latest) {
      parts.push(
        `\nFLOW METRICS (último período: ${latest.periodRef ?? "?"})`,
        `Velocity: ${latest.flowVelocityTotal} | Load: ${latest.flowLoadCurrent} | Efficiency: ${latest.flowEfficiency}`,
        `Predictability: ${latest.flowPredictability} | LeadTimeAvg: ${latest.flowTimeAvgHours}h`,
        `Ações abertas: ${fm.openImprovementActions.length}`,
        `Snapshots: ${JSON.stringify(fm.snapshots.slice(0, 3))}`
      );
    }
  }

  if (ctx.leanBudget) {
    const lb = ctx.leanBudget;
    parts.push(
      `\nLEAN BUDGET — ${lb.leanBudgets.length} budgets | ${lb.themes.length} temas ativos`,
      `Temas: ${JSON.stringify(lb.themes.slice(0, 5))}`,
      `Budgets: ${JSON.stringify(lb.leanBudgets.slice(0, 5))}`,
      `Épicos governados: ${lb.governedEpics.length}`
    );
  }

  if (ctx.portfolio) {
    const p = ctx.portfolio;
    parts.push(
      `\nPORTFÓLIO — ${p.themes.length} temas | ${p.epics.length} épicos | ${p.activeOkrs.length} OKRs ativos`,
      p.recentFlowSummary
        ? `Flow médio: vel=${p.recentFlowSummary.avgVelocity}, eff=${p.recentFlowSummary.avgEfficiency}, pred=${p.recentFlowSummary.avgPredictability}`
        : "Sem dados de flow",
      `Temas: ${JSON.stringify(p.themes.slice(0, 5))}`,
      `OKRs: ${JSON.stringify(p.activeOkrs.slice(0, 5))}`
    );
  }

  if (ctx.wsjf) {
    const w = ctx.wsjf;
    const topList = w.topFeatures
      .map(
        (f) =>
          `[WSJF:${f.wsjfScore.toFixed(1)} bv=${f.bv} tc=${f.tc} rr=${f.rr} js=${f.js}] ${sanitizeForPrompt(f.title)} (${f.statusId})`
      )
      .join("\n");
    const objList = w.recentObjectives
      .map(
        (o) =>
          `[BV:${o.businessValue}${o.isStretch ? " STRETCH" : ""}] ${sanitizeForPrompt(o.title)} (${o.status})`
      )
      .join("\n");
    parts.push(
      `\nWSJF PRIORIZAÇÃO — Backlog total: ${w.backlogSize} features`,
      w.topFeatures.length > 0
        ? `Top ${w.topFeatures.length} features por WSJF:\n${topList}`
        : "Sem features com WSJF calculado",
      w.recentObjectives.length > 0
        ? `Objetivos PI por Business Value:\n${objList}`
        : "Sem objetivos de PI"
    );
  }

  // Strip any <suggestion> tags that may appear in tenant data (prompt injection defense)
  return parts.join("\n").replace(/<\/?suggestion\b[^>]*>/gi, "[blocked]");
}

export function getModeMessages(
  mode: string,
  context: CopilotContext,
  userMessages: CoreMessage[]
): CoreMessage[] {
  const persona = MODE_PERSONAS[mode] ?? MODE_PERSONAS.global;

  const staticBlock: CoreMessage = {
    role: "user",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: [
      {
        type: "text",
        text: COPILOT_BASE_RULES,
        // Anthropic ephemeral cache: TTL 5min, min 1024 tokens — 90% cost reduction after first call
        // Cast needed: experimental_providerMetadata is extra field not in TextPart type definition
        experimental_providerMetadata: {
          anthropic: { cacheControl: { type: "ephemeral" } },
        },
      } as unknown as import("ai").TextPart,
    ],
  };

  const contextBlock: CoreMessage = {
    role: "user",
    content: `PAPEL: ${persona.role} — ${persona.title}\nFOCO: ${persona.focus}\nESTILO: ${persona.style}\nAUDIÊNCIA: ${persona.audience}\n\n${summarizeContext(context)}`,
  };

  // Insert static + context blocks before the actual conversation
  return [staticBlock, contextBlock, ...userMessages];
}
