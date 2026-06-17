// cosmos-data4.jsx — data for secondary screens
// (Strategy Map, Tag Rules, Governance, Decision Log, Large Solution, Workflows, Integrações, Settings, Webhooks, Copilot).

// ---- Strategy Map ----
const STRATEGY = {
  vision: "Ser a infraestrutura financeira mais confiável e inteligente da América Latina até 2028.",
  pillars: [
    { id: "P1", name: "Expandir mercados", tone: "blue", themes: ["Expansão LATAM"], epics: 3, progress: 22 },
    { id: "P2", name: "Plataforma de classe mundial", tone: "purple", themes: ["Modernização da Plataforma", "Enterprise Ready"], epics: 5, progress: 45 },
    { id: "P3", name: "Confiança por padrão", tone: "red", themes: ["Confiança & Risco"], epics: 2, progress: 14 },
    { id: "P4", name: "Inteligência aplicada", tone: "amber", themes: ["Data & AI"], epics: 2, progress: 31 },
    { id: "P5", name: "Eficiência operacional", tone: "green", themes: ["Eficiência de Custo"], epics: 2, progress: 100 },
  ],
};

// ---- Tag Rules ----
const TAG_RULES = [
  { id: "TR-01", name: "Marcar épicos de alto valor", cond: "WSJF ≥ 18", tag: "prioridade-máxima", tagTone: "red", on: true, matched: 4, scope: "Épicos" },
  { id: "TR-02", name: "Sinalizar dependências cross-ART", cond: "time origem ≠ time destino", tag: "cross-art", tagTone: "amber", on: true, matched: 5, scope: "Features" },
  { id: "TR-03", name: "Classificar trabalho de modernização", cond: "tema = Modernização da Plataforma", tag: "tech-debt", tagTone: "purple", on: true, matched: 9, scope: "Épicos" },
  { id: "TR-04", name: "Anexar guardrail FinOps", cond: "custo de nuvem > US$ 8k/mês", tag: "finops-watch", tagTone: "blue", on: false, matched: 3, scope: "Value streams" },
  { id: "TR-05", name: "Marcar risco regulatório", cond: "rótulo contém 'Open Finance'", tag: "compliance", tagTone: "green", on: true, matched: 2, scope: "Épicos" },
  { id: "TR-06", name: "Identificar épicos parados", cond: "sem atualização há 14 dias", tag: "estagnado", tagTone: "amber", on: true, matched: 1, scope: "Épicos" },
];

// ---- Governance Board (gates / lean governance) ----
const GOV_EPICS = [
  { id: "EP-076", title: "Migração core para multi-tenant", art: "plat", stage: 3, owner: "Helena Souza", investment: "US$ 1,8M", status: "approved" },
  { id: "EP-097", title: "Antifraude em tempo real (ML)", art: "data", stage: 2, owner: "Letícia Rocha", investment: "US$ 0,9M", status: "review" },
  { id: "EP-070", title: "Pix recorrente & agendado", art: "pay", stage: 3, owner: "Bruno Dias", investment: "US$ 0,6M", status: "approved" },
  { id: "EP-109", title: "Open Finance · agregação", art: "pay", stage: 1, owner: "Marina Alves", investment: "US$ 1,1M", status: "review" },
  { id: "EP-118", title: "Programa de fidelidade B2B", art: "growth", stage: 0, owner: "Caio Nunes", investment: "US$ 0,4M", status: "hold" },
];
const GOV_STAGES = ["Funnel", "Reviewing", "Analyzing", "Implementing"];

// ---- Decision Log ----
const DECISIONS = [
  { id: "ADR-042", title: "Adotar arquitetura multi-tenant por schema isolado", date: "28 mai", owner: "Helena Souza", status: "Aceita", tone: "green", tags: ["arquitetura", "core"], note: "Isolamento por schema equilibra segurança e custo operacional vs. database-per-tenant." },
  { id: "ADR-041", title: "Padronizar feature store em streaming (Kafka + Flink)", date: "21 mai", owner: "Letícia Rocha", status: "Aceita", tone: "green", tags: ["data", "ml"], note: "Latência p99 < 50ms exige processamento em streaming, não batch." },
  { id: "ADR-040", title: "Postergar migração para service mesh", date: "14 mai", owner: "Rafael Teixeira", status: "Adiada", tone: "amber", tags: ["infra"], note: "Custo de complexidade não justifica antes do cutover multi-tenant." },
  { id: "ADR-039", title: "Usar provedor externo de KYC vs. construção interna", date: "07 mai", owner: "Bruno Dias", status: "Em debate", tone: "blue", tags: ["produto", "compliance"], note: "Trade-off entre time-to-market e dependência de fornecedor em avaliação." },
  { id: "ADR-038", title: "Descontinuar API v1 de pagamentos em PI-28", date: "30 abr", owner: "Marina Alves", status: "Aceita", tone: "green", tags: ["api", "deprecation"], note: "Migração de clientes em andamento; sunset comunicado com 2 PIs de antecedência." },
];

// ---- Large Solution (solution train) ----
const SOLUTION = {
  name: "Plataforma Financeira COSMOS",
  arts: [
    { name: "Payments ART", tone: "blue", teams: 3, capabilities: 4, pi: 78 },
    { name: "Platform ART", tone: "purple", teams: 4, capabilities: 5, pi: 64 },
    { name: "Data & AI ART", tone: "amber", teams: 2, capabilities: 3, pi: 52 },
    { name: "Growth ART", tone: "green", teams: 2, capabilities: 3, pi: 88 },
  ],
  capabilities: [
    { id: "CAP-12", title: "Núcleo transacional multi-tenant", arts: ["Platform ART", "Payments ART"], progress: 42, tone: "purple", milestone: "GA PI-26" },
    { id: "CAP-08", title: "Antifraude e scoring de risco unificado", arts: ["Data & AI ART", "Payments ART"], progress: 28, tone: "amber" },
    { id: "CAP-15", title: "Open Finance & agregação de contas", arts: ["Payments ART", "Growth ART"], progress: 12, tone: "blue", milestone: "Beta PI-27" },
    { id: "CAP-04", title: "Identidade e acesso enterprise (SSO/SCIM)", arts: ["Platform ART"], progress: 64, tone: "green" },
  ],
};

// ---- Workflows ----
const WORKFLOWS = [
  { id: "WF-01", name: "Promover épico ao aprovar gate", trigger: "Épico → Approved", actions: 3, runs: 142, on: true, tone: "blue" },
  { id: "WF-02", name: "Notificar Slack em risco crítico", trigger: "Risco severidade ≥ 16", actions: 2, runs: 38, on: true, tone: "red" },
  { id: "WF-03", name: "Abrir issue no Jira ao criar feature", trigger: "Feature criada", actions: 2, runs: 261, on: true, tone: "purple" },
  { id: "WF-04", name: "Recalcular WSJF ao mudar Cost of Delay", trigger: "Campo CoD alterado", actions: 1, runs: 89, on: true, tone: "accent" },
  { id: "WF-05", name: "Arquivar épicos concluídos há 30d", trigger: "Agendado · diário", actions: 2, runs: 12, on: false, tone: "green" },
];

// ---- Integrações ----
const INTEGRATIONS = [
  { name: "Jira", cat: "Gestão", tone: "blue", letter: "J", connected: true, detail: "Sincroniza épicos e features bidirecionalmente", synced: "há 3 min" },
  { name: "GitHub", cat: "Código", tone: "purple", letter: "G", connected: true, detail: "Vincula PRs e deploys a features", synced: "há 1 min" },
  { name: "Slack", cat: "Comunicação", tone: "green", letter: "S", connected: true, detail: "Alertas de risco, gates e anomalias", synced: "tempo real" },
  { name: "AWS Cost Explorer", cat: "FinOps", tone: "amber", letter: "A", connected: true, detail: "Ingestão de custo de nuvem para anomalias", synced: "há 12 min" },
  { name: "Figma", cat: "Design", tone: "red", letter: "F", connected: false, detail: "Anexa specs de design a features" },
  { name: "Datadog", cat: "Observabilidade", tone: "purple", letter: "D", connected: false, detail: "Métricas de fluxo e aging em tempo real" },
];

// ---- Webhooks ----
const WEBHOOKS = [
  { id: "WH-01", url: "https://hooks.cosmos.dev/portfolio/epics", events: ["epic.created", "epic.gate_passed"], status: "active", last: "200 · há 2 min" },
  { id: "WH-02", url: "https://ops.payments.internal/safe-sync", events: ["feature.updated", "dependency.at_risk"], status: "active", last: "200 · há 8 min" },
  { id: "WH-03", url: "https://finops.cosmos.dev/anomaly", events: ["anomaly.detected"], status: "active", last: "200 · há 1h" },
  { id: "WH-04", url: "https://legacy.cosmos.dev/v1/notify", events: ["risk.created"], status: "failing", last: "503 · há 20 min" },
];

// ---- Copilot ----
const COPILOT_THREAD = [
  { role: "user", text: "Onde estão os maiores riscos de entrega no PI-26?" },
  { role: "assistant", text: "Três pontos de atenção no PI-26:", insights: [
    { icon: "alert", tone: "red", title: "Squad Núcleo a 110% de capacidade", body: "44 de 40 pts comprometidos. 4 dependências dependem do isolation layer (FE-204)." },
    { icon: "dollar", tone: "amber", title: "Data ART próximo do guardrail FinOps", body: "2 anomalias abertas somam US$ 30k acima do baseline neste mês." },
    { icon: "gitBranch", tone: "blue", title: "2 dependências cross-team em risco", body: "Pix agendado e feature store realtime dependem do mesmo bloqueio." },
  ] },
];
const COPILOT_SUGGESTIONS = [
  "Resuma a saúde do portfólio para a diretoria",
  "Quais épicos estão atrasados vs. o roadmap?",
  "Rebalanceie a fila WSJF com base nas metas do PI",
  "Liste decisões arquiteturais em aberto",
];

Object.assign(window, {
  STRATEGY, TAG_RULES, GOV_EPICS, GOV_STAGES, DECISIONS, SOLUTION,
  WORKFLOWS, INTEGRATIONS, WEBHOOKS, COPILOT_THREAD, COPILOT_SUGGESTIONS,
});
