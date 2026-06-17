// cosmos-data2.jsx — demo data for batch 2 (Program Board, PI Planning, Flow).

const PI_TEAMS = [
  { id: "t1", name: "Squad Pagamentos", tone: "blue", cap: 42, load: 38 },
  { id: "t2", name: "Squad Núcleo", tone: "purple", cap: 40, load: 44 },
  { id: "t3", name: "Squad Growth", tone: "green", cap: 36, load: 30 },
  { id: "t4", name: "Squad Data & IA", tone: "amber", cap: 34, load: 33 },
];
const SPRINTS = ["Sprint 1", "Sprint 2", "Sprint 3", "Sprint 4", "Sprint 5", "IP"];

// program board features placed by [teamIdx][sprintIdx]
const FEATURES = [
  { id: "FE-318", team: "t1", s: 0, title: "Limites dinâmicos por risco", pts: 8, status: "done" },
  { id: "FE-322", team: "t1", s: 1, title: "Pix agendado · fila", pts: 13, status: "wip", dep: "FE-204" },
  { id: "FE-330", team: "t1", s: 3, title: "Carteira multi-moeda v1", pts: 13, status: "planned" },
  { id: "FE-341", team: "t1", s: 4, title: "Open Finance · consent", pts: 8, status: "planned", milestone: true },

  { id: "FE-204", team: "t2", s: 0, title: "Tenant isolation layer", pts: 13, status: "wip", risk: true },
  { id: "FE-211", team: "t2", s: 1, title: "Migração de schema", pts: 21, status: "planned", dep: "FE-204" },
  { id: "FE-219", team: "t2", s: 2, title: "SSO/SCIM core", pts: 8, status: "planned" },
  { id: "FE-228", team: "t2", s: 4, title: "Cutover multi-tenant", pts: 13, status: "planned", milestone: true },

  { id: "FE-150", team: "t3", s: 0, title: "Checkout 1-clique A/B", pts: 5, status: "done" },
  { id: "FE-158", team: "t3", s: 2, title: "Fidelidade · pontos", pts: 8, status: "wip" },
  { id: "FE-165", team: "t3", s: 3, title: "Onboarding KYC self-serve", pts: 13, status: "planned", dep: "FE-219" },

  { id: "FE-410", team: "t4", s: 1, title: "Antifraude · modelo v2", pts: 13, status: "wip", risk: true },
  { id: "FE-418", team: "t4", s: 2, title: "Feature store realtime", pts: 8, status: "planned", dep: "FE-204" },
  { id: "FE-425", team: "t4", s: 4, title: "Copilot relatórios GA", pts: 8, status: "planned", milestone: true },
];

const MILESTONES = [
  { s: 2, label: "Beta Open Finance", tone: "blue" },
  { s: 4, label: "GA multi-tenant · Copilot", tone: "purple" },
];

const PI_OBJECTIVES = [
  { team: "t2", text: "Concluir isolamento multi-tenant do core e cutover sem downtime", bv: 10, abv: 10, conf: 3, committed: true },
  { team: "t1", text: "Lançar Pix recorrente e carteira multi-moeda v1 em produção", bv: 9, abv: 9, conf: 4, committed: true },
  { team: "t4", text: "Subir antifraude ML v2 com precisão ≥ 94% em tempo real", bv: 8, abv: 8, conf: 3, committed: true },
  { team: "t3", text: "Aumentar conversão de checkout em 6% via 1-clique + KYC self-serve", bv: 7, abv: 7, conf: 4, committed: true },
  { team: "t1", text: "Habilitar consentimento Open Finance (stretch)", bv: 5, abv: 0, conf: 2, committed: false },
  { team: "t4", text: "GA do Copilot de relatórios financeiros", bv: 6, abv: 0, conf: 3, committed: false },
];

const CONFIDENCE_VOTE = [
  { id: "t1", v: 4 }, { id: "t2", v: 3 }, { id: "t3", v: 4 }, { id: "t4", v: 3 },
];

const ROAM_RISKS = [
  { id: "R-12", text: "Dependência do provedor de KYC pode atrasar onboarding", status: "Owned", tone: "amber", owner: "Bruno Dias" },
  { id: "R-08", text: "Janela de cutover multi-tenant conflita com Black Friday", status: "Mitigated", tone: "blue", owner: "Helena Souza" },
  { id: "R-15", text: "Latência do modelo antifraude acima do SLA em picos", status: "Owned", tone: "amber", owner: "Letícia Rocha" },
  { id: "R-04", text: "Orçamento de nuvem do Data ART próximo do guardrail", status: "Accepted", tone: "neutral", owner: "FinOps" },
  { id: "R-19", text: "Risco regulatório Open Finance resolvido com jurídico", status: "Resolved", tone: "green", owner: "Jurídico" },
];

// ---- Flow metrics ----
const FLOW = {
  velocity: [44, 52, 48, 58, 61, 66, 63, 71],
  weeks: ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"],
  // cumulative flow: each week, counts per state (stacked bottom→top)
  cfd: [
    { done: 18, impl: 10, anal: 8, backlog: 22 },
    { done: 26, impl: 12, anal: 9, backlog: 20 },
    { done: 35, impl: 11, anal: 10, backlog: 19 },
    { done: 47, impl: 13, anal: 9, backlog: 21 },
    { done: 58, impl: 14, anal: 11, backlog: 18 },
    { done: 72, impl: 12, anal: 10, backlog: 17 },
    { done: 85, impl: 13, anal: 9, backlog: 16 },
    { done: 101, impl: 14, anal: 8, backlog: 15 },
  ],
  distribution: [
    { label: "Features", v: 54, tone: "blue" },
    { label: "Defeitos", v: 19, tone: "red" },
    { label: "Dívida téc.", v: 16, tone: "amber" },
    { label: "Riscos", v: 11, tone: "purple" },
  ],
  aging: [
    { label: "Tenant isolation", days: 18, sla: 14, tone: "red" },
    { label: "Antifraude v2", days: 12, sla: 14, tone: "amber" },
    { label: "Pix agendado", days: 9, sla: 14, tone: "green" },
    { label: "Fidelidade pontos", days: 7, sla: 14, tone: "green" },
    { label: "Feature store", days: 15, sla: 14, tone: "red" },
  ],
};

Object.assign(window, { PI_TEAMS, SPRINTS, FEATURES, MILESTONES, PI_OBJECTIVES, CONFIDENCE_VOTE, ROAM_RISKS, FLOW });
