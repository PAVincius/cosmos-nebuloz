// Mapa de processos — docs/superpowers/specs/2026-09-06-mapa-de-processos-design.md
// §1. Os 21 nós e as 23 arestas vieram do design (backoffice-process-map.jsx
// `PROC_NODES`/`PROC_EDGES`), consumidos por
// apps/app/scripts/seed-empresa-nebuloz.ts como `StaffProcess` e
// `StaffProcessEdge`. PZ-22, PZ-23 e a 24ª ligação vieram depois, com os
// diagramas BPMN (ver processos-bpmn/). O SQL de produção
// `packages/database/scripts/2026-09-seed-processos.sql` ainda tem só os 21.
//
// Só dados e tipos: sem import de valor de "@repo/database" (server-only).

export type ProcessoSeed = {
  codigo: string;
  nome: string;
  descricao: string;
  dominio:
    | "COMERCIAL"
    | "DELIVERY"
    | "GOVERNANCA"
    | "PLATAFORMA"
    | "LAB"
    | "MEDICAO";
  nivel: 1 | 2 | 3;
  tipo: "CORE" | "APOIO";
  donoNome: string | null;
  revisadoEm: string | null;
  tags: string[];
};

export type LigacaoSeed = { de: string; para: string; rotulo: string };

export const PROCESSOS_NEBULOZ: ProcessoSeed[] = [
  {
    codigo: "PZ-01",
    nome: "Funil de leads",
    descricao:
      "Lead → descoberta → avaliação → proposta. Saída sempre registrada.",
    dominio: "COMERCIAL",
    nivel: 2,
    tipo: "CORE",
    donoNome: "marina",
    revisadoEm: "2026-08-28",
    tags: ["lead", "estágio", "cac", "porta de entrada"],
  },
  {
    codigo: "PZ-02",
    nome: "Geração de proposta",
    descricao: "Escopo → preço de tabela → desconto → envio ao decisor.",
    dominio: "COMERCIAL",
    nivel: 3,
    tipo: "CORE",
    donoNome: "marina",
    revisadoEm: "2026-08-20",
    tags: ["preço", "acv", "assentos", "serviço"],
  },
  {
    codigo: "PZ-03",
    nome: "Simulação de capacidade",
    descricao:
      "Se eu ganhar esta proposta, quebro alguém? Roda antes do envio.",
    dominio: "DELIVERY",
    nivel: 2,
    tipo: "APOIO",
    donoNome: "artur",
    revisadoEm: "2026-08-14",
    tags: ["alocação", "horas", "kickoff", "quebra"],
  },
  {
    codigo: "PZ-04",
    nome: "Kickoff de engajamento",
    descricao: "Contrato assinado → time alocado → primeira semana.",
    dominio: "DELIVERY",
    nivel: 3,
    tipo: "CORE",
    donoNome: "tiago",
    revisadoEm: "2026-07-02",
    tags: ["onboarding", "time", "escopo", "cliente"],
  },
  {
    codigo: "PZ-05",
    nome: "Gate de fase (Scaffold)",
    descricao:
      "Critérios atendidos ou override nomeado. Nunca fecha em silêncio.",
    dominio: "DELIVERY",
    nivel: 2,
    tipo: "CORE",
    donoNome: "artur",
    revisadoEm: "2026-08-25",
    tags: ["assess", "pilot", "scale", "embed", "override", "critério"],
  },
  {
    codigo: "PZ-06",
    nome: "Encerramento de engajamento",
    descricao: "Entrega final, handover ao cliente, post-mortem interno.",
    dominio: "DELIVERY",
    nivel: 3,
    tipo: "CORE",
    donoNome: "tiago",
    revisadoEm: "2026-06-11",
    tags: ["handover", "lições", "renovação"],
  },
  {
    codigo: "PZ-07",
    nome: "Intake de caso de IA",
    descricao: "Caso submetido → triagem → classe de dado → decisão.",
    dominio: "GOVERNANCA",
    nivel: 3,
    tipo: "CORE",
    donoNome: "sofia",
    revisadoEm: "2026-08-04",
    tags: ["caso", "triagem", "classe de dado", "risco"],
  },
  {
    codigo: "PZ-08",
    nome: "Revisão de risco e vendor",
    descricao: "Matriz de risco por classe de dado; cláusulas de contrato.",
    dominio: "GOVERNANCA",
    nivel: 2,
    tipo: "CORE",
    donoNome: "sofia",
    revisadoEm: "2026-07-30",
    tags: ["vendor", "cláusula", "dpa", "matriz"],
  },
  {
    codigo: "PZ-09",
    nome: "Publicação de política",
    descricao: "Rascunho → aprovação → publicação → ciência dos times.",
    dominio: "GOVERNANCA",
    nivel: 1,
    tipo: "APOIO",
    donoNome: "sofia",
    revisadoEm: "2026-05-18",
    tags: ["política", "versão", "ciência", "onboarding"],
  },
  {
    codigo: "PZ-10",
    nome: "Provisionamento de tenant",
    descricao:
      "Proposta ganha → tenant criado → módulos contratados → owner convidado.",
    dominio: "PLATAFORMA",
    nivel: 3,
    tipo: "CORE",
    donoNome: "marina",
    revisadoEm: "2026-08-22",
    tags: ["tenant", "módulo", "owner", "convite"],
  },
  {
    codigo: "PZ-11",
    nome: "Suspensão e deleção",
    descricao: "Read-only → full-lock → deleção agendada com aprovação.",
    dominio: "PLATAFORMA",
    nivel: 2,
    tipo: "APOIO",
    donoNome: "marina",
    revisadoEm: "2026-08-05",
    tags: ["read-only", "lock", "aprovação", "retenção"],
  },
  {
    codigo: "PZ-12",
    nome: "Aprovação de MCP writes",
    descricao: "Pedido do cliente → revisão → modo concedido. Hoje é e-mail.",
    dominio: "PLATAFORMA",
    nivel: 2,
    tipo: "APOIO",
    donoNome: "marina",
    revisadoEm: null,
    tags: ["mcp", "gateway", "writes", "aprovação"],
  },
  {
    codigo: "PZ-13",
    nome: "Curadoria de dataset",
    descricao: "Coleta → remoção de PII → licença → pronto para treino.",
    dominio: "LAB",
    nivel: 3,
    tipo: "CORE",
    donoNome: "renata",
    revisadoEm: "2026-07-20",
    tags: ["pii", "licença", "dataset", "revisão"],
  },
  {
    codigo: "PZ-14",
    nome: "Promoção de modelo",
    descricao: "Shadow → canary → GA. Cada degrau exige avaliação e card.",
    dominio: "LAB",
    nivel: 2,
    tipo: "CORE",
    donoNome: "renata",
    revisadoEm: "2026-07-31",
    tags: ["shadow", "canary", "ga", "eval", "model card"],
  },
  {
    codigo: "PZ-15",
    nome: "Baseline assinado",
    descricao:
      "Medido antes do trabalho; assinado pelo dono do processo; emitido no gate.",
    dominio: "MEDICAO",
    nivel: 2,
    tipo: "CORE",
    donoNome: "artur",
    revisadoEm: "2026-08-15",
    tags: ["baseline", "assinatura", "dono do processo", "métrica"],
  },
  {
    codigo: "PZ-17",
    nome: "Meta e tabela de preço",
    descricao:
      "Define PRICING, pisos de assento e alçada de desconto. Revisado uma vez por ano.",
    dominio: "COMERCIAL",
    nivel: 1,
    tipo: "CORE",
    donoNome: "marina",
    revisadoEm: "2026-01-10",
    tags: ["meta", "pricing", "tabela", "desconto", "anual"],
  },
  {
    codigo: "PZ-18",
    nome: "Método da Escada",
    descricao:
      "Cinco degraus, nesta ordem. Publica templates e critérios que o gate consome.",
    dominio: "DELIVERY",
    nivel: 1,
    tipo: "CORE",
    donoNome: "artur",
    revisadoEm: "2026-08-05",
    tags: [
      "diagnose",
      "structure",
      "measure",
      "govern",
      "operate",
      "template",
      "fase",
    ],
  },
  {
    codigo: "PZ-19",
    nome: "Planos e limites por tenant",
    descricao:
      "Define o que cada plano libera: assentos, integrações, MCP, papéis.",
    dominio: "PLATAFORMA",
    nivel: 1,
    tipo: "CORE",
    donoNome: "marina",
    revisadoEm: "2026-03-03",
    tags: ["plano", "starter", "scale", "enterprise", "limite", "mcp"],
  },
  {
    codigo: "PZ-20",
    nome: "Roadmap do modelo próprio",
    descricao:
      "Que modelo treinar, para que tenant, com que GPU. Hoje é uma planilha.",
    dominio: "LAB",
    nivel: 1,
    tipo: "CORE",
    donoNome: "renata",
    revisadoEm: null,
    tags: ["roadmap", "slm", "capacidade", "gpu", "prioridade"],
  },
  {
    codigo: "PZ-21",
    nome: "Coleta e mapeamento de métricas",
    descricao:
      "Evento da fonte → métrica → fórmula versionada. Roda a cada sync.",
    dominio: "MEDICAO",
    nivel: 3,
    tipo: "APOIO",
    donoNome: "artur",
    revisadoEm: "2026-08-20",
    tags: ["evento", "fonte", "fórmula", "frescor", "conexão"],
  },
  {
    codigo: "PZ-16",
    nome: "Decisão de valor",
    descricao: "Comitê mensal decide continuar, escalar, pivotar ou encerrar.",
    dominio: "MEDICAO",
    nivel: 1,
    tipo: "CORE",
    donoNome: "marina",
    revisadoEm: "2026-09-01",
    tags: ["comitê", "veredito", "escalar", "encerrar", "rationale"],
  },
  // PZ-22 e PZ-23 não vieram do design: entraram com os primeiros diagramas
  // BPMN (2026-09-26), cada um com fonte escrita — o runbook de acesso e o
  // plano de resposta a incidente. Sem dono nomeado porque as fontes dão
  // cargo, não pessoa.
  {
    codigo: "PZ-22",
    nome: "Acesso ao back-office",
    descricao:
      "Conta própria → papel por SQL no tenant system → autenticador. Revogar é DELETE.",
    dominio: "PLATAFORMA",
    nivel: 3,
    tipo: "APOIO",
    donoNome: null,
    revisadoEm: null,
    tags: ["staff", "2fa", "admin", "member", "revogação"],
  },
  {
    codigo: "PZ-23",
    nome: "Resposta a incidente",
    descricao:
      "Detecção → triagem P0–P3 → contenção → notificação → post-mortem.",
    dominio: "GOVERNANCA",
    nivel: 2,
    tipo: "APOIO",
    donoNome: null,
    revisadoEm: "2026-05-19",
    tags: ["incidente", "severidade", "anpd", "72h", "post-mortem"],
  },
];

export const LIGACOES_NEBULOZ: LigacaoSeed[] = [
  { de: "PZ-01", para: "PZ-02", rotulo: "converte em" },
  { de: "PZ-02", para: "PZ-03", rotulo: "exige" },
  { de: "PZ-02", para: "PZ-10", rotulo: "ganha → dispara" },
  { de: "PZ-10", para: "PZ-04", rotulo: "dispara" },
  { de: "PZ-04", para: "PZ-05", rotulo: "roda em" },
  { de: "PZ-05", para: "PZ-15", rotulo: "emite" },
  { de: "PZ-15", para: "PZ-16", rotulo: "alimenta" },
  { de: "PZ-05", para: "PZ-06", rotulo: "termina em" },
  { de: "PZ-07", para: "PZ-08", rotulo: "escala para" },
  { de: "PZ-08", para: "PZ-09", rotulo: "atualiza" },
  { de: "PZ-09", para: "PZ-05", rotulo: "condiciona scale" },
  { de: "PZ-07", para: "PZ-12", rotulo: "classifica" },
  { de: "PZ-13", para: "PZ-14", rotulo: "alimenta" },
  { de: "PZ-14", para: "PZ-08", rotulo: "passa por" },
  { de: "PZ-11", para: "PZ-06", rotulo: "após" },
  { de: "PZ-16", para: "PZ-02", rotulo: "escalar → nova" },
  { de: "PZ-17", para: "PZ-02", rotulo: "define tabela de" },
  { de: "PZ-18", para: "PZ-05", rotulo: "define critérios de" },
  { de: "PZ-19", para: "PZ-10", rotulo: "parametriza" },
  { de: "PZ-19", para: "PZ-12", rotulo: "limita" },
  { de: "PZ-20", para: "PZ-13", rotulo: "prioriza" },
  { de: "PZ-21", para: "PZ-15", rotulo: "alimenta" },
  { de: "PZ-16", para: "PZ-17", rotulo: "realimenta" },
  // Fonte: docs/runbooks/acesso-ao-backoffice.md "Revogar" (conta comprometida
  // → apagar Session) e o runbook de conta comprometida do plano de incidente.
  { de: "PZ-23", para: "PZ-22", rotulo: "conta comprometida → revoga" },
];
