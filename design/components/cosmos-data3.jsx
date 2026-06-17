// cosmos-data3.jsx — demo data for batch 3 screens
// (Temas, OKRs, Lean Budgets, Roadmap, Anomalias, Dependências, Riscos, Times, Velocity, Measure & Grow).

// ---- Temas Estratégicos ----
const THEMES = [
  { id: "TH-1", name: "Modernização da Plataforma", tone: "purple", desc: "Migrar o core para multi-tenant e eventos unificados, reduzindo dívida técnica.", alloc: 32, target: 30, epics: 4, progress: 38, health: "on", horizon: "PI-25 → PI-27" },
  { id: "TH-2", name: "Expansão LATAM", tone: "blue", desc: "Carteira multi-moeda, Open Finance e onboarding KYC para novos mercados.", alloc: 24, target: 25, epics: 3, progress: 22, health: "on", horizon: "PI-26 → PI-28" },
  { id: "TH-3", name: "Confiança & Risco", tone: "red", desc: "Antifraude em tempo real e guardrails de segurança end-to-end.", alloc: 17, target: 15, epics: 2, progress: 14, health: "watch", horizon: "PI-26 → PI-27" },
  { id: "TH-4", name: "Data & AI", tone: "amber", desc: "Copilot financeiro, feature store realtime e analytics self-service.", alloc: 14, target: 18, epics: 2, progress: 31, health: "behind", horizon: "PI-26 → PI-28" },
  { id: "TH-5", name: "Eficiência de Custo", tone: "green", desc: "FinOps guardrails por ART e otimização contínua de nuvem.", alloc: 8, target: 7, epics: 2, progress: 100, health: "on", horizon: "PI-25" },
  { id: "TH-6", name: "Enterprise Ready", tone: "accent", desc: "SSO/SCIM, auditoria e conformidade para contas enterprise.", alloc: 5, target: 5, epics: 1, progress: 64, health: "on", horizon: "PI-26" },
];

// ---- OKRs ----
const OKRS = [
  {
    id: "O1", tone: "blue", owner: "Marina Alves", scope: "Portfolio",
    objective: "Tornar a COSMOS a plataforma de pagamentos #1 da América Latina",
    krs: [
      { text: "Processar US$ 4,2 bi em TPV anual", v: 68, now: "2,9 bi", goal: "4,2 bi" },
      { text: "Lançar em 3 novos países (MX, CO, AR)", v: 33, now: "1", goal: "3" },
      { text: "NPS de pagamentos ≥ 62", v: 89, now: "58", goal: "62" },
    ],
  },
  {
    id: "O2", tone: "purple", owner: "Helena Souza", scope: "Platform ART",
    objective: "Modernizar a plataforma para escala e confiabilidade de classe mundial",
    krs: [
      { text: "Migrar 100% do core para multi-tenant", v: 38, now: "38%", goal: "100%" },
      { text: "Uptime de 99,98% nos serviços críticos", v: 95, now: "99,94%", goal: "99,98%" },
      { text: "Reduzir lead time de deploy para < 1h", v: 72, now: "2,1h", goal: "1h" },
    ],
  },
  {
    id: "O3", tone: "amber", owner: "Letícia Rocha", scope: "Data & AI ART",
    objective: "Operacionalizar IA confiável em produtos financeiros",
    krs: [
      { text: "Antifraude com precisão ≥ 94% em tempo real", v: 81, now: "91%", goal: "94%" },
      { text: "Copilot adotado por 40% dos clientes ativos", v: 45, now: "18%", goal: "40%" },
      { text: "Feature store servindo < 50ms p99", v: 60, now: "78ms", goal: "50ms" },
    ],
  },
  {
    id: "O4", tone: "green", owner: "Caio Nunes", scope: "Growth ART",
    objective: "Acelerar crescimento eficiente e retenção de receita",
    krs: [
      { text: "Aumentar conversão de checkout em 6 pts", v: 50, now: "+3pts", goal: "+6pts" },
      { text: "Net revenue retention ≥ 118%", v: 78, now: "112%", goal: "118%" },
      { text: "CAC payback < 9 meses", v: 64, now: "11m", goal: "9m" },
    ],
  },
];

// ---- Lean Budgets / value streams ----
const VALUE_STREAMS = [
  { id: "VS-1", name: "Pagamentos & Transferências", tone: "blue", budget: 4.8, spent: 3.1, guardrail: 80, mtd: 612, epics: 3, trend: "+4%" },
  { id: "VS-2", name: "Plataforma & Infra", tone: "purple", budget: 5.6, spent: 4.4, guardrail: 82, mtd: 940, epics: 4, trend: "+9%" },
  { id: "VS-3", name: "Data & Inteligência", tone: "amber", budget: 3.2, spent: 2.9, guardrail: 78, mtd: 588, epics: 2, trend: "+12%" },
  { id: "VS-4", name: "Growth & Experiência", tone: "green", budget: 2.4, spent: 1.3, guardrail: 75, mtd: 214, epics: 2, trend: "−2%" },
  { id: "VS-5", name: "Confiança & Compliance", tone: "red", budget: 1.9, spent: 1.6, guardrail: 85, mtd: 332, epics: 1, trend: "+6%" },
];
const BUDGET_GUARDRAILS = [
  { label: "Horizon 1 · manter & evoluir", pct: 58, tone: "blue" },
  { label: "Horizon 2 · emergente", pct: 29, tone: "purple" },
  { label: "Horizon 3 · exploratório", pct: 13, tone: "amber" },
];

// ---- Roadmap (epics across PIs) ----
const ROADMAP_PIS = ["PI-25", "PI-26", "PI-27", "PI-28"];
const ROADMAP_LANES = [
  {
    art: "Payments ART", tone: "blue", items: [
      { id: "EP-070", title: "Pix recorrente & agendado", start: 1, span: 1, status: "wip", progress: 48 },
      { id: "EP-104", title: "Carteira digital multi-moeda", start: 1, span: 2, status: "planned", progress: 0 },
      { id: "EP-109", title: "Open Finance · agregação", start: 2, span: 2, status: "planned", progress: 0, milestone: true },
    ],
  },
  {
    art: "Platform ART", tone: "purple", items: [
      { id: "EP-076", title: "Migração core multi-tenant", start: 0, span: 3, status: "wip", progress: 38, milestone: true },
      { id: "EP-061", title: "SSO & SCIM Enterprise", start: 1, span: 1, status: "wip", progress: 64 },
      { id: "EP-093", title: "Observabilidade E2E", start: 2, span: 1, status: "planned", progress: 0 },
    ],
  },
  {
    art: "Data & AI ART", tone: "amber", items: [
      { id: "EP-097", title: "Antifraude tempo real (ML)", start: 1, span: 2, status: "wip", progress: 14 },
      { id: "EP-085", title: "Copilot de relatórios", start: 1, span: 1, status: "wip", progress: 31 },
      { id: "EP-130", title: "Analytics self-service", start: 3, span: 1, status: "planned", progress: 0 },
    ],
  },
  {
    art: "Growth ART", tone: "green", items: [
      { id: "EP-101", title: "Checkout 1-clique", start: 0, span: 1, status: "done", progress: 100 },
      { id: "EP-112", title: "Onboarding KYC self-serve", start: 1, span: 1, status: "wip", progress: 10 },
      { id: "EP-118", title: "Fidelidade B2B", start: 2, span: 2, status: "planned", progress: 0 },
    ],
  },
];

// ---- Anomalias (FinOps) ----
const ANOMALIES = [
  { id: "AN-301", service: "AWS · Kinesis (Antifraude)", art: "data", sev: "high", spike: 142, cost: 18.4, baseline: 7.6, status: "open", when: "há 2h", cause: "Throughput de shards 3× acima do previsto após deploy do modelo v2." },
  { id: "AN-298", service: "GCP · BigQuery (Analytics)", art: "data", sev: "high", spike: 88, cost: 12.1, baseline: 6.4, status: "investigating", when: "há 6h", cause: "Query full-scan sem partição em dashboard novo." },
  { id: "AN-294", service: "AWS · RDS (Core)", art: "plat", sev: "med", spike: 41, cost: 9.8, baseline: 6.9, status: "open", when: "há 1d", cause: "Réplica extra provisionada para teste de cutover não desligada." },
  { id: "AN-289", service: "Cloudflare · Egress", art: "pay", sev: "med", spike: 33, cost: 4.2, baseline: 3.2, status: "ack", when: "há 1d", cause: "Pico de tráfego de carteira em campanha de marketing." },
  { id: "AN-281", service: "AWS · Lambda (Pix)", art: "pay", sev: "low", spike: 19, cost: 2.1, baseline: 1.8, status: "resolved", when: "há 3d", cause: "Cold starts em horário de pico — corrigido com provisioned concurrency." },
];

// ---- Dependências ----
const DEPENDENCIES = [
  { id: "D-41", from: "FE-322", fromTeam: "t1", to: "FE-204", toTeam: "t2", title: "Pix agendado depende do tenant isolation layer", need: "Sprint 1", status: "risk", desc: "Fila de agendamento precisa do isolamento por tenant antes do GA." },
  { id: "D-37", from: "FE-211", fromTeam: "t2", to: "FE-204", toTeam: "t2", title: "Migração de schema após isolation layer", need: "Sprint 2", status: "committed", desc: "Schema multi-tenant bloqueado até a camada de isolamento estar estável." },
  { id: "D-52", from: "FE-165", fromTeam: "t3", to: "FE-219", toTeam: "t2", title: "Onboarding KYC depende de SSO/SCIM core", need: "Sprint 3", status: "committed", desc: "Self-serve KYC reusa identidade do SSO core." },
  { id: "D-49", from: "FE-418", fromTeam: "t4", to: "FE-204", toTeam: "t2", title: "Feature store realtime depende do isolation layer", need: "Sprint 2", status: "risk", desc: "Streams por tenant exigem isolamento concluído." },
  { id: "D-58", from: "FE-341", fromTeam: "t1", to: "FE-410", toTeam: "t4", title: "Open Finance consent usa scoring antifraude", need: "Sprint 4", status: "planned", desc: "Consentimento avalia risco via modelo antifraude v2." },
  { id: "D-33", from: "FE-228", fromTeam: "t2", to: "FE-425", toTeam: "t4", title: "Cutover multi-tenant alinhado ao GA do Copilot", need: "Sprint 4", status: "committed", desc: "Janela de cutover coordenada com release do Copilot." },
];

// ---- Riscos (registro completo, matriz prob × impacto) ----
const RISKS = [
  { id: "R-12", text: "Provedor de KYC pode atrasar onboarding self-service", roam: "Owned", tone: "amber", owner: "Bruno Dias", prob: 3, impact: 3, art: "pay" },
  { id: "R-15", text: "Latência do modelo antifraude acima do SLA em picos", roam: "Owned", tone: "amber", owner: "Letícia Rocha", prob: 3, impact: 4, art: "data" },
  { id: "R-08", text: "Janela de cutover multi-tenant conflita com Black Friday", roam: "Mitigated", tone: "blue", owner: "Helena Souza", prob: 2, impact: 5, art: "plat" },
  { id: "R-22", text: "Capacidade do Squad Núcleo acima de 100% no PI", roam: "Owned", tone: "red", owner: "Helena Souza", prob: 4, impact: 4, art: "plat" },
  { id: "R-04", text: "Orçamento de nuvem do Data ART próximo do guardrail", roam: "Accepted", tone: "neutral", owner: "FinOps", prob: 3, impact: 2, art: "data" },
  { id: "R-19", text: "Risco regulatório Open Finance", roam: "Resolved", tone: "green", owner: "Jurídico", prob: 1, impact: 4, art: "pay" },
  { id: "R-27", text: "Dependência cruzada entre 4 features no isolation layer", roam: "Owned", tone: "red", owner: "Rafael Teixeira", prob: 4, impact: 5, art: "plat" },
];
const ROAM_TONE = { Resolved: "green", Owned: "amber", Accepted: "neutral", Mitigated: "blue" };

// ---- Times ----
const TEAMS_DIR = [
  { id: "t1", name: "Squad Pagamentos", art: "pay", tone: "blue", lead: "Bruno Dias", members: 8, cap: 42, load: 38, vel: 39, pred: 92, focus: "Pix, carteira & transferências" },
  { id: "t2", name: "Squad Núcleo", art: "plat", tone: "purple", lead: "Helena Souza", members: 9, cap: 40, load: 44, vel: 41, pred: 84, focus: "Core multi-tenant & infraestrutura" },
  { id: "t3", name: "Squad Growth", art: "growth", tone: "green", lead: "Caio Nunes", members: 6, cap: 36, load: 30, vel: 32, pred: 96, focus: "Checkout, onboarding & fidelidade" },
  { id: "t4", name: "Squad Data & IA", art: "data", tone: "amber", lead: "Letícia Rocha", members: 7, cap: 34, load: 33, vel: 33, pred: 88, focus: "Antifraude, copilot & feature store" },
  { id: "t5", name: "Squad Plataforma DevX", art: "plat", tone: "purple", lead: "Rafael Teixeira", members: 5, cap: 30, load: 26, vel: 28, pred: 90, focus: "Observabilidade & developer experience" },
  { id: "t6", name: "Squad Confiança", art: "data", tone: "red", lead: "Letícia Rocha", members: 4, cap: 24, load: 22, vel: 23, pred: 86, focus: "Segurança, compliance & risco" },
];

// ---- Velocity ----
const VELOCITY = {
  sprints: ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"],
  committed: [148, 152, 150, 158, 160, 162, 165, 168],
  delivered: [134, 141, 148, 150, 156, 162, 159, 168],
};

// ---- Measure & Grow (SAFe core competencies) ----
const COMPETENCIES = [
  { name: "Lean-Agile Leadership", score: 3.8, prev: 3.4, tone: "accent" },
  { name: "Team & Technical Agility", score: 3.5, prev: 3.1, tone: "blue" },
  { name: "Agile Product Delivery", score: 4.1, prev: 3.8, tone: "green" },
  { name: "Enterprise Solution Delivery", score: 2.9, prev: 2.6, tone: "amber" },
  { name: "Lean Portfolio Management", score: 3.6, prev: 3.0, tone: "purple" },
  { name: "Organizational Agility", score: 3.2, prev: 3.1, tone: "red" },
  { name: "Continuous Learning Culture", score: 3.4, prev: 3.2, tone: "blue" },
];

Object.assign(window, {
  THEMES, OKRS, VALUE_STREAMS, BUDGET_GUARDRAILS, ROADMAP_PIS, ROADMAP_LANES,
  ANOMALIES, DEPENDENCIES, RISKS, ROAM_TONE, TEAMS_DIR, VELOCITY, COMPETENCIES,
});
