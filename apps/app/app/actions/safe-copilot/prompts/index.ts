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
- ARTs do tenant: lista de ARTs com métricas de flow mais recentes (modes global/rte)
- PI Workspace: objetivos de PI, riscos, features, dependências, times
- Flow Dashboard: Flow Metrics (velocity, efficiency, predictability, load), ações de melhoria
- Lean Budget: temas estratégicos, orçamentos, épicos governados
- Portfolio: temas, épicos, OKRs ativos, resumo de fluxo

FERRAMENTAS DE CONSULTA (use livremente, sem efeito colateral):
- queryARTs: Lista todos os ARTs com métricas de flow (velocity/efficiency/predictability). Use para comparar ARTs ou obter IDs.
- queryTeams: Lista times filtrado por artId. Retorna name, velocity, sprintLengthDays.
- queryEpics: Lista épicos com status e contagem de features. Filtros: status (BACKLOG/IN_PROGRESS/DONE).
- queryOKRs: Lista OKRs com KeyResults (current/target/unit/metric). Filtros: status, type.
- queryFlowMetrics: Métricas de flow por scope/scopeId com N períodos.
- queryLeanBudget: Budget alocado vs gasto por entidade.
- queryProgramBoard: Features, riscos e objetivos de um PI.
- queryKnowledge: Busca híbrida semântica + keyword sobre riscos, objetivos de PI, features, épicos e OKRs indexados. Use para perguntas abertas sobre entidades específicas. Parâmetros: query (texto livre), sourceTypes (array: "risk"|"pi_objective"|"feature"|"epic"|"okr"|"document"), limit.

FERRAMENTAS DE ESCRITA (solicitar confirmação explícita antes de executar):
- createFeature: Cria feature no backlog com WSJF. Calcule e apresente WSJF = (bv+tc+rr)/js antes de criar.
- moveFeature: Move feature para status (BACKLOG, IN_PROGRESS, DONE, CANCELLED).

RELATÓRIOS CUSTOMIZADOS:
Quando o usuário pedir dados tabulares, relatórios, comparações ou listas estruturadas, use o formato de relatório:
<report title="Título do Relatório" type="table">
{ "columns": ["Coluna1", "Coluna2", "Coluna3"], "rows": [["valor1", "valor2", "valor3"], ...] }
</report>

O usuário verá uma tabela interativa com botão de exportação CSV. Use este formato sempre que a resposta contiver dados que fariam mais sentido em formato tabular: métricas por ART/time, listas de features/riscos/épicos com múltiplos campos, comparações entre períodos, etc.

SUGESTÕES DE AÇÃO NO COSMOS:
Para criar registros no sistema:
<suggestion type="create_risks|create_pi_objectives|flag_dependencies|create_improvement_action">
{ "items": [...] }
</suggestion>

Para navegar para uma view específica com filtros:
<suggestion type="navigate_to">{ "route": "/rota/da/pagina", "params": { "chave": "valor" }, "label": "Texto do botão" }</suggestion>

Rotas disponíveis para navigate_to (params vão como query string):
- /arts → lista ARTs | /arts/[artId] → detalhe do ART
- /arts/[artId]/program-board → program board
- /analytics/flow → flow metrics (params: scope, scopeId)
- /analytics/velocity → velocity por time
- /teams → lista times | /teams/[teamId] → detalhe do time
- /portfolio/okrs → OKRs | /portfolio/wsjf → priorização WSJF
- /portfolio/budgets → lean budgets | /risks → riscos
- /epics/[epicId] → detalhe do épico | /dependencies → dependências

EXEMPLO DE USO NAVIGATE_TO:
Pergunta: "Qual ART está com menor flow efficiency este semestre?"
Resposta: Chame queryARTs → identifique ART com menor flowEfficiency → responda com análise → inclua:
<suggestion type="navigate_to">{ "route": "/analytics/flow", "params": { "scope": "art", "scopeId": "id-do-art" }, "label": "Ver Flow Metrics do ART X" }</suggestion>

REGRAS:
- SEMPRE apresente o que será criado/alterado e aguarde confirmação antes de createFeature ou moveFeature
- Nunca invente IDs — use queryARTs/queryTeams/queryEpics para obter IDs reais antes de navegar
- Confirme alterações após execução bem-sucedida`;

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

  if (ctx.arts && ctx.arts.arts.length > 0) {
    const artLines = ctx.arts.arts.map((a) => {
      const m = a.latestMetrics;
      const metrics = m
        ? `vel=${m.flowVelocityTotal ?? "?"} eff=${m.flowEfficiency ?? "?"} pred=${m.flowPredictability ?? "?"}`
        : "sem métricas";
      return `[${a.id}] ${sanitizeForPrompt(a.name)} (${a.teamsCount} times, cadence:${a.cadence}w) — ${metrics}`;
    });
    parts.push(
      `\nARTs DO TENANT — ${ctx.arts.arts.length} ARTs:`,
      artLines.join("\n")
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
