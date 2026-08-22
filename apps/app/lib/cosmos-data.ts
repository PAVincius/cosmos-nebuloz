// cosmos-data.ts — SAFe demo data ported from cosmos-data.jsx (values exact).
// Subset needed by the ported screens; grows as more screens land.

export type Tone =
  | "green"
  | "red"
  | "amber"
  | "blue"
  | "purple"
  | "accent"
  | "neutral";

type Art = { name: string; tone: Tone };
const ARTS: Record<string, Art> = {
  pay: { name: "Payments ART", tone: "accent" },
  plat: { name: "Platform ART", tone: "accent" },
  growth: { name: "Growth ART", tone: "accent" },
  data: { name: "Data & AI ART", tone: "accent" },
};

type KanbanColumnDef = {
  id: string;
  label: string;
  tone: Tone;
  hex: string;
};
const KANBAN_COLUMNS: KanbanColumnDef[] = [
  { id: "funnel", label: "Funnel", tone: "neutral", hex: "100,116,139" },
  { id: "reviewing", label: "Reviewing", tone: "accent", hex: "94,106,210" },
  { id: "analyzing", label: "Analyzing", tone: "accent", hex: "94,106,210" },
  {
    id: "backlog",
    label: "Portfolio Backlog",
    tone: "accent",
    hex: "94,106,210",
  },
  {
    id: "implementing",
    label: "Implementing",
    tone: "accent",
    hex: "94,106,210",
  },
  { id: "done", label: "Done", tone: "green", hex: "22,163,74" },
];

type Epic = {
  id: string;
  col: string;
  title: string;
  theme: string;
  art: string;
  owner: string;
  wsjf: number;
  size: number;
  progress: number;
  hot?: boolean;
};
const EPICS: Epic[] = [
  {
    id: "EP-104",
    col: "funnel",
    title: "Carteira digital multi-moeda",
    theme: "Expansão LATAM",
    art: "pay",
    owner: "Marina Alves",
    wsjf: 11.2,
    size: 34,
    progress: 0,
  },
  {
    id: "EP-118",
    col: "funnel",
    title: "Programa de fidelidade B2B",
    theme: "Data & AI",
    art: "growth",
    owner: "Caio Nunes",
    wsjf: 8.4,
    size: 21,
    progress: 0,
  },
  {
    id: "EP-097",
    col: "reviewing",
    title: "Antifraude em tempo real (ML)",
    theme: "Confiança & Risco",
    art: "data",
    owner: "Letícia Rocha",
    wsjf: 19.6,
    size: 55,
    progress: 6,
    hot: true,
  },
  {
    id: "EP-112",
    col: "reviewing",
    title: "Onboarding self-service KYC",
    theme: "Expansão LATAM",
    art: "pay",
    owner: "Bruno Dias",
    wsjf: 14.1,
    size: 40,
    progress: 10,
  },
  {
    id: "EP-088",
    col: "analyzing",
    title: "Plataforma de eventos unificada",
    theme: "Modernização da Plataforma",
    art: "plat",
    owner: "Helena Souza",
    wsjf: 16.8,
    size: 68,
    progress: 22,
  },
  {
    id: "EP-101",
    col: "analyzing",
    title: "Checkout 1-clique",
    theme: "Eficiência de Custo",
    art: "growth",
    owner: "Diego Lima",
    wsjf: 13.3,
    size: 29,
    progress: 18,
  },
  {
    id: "EP-076",
    col: "backlog",
    title: "Migração core para multi-tenant",
    theme: "Modernização da Plataforma",
    art: "plat",
    owner: "Helena Souza",
    wsjf: 22.4,
    size: 89,
    progress: 0,
    hot: true,
  },
  {
    id: "EP-093",
    col: "backlog",
    title: "Observabilidade ponta-a-ponta",
    theme: "Modernização da Plataforma",
    art: "plat",
    owner: "Rafael Teixeira",
    wsjf: 12.0,
    size: 47,
    progress: 0,
  },
  {
    id: "EP-109",
    col: "backlog",
    title: "Open Finance · agregação",
    theme: "Expansão LATAM",
    art: "pay",
    owner: "Marina Alves",
    wsjf: 15.5,
    size: 52,
    progress: 0,
  },
  {
    id: "EP-061",
    col: "implementing",
    title: "SSO & SCIM Enterprise",
    theme: "Enterprise Ready",
    art: "plat",
    owner: "Rafael Teixeira",
    wsjf: 18.2,
    size: 34,
    progress: 64,
  },
  {
    id: "EP-070",
    col: "implementing",
    title: "Pix recorrente & agendado",
    theme: "Confiança & Risco",
    art: "pay",
    owner: "Bruno Dias",
    wsjf: 20.1,
    size: 42,
    progress: 48,
    hot: true,
  },
  {
    id: "EP-085",
    col: "implementing",
    title: "Copilot de relatórios financeiros",
    theme: "Data & AI",
    art: "data",
    owner: "Letícia Rocha",
    wsjf: 17.0,
    size: 38,
    progress: 31,
  },
  {
    id: "EP-042",
    col: "done",
    title: "FinOps guardrails por ART",
    theme: "Eficiência de Custo",
    art: "data",
    owner: "Letícia Rocha",
    wsjf: 9.8,
    size: 26,
    progress: 100,
  },
  {
    id: "EP-055",
    col: "done",
    title: "Migração para Design System v3",
    theme: "Modernização da Plataforma",
    art: "plat",
    owner: "Helena Souza",
    wsjf: 7.5,
    size: 31,
    progress: 100,
  },
];

type WsjfItem = {
  rank: number;
  id: string;
  name: string;
  type: "Epic" | "Feature";
  art: string;
  bv: number;
  tc: number;
  rr: number;
  size: number;
  wsjf: number;
  prev: number;
  ai: string;
};
const WSJF_ITEMS: WsjfItem[] = [
  {
    rank: 1,
    id: "EP-076",
    name: "Migração core para multi-tenant",
    type: "Epic",
    art: "plat",
    bv: 21,
    tc: 18,
    rr: 13,
    size: 22,
    wsjf: 22.4,
    prev: 3,
    ai: "+2",
  },
  {
    rank: 2,
    id: "EP-070",
    name: "Pix recorrente & agendado",
    type: "Epic",
    art: "pay",
    bv: 20,
    tc: 16,
    rr: 8,
    size: 13,
    wsjf: 20.1,
    prev: 1,
    ai: "−1",
  },
  {
    rank: 3,
    id: "EP-097",
    name: "Antifraude em tempo real (ML)",
    type: "Epic",
    art: "data",
    bv: 18,
    tc: 20,
    rr: 13,
    size: 21,
    wsjf: 19.6,
    prev: 2,
    ai: "−1",
  },
  {
    rank: 4,
    id: "EP-061",
    name: "SSO & SCIM Enterprise",
    type: "Epic",
    art: "plat",
    bv: 13,
    tc: 8,
    rr: 13,
    size: 8,
    wsjf: 18.2,
    prev: 6,
    ai: "+2",
  },
  {
    rank: 5,
    id: "FE-318",
    name: "Limites dinâmicos por risco",
    type: "Feature",
    art: "pay",
    bv: 13,
    tc: 13,
    rr: 8,
    size: 5,
    wsjf: 17.6,
    prev: 5,
    ai: "0",
  },
  {
    rank: 6,
    id: "EP-085",
    name: "Copilot de relatórios financeiros",
    type: "Epic",
    art: "data",
    bv: 16,
    tc: 8,
    rr: 8,
    size: 8,
    wsjf: 17.0,
    prev: 4,
    ai: "−2",
  },
  {
    rank: 7,
    id: "EP-088",
    name: "Plataforma de eventos unificada",
    type: "Epic",
    art: "plat",
    bv: 13,
    tc: 13,
    rr: 13,
    size: 13,
    wsjf: 16.8,
    prev: 7,
    ai: "0",
  },
  {
    rank: 8,
    id: "EP-109",
    name: "Open Finance · agregação",
    type: "Epic",
    art: "pay",
    bv: 13,
    tc: 8,
    rr: 8,
    size: 8,
    wsjf: 15.5,
    prev: 9,
    ai: "+1",
  },
  {
    rank: 9,
    id: "FE-274",
    name: "Reconciliação automática",
    type: "Feature",
    art: "pay",
    bv: 8,
    tc: 13,
    rr: 5,
    size: 5,
    wsjf: 15.0,
    prev: 8,
    ai: "−1",
  },
  {
    rank: 10,
    id: "EP-112",
    name: "Onboarding self-service KYC",
    type: "Epic",
    art: "pay",
    bv: 13,
    tc: 8,
    rr: 5,
    size: 8,
    wsjf: 14.1,
    prev: 11,
    ai: "+1",
  },
  {
    rank: 11,
    id: "EP-101",
    name: "Checkout 1-clique",
    type: "Epic",
    art: "growth",
    bv: 13,
    tc: 5,
    rr: 5,
    size: 5,
    wsjf: 13.3,
    prev: 10,
    ai: "−1",
  },
  {
    rank: 12,
    id: "EP-093",
    name: "Observabilidade ponta-a-ponta",
    type: "Epic",
    art: "plat",
    bv: 8,
    tc: 8,
    rr: 8,
    size: 8,
    wsjf: 12.0,
    prev: 12,
    ai: "0",
  },
];

// ── Program Board / PI Planning / Flow (batch 2) ──
type PiTeam = {
  id: string;
  name: string;
  tone: Tone;
  cap: number;
  load: number;
};
const PI_TEAMS: PiTeam[] = [
  { id: "t1", name: "Squad Pagamentos", tone: "blue", cap: 42, load: 38 },
  { id: "t2", name: "Squad Núcleo", tone: "purple", cap: 40, load: 44 },
  { id: "t3", name: "Squad Growth", tone: "green", cap: 36, load: 30 },
  { id: "t4", name: "Squad Data & IA", tone: "amber", cap: 34, load: 33 },
];
const SPRINTS = [
  "Sprint 1",
  "Sprint 2",
  "Sprint 3",
  "Sprint 4",
  "Sprint 5",
  "IP",
];

type FeatureStatus = "done" | "wip" | "planned";
type Feature = {
  id: string;
  team: string;
  s: number;
  title: string;
  pts: number;
  status: FeatureStatus;
  dep?: string;
  risk?: boolean;
  milestone?: boolean;
};
const FEATURES: Feature[] = [
  {
    id: "FE-318",
    team: "t1",
    s: 0,
    title: "Limites dinâmicos por risco",
    pts: 8,
    status: "done",
  },
  {
    id: "FE-322",
    team: "t1",
    s: 1,
    title: "Pix agendado · fila",
    pts: 13,
    status: "wip",
    dep: "FE-204",
  },
  {
    id: "FE-330",
    team: "t1",
    s: 3,
    title: "Carteira multi-moeda v1",
    pts: 13,
    status: "planned",
  },
  {
    id: "FE-341",
    team: "t1",
    s: 4,
    title: "Open Finance · consent",
    pts: 8,
    status: "planned",
    milestone: true,
  },
  {
    id: "FE-204",
    team: "t2",
    s: 0,
    title: "Tenant isolation layer",
    pts: 13,
    status: "wip",
    risk: true,
  },
  {
    id: "FE-211",
    team: "t2",
    s: 1,
    title: "Migração de schema",
    pts: 21,
    status: "planned",
    dep: "FE-204",
  },
  {
    id: "FE-219",
    team: "t2",
    s: 2,
    title: "SSO/SCIM core",
    pts: 8,
    status: "planned",
  },
  {
    id: "FE-228",
    team: "t2",
    s: 4,
    title: "Cutover multi-tenant",
    pts: 13,
    status: "planned",
    milestone: true,
  },
  {
    id: "FE-150",
    team: "t3",
    s: 0,
    title: "Checkout 1-clique A/B",
    pts: 5,
    status: "done",
  },
  {
    id: "FE-158",
    team: "t3",
    s: 2,
    title: "Fidelidade · pontos",
    pts: 8,
    status: "wip",
  },
  {
    id: "FE-165",
    team: "t3",
    s: 3,
    title: "Onboarding KYC self-serve",
    pts: 13,
    status: "planned",
    dep: "FE-219",
  },
  {
    id: "FE-410",
    team: "t4",
    s: 1,
    title: "Antifraude · modelo v2",
    pts: 13,
    status: "wip",
    risk: true,
  },
  {
    id: "FE-418",
    team: "t4",
    s: 2,
    title: "Feature store realtime",
    pts: 8,
    status: "planned",
    dep: "FE-204",
  },
  {
    id: "FE-425",
    team: "t4",
    s: 4,
    title: "Copilot relatórios GA",
    pts: 8,
    status: "planned",
    milestone: true,
  },
];

type Milestone = { s: number; label: string; tone: Tone };
const MILESTONES: Milestone[] = [
  { s: 2, label: "Beta Open Finance", tone: "blue" },
  { s: 4, label: "GA multi-tenant · Copilot", tone: "purple" },
];

type PiObjective = {
  team: string;
  text: string;
  bv: number;
  abv: number;
  conf: number;
  committed: boolean;
};
const PI_OBJECTIVES: PiObjective[] = [
  {
    team: "t2",
    text: "Concluir isolamento multi-tenant do core e cutover sem downtime",
    bv: 10,
    abv: 10,
    conf: 3,
    committed: true,
  },
  {
    team: "t1",
    text: "Lançar Pix recorrente e carteira multi-moeda v1 em produção",
    bv: 9,
    abv: 9,
    conf: 4,
    committed: true,
  },
  {
    team: "t4",
    text: "Subir antifraude ML v2 com precisão ≥ 94% em tempo real",
    bv: 8,
    abv: 8,
    conf: 3,
    committed: true,
  },
  {
    team: "t3",
    text: "Aumentar conversão de checkout em 6% via 1-clique + KYC self-serve",
    bv: 7,
    abv: 7,
    conf: 4,
    committed: true,
  },
  {
    team: "t1",
    text: "Habilitar consentimento Open Finance (stretch)",
    bv: 5,
    abv: 0,
    conf: 2,
    committed: false,
  },
  {
    team: "t4",
    text: "GA do Copilot de relatórios financeiros",
    bv: 6,
    abv: 0,
    conf: 3,
    committed: false,
  },
];

type ConfidenceVote = { id: string; v: number };
const CONFIDENCE_VOTE: ConfidenceVote[] = [
  { id: "t1", v: 4 },
  { id: "t2", v: 3 },
  { id: "t3", v: 4 },
  { id: "t4", v: 3 },
];

type RoamRisk = {
  id: string;
  text: string;
  status: string;
  tone: Tone;
  owner: string;
};
const ROAM_RISKS: RoamRisk[] = [
  {
    id: "R-12",
    text: "Dependência do provedor de KYC pode atrasar onboarding",
    status: "Owned",
    tone: "amber",
    owner: "Bruno Dias",
  },
  {
    id: "R-08",
    text: "Janela de cutover multi-tenant conflita com Black Friday",
    status: "Mitigated",
    tone: "blue",
    owner: "Helena Souza",
  },
  {
    id: "R-15",
    text: "Latência do modelo antifraude acima do SLA em picos",
    status: "Owned",
    tone: "amber",
    owner: "Letícia Rocha",
  },
  {
    id: "R-04",
    text: "Orçamento de nuvem do Data ART próximo do guardrail",
    status: "Accepted",
    tone: "neutral",
    owner: "FinOps",
  },
  {
    id: "R-19",
    text: "Risco regulatório Open Finance resolvido com jurídico",
    status: "Resolved",
    tone: "green",
    owner: "Jurídico",
  },
];

type FlowData = {
  velocity: number[];
  weeks: string[];
  cfd: { done: number; impl: number; anal: number; backlog: number }[];
  distribution: { label: string; v: number; tone: Tone }[];
  aging: { label: string; days: number; sla: number; tone: Tone }[];
};
const FLOW: FlowData = {
  velocity: [44, 52, 48, 58, 61, 66, 63, 71],
  weeks: ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"],
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

// ── OKRs / Risks / Teams (batch 3) ──
type Okr = {
  id: string;
  tone: Tone;
  owner: string;
  scope: string;
  objective: string;
  krs: { text: string; v: number; now: string; goal: string }[];
};
const OKRS: Okr[] = [
  {
    id: "O1",
    tone: "blue",
    owner: "Marina Alves",
    scope: "Portfolio",
    objective:
      "Tornar a COSMOS a plataforma de pagamentos #1 da América Latina",
    krs: [
      {
        text: "Processar US$ 4,2 bi em TPV anual",
        v: 68,
        now: "2,9 bi",
        goal: "4,2 bi",
      },
      {
        text: "Lançar em 3 novos países (MX, CO, AR)",
        v: 33,
        now: "1",
        goal: "3",
      },
      { text: "NPS de pagamentos ≥ 62", v: 89, now: "58", goal: "62" },
    ],
  },
  {
    id: "O2",
    tone: "purple",
    owner: "Helena Souza",
    scope: "Platform ART",
    objective:
      "Modernizar a plataforma para escala e confiabilidade de classe mundial",
    krs: [
      {
        text: "Migrar 100% do core para multi-tenant",
        v: 38,
        now: "38%",
        goal: "100%",
      },
      {
        text: "Uptime de 99,98% nos serviços críticos",
        v: 95,
        now: "99,94%",
        goal: "99,98%",
      },
      {
        text: "Reduzir lead time de deploy para < 1h",
        v: 72,
        now: "2,1h",
        goal: "1h",
      },
    ],
  },
  {
    id: "O3",
    tone: "amber",
    owner: "Letícia Rocha",
    scope: "Data & AI ART",
    objective: "Operacionalizar IA confiável em produtos financeiros",
    krs: [
      {
        text: "Antifraude com precisão ≥ 94% em tempo real",
        v: 81,
        now: "91%",
        goal: "94%",
      },
      {
        text: "Copilot adotado por 40% dos clientes ativos",
        v: 45,
        now: "18%",
        goal: "40%",
      },
      {
        text: "Feature store servindo < 50ms p99",
        v: 60,
        now: "78ms",
        goal: "50ms",
      },
    ],
  },
  {
    id: "O4",
    tone: "green",
    owner: "Caio Nunes",
    scope: "Growth ART",
    objective: "Acelerar crescimento eficiente e retenção de receita",
    krs: [
      {
        text: "Aumentar conversão de checkout em 6 pts",
        v: 50,
        now: "+3pts",
        goal: "+6pts",
      },
      {
        text: "Net revenue retention ≥ 118%",
        v: 78,
        now: "112%",
        goal: "118%",
      },
      { text: "CAC payback < 9 meses", v: 64, now: "11m", goal: "9m" },
    ],
  },
];

type Risk = {
  id: string;
  text: string;
  roam: string;
  tone: Tone;
  owner: string;
  prob: number;
  impact: number;
  art: string;
};
const RISKS: Risk[] = [
  {
    id: "R-12",
    text: "Provedor de KYC pode atrasar onboarding self-service",
    roam: "Owned",
    tone: "amber",
    owner: "Bruno Dias",
    prob: 3,
    impact: 3,
    art: "pay",
  },
  {
    id: "R-15",
    text: "Latência do modelo antifraude acima do SLA em picos",
    roam: "Owned",
    tone: "amber",
    owner: "Letícia Rocha",
    prob: 3,
    impact: 4,
    art: "data",
  },
  {
    id: "R-08",
    text: "Janela de cutover multi-tenant conflita com Black Friday",
    roam: "Mitigated",
    tone: "blue",
    owner: "Helena Souza",
    prob: 2,
    impact: 5,
    art: "plat",
  },
  {
    id: "R-22",
    text: "Capacidade do Squad Núcleo acima de 100% no PI",
    roam: "Owned",
    tone: "red",
    owner: "Helena Souza",
    prob: 4,
    impact: 4,
    art: "plat",
  },
  {
    id: "R-04",
    text: "Orçamento de nuvem do Data ART próximo do guardrail",
    roam: "Accepted",
    tone: "neutral",
    owner: "FinOps",
    prob: 3,
    impact: 2,
    art: "data",
  },
  {
    id: "R-19",
    text: "Risco regulatório Open Finance",
    roam: "Resolved",
    tone: "green",
    owner: "Jurídico",
    prob: 1,
    impact: 4,
    art: "pay",
  },
  {
    id: "R-27",
    text: "Dependência cruzada entre 4 features no isolation layer",
    roam: "Owned",
    tone: "red",
    owner: "Rafael Teixeira",
    prob: 4,
    impact: 5,
    art: "plat",
  },
];
const ROAM_TONE: Record<string, Tone> = {
  Resolved: "green",
  Owned: "amber",
  Accepted: "neutral",
  Mitigated: "blue",
};

type TeamDir = {
  id: string;
  name: string;
  art: string;
  tone: Tone;
  lead: string;
  members: number;
  cap: number;
  load: number;
  vel: number;
  pred: number;
  focus: string;
};
const TEAMS_DIR: TeamDir[] = [
  {
    id: "t1",
    name: "Squad Pagamentos",
    art: "pay",
    tone: "blue",
    lead: "Bruno Dias",
    members: 8,
    cap: 42,
    load: 38,
    vel: 39,
    pred: 92,
    focus: "Pix, carteira & transferências",
  },
  {
    id: "t2",
    name: "Squad Núcleo",
    art: "plat",
    tone: "purple",
    lead: "Helena Souza",
    members: 9,
    cap: 40,
    load: 44,
    vel: 41,
    pred: 84,
    focus: "Core multi-tenant & infraestrutura",
  },
  {
    id: "t3",
    name: "Squad Growth",
    art: "growth",
    tone: "green",
    lead: "Caio Nunes",
    members: 6,
    cap: 36,
    load: 30,
    vel: 32,
    pred: 96,
    focus: "Checkout, onboarding & fidelidade",
  },
  {
    id: "t4",
    name: "Squad Data & IA",
    art: "data",
    tone: "amber",
    lead: "Letícia Rocha",
    members: 7,
    cap: 34,
    load: 33,
    vel: 33,
    pred: 88,
    focus: "Antifraude, copilot & feature store",
  },
  {
    id: "t5",
    name: "Squad Plataforma DevX",
    art: "plat",
    tone: "purple",
    lead: "Rafael Teixeira",
    members: 5,
    cap: 30,
    load: 26,
    vel: 28,
    pred: 90,
    focus: "Observabilidade & developer experience",
  },
  {
    id: "t6",
    name: "Squad Confiança",
    art: "data",
    tone: "red",
    lead: "Letícia Rocha",
    members: 4,
    cap: 24,
    load: 22,
    vel: 23,
    pred: 86,
    focus: "Segurança, compliance & risco",
  },
];
