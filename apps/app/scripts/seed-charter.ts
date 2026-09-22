/**
 * scripts/seed-charter.ts
 *
 * Popula o módulo Charter (governança de IA) num tenant existente.
 *
 *   pnpm seed:charter              → tenant "medcore"
 *   pnpm seed:charter cosmos-dev   → outro slug
 *
 * O que cria:
 *   - TenantModule CHARTER (o tenant passa a ter Cosmos + Charter, e o
 *     app-switcher aparece — é a prova visível do ADR-0001)
 *   - CharterSettings + 4 personas de governança com CharterMembership
 *   - Política com 9 seções (4 fora de publicação, de propósito) + 4 versões
 *   - 8 cláusulas, 7 fornecedores, 12 casos de uso, 7 mitigações
 *   - 5 trilhas de onboarding com aceites reais (1.946 linhas)
 *   - Trilha de auditoria retroativa
 *
 * Dado fictício de propósito (README do handoff): a org e os fornecedores são
 * inventados. Tier de risco é julgamento de governança, não afirmação sobre
 * empresa real. Não substituir por nomes reais em demo pública.
 *
 * `maxClass` de cada fornecedor NÃO é copiado do protótipo: é derivado por
 * deriveVendorMaxClass() a partir das cláusulas, conforme ADR-0003. Os valores
 * resultantes divergem do protótipo em V-01 e V-02 — ver o ADR.
 *
 * Idempotente: apaga e recria todo o domínio Charter do tenant alvo. Não toca
 * em nada do Cosmos.
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { Pool } from "pg";
import type {
  CharterDataClass,
  CharterVendorTier,
  Prisma,
  PrismaClient as PrismaClientType,
} from "../../../packages/database/generated";
import { PrismaClient } from "../../../packages/database/generated";
import {
  deriveVendorMaxClass,
  INTAKE_DEPARTMENTS,
  riskScore,
  TRACK_AUDIENCES,
  VENDOR_CATEGORIES,
  vendorEligibility,
} from "../lib/charter/rules";

// Departamento padrão do seed ("Atendimento"); nome curto para caber em 80 colunas.
const DEPT = INTAKE_DEPARTMENTS[1];

type Tx = Prisma.TransactionClient;

const TENANT_SLUG = process.argv[2] ?? "medcore";

// Senha de desenvolvimento das personas. Só existe para que o dado semeado seja
// acessível — sem credencial, o seed produz um banco que ninguém consegue abrir.
// Configurável por env; nunca usar em ambiente que não seja local.
const PERSONA_PASSWORD = process.env.CHARTER_SEED_PASSWORD ?? "charter123";

// Hoje congelado: o dataset é datado e as distâncias entre datas (SLA
// consumido, dias de atraso de aceite) precisam ser estáveis entre execuções.
const NOW = new Date("2026-07-28T12:00:00Z");
const d = (iso: string) => new Date(`${iso}T12:00:00Z`);
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const daysAhead = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

// ── Personas de governança ────────────────────────────────────────────────────
// Quatro usuários reais, um por papel. O seletor de persona do protótipo não
// existe em produção (ADR-0004), então demonstrar os quatro pontos de vista
// exige quatro logins.

const PERSONAS = [
  {
    email: "marina.alves@vanta.exemplo",
    name: "Marina Alves",
    charterRole: "COMPLIANCE" as const,
    title: "Compliance Lead",
  },
  {
    email: "diego.prado@vanta.exemplo",
    name: "Diego Prado",
    charterRole: "SECURITY" as const,
    title: "CISO",
  },
  {
    email: "ana.beatriz@vanta.exemplo",
    name: "Ana Beatriz",
    charterRole: "HR" as const,
    title: "People Ops",
  },
  {
    email: "rafael.lima@vanta.exemplo",
    name: "Rafael Lima",
    charterRole: "REQUESTER" as const,
    title: "AI Program Lead",
  },
];

// ── Política ──────────────────────────────────────────────────────────────────
// Quatro seções fora de `PUBLISHED` de propósito: é o estado que faz o modal de
// publicação listar bloqueadores por nome (FR-2.3) em vez de só desabilitar.

const SECTIONS = [
  {
    ordinal: 1,
    name: "Perfil organizacional e contexto",
    status: "PUBLISHED" as const,
    updated: "2026-06-18",
    body: "A Vanta Saúde opera em saúde digital e pagamentos, sob LGPD e GDPR, com dados de pacientes classificados como Restrito. Esta política define fronteiras de uso de IA aplicáveis a todo colaborador, contratado e fornecedor com acesso a sistemas internos.",
  },
  {
    ordinal: 2,
    name: "Classificação de dados",
    status: "PUBLISHED" as const,
    updated: "2026-06-18",
    body: "Todo dado tratado por ferramenta de IA deve ser classificado antes do uso: Público, Interno, Confidencial ou Restrito. A classificação determina quais ferramentas são elegíveis e qual nível de revisão humana é obrigatório.",
  },
  {
    ordinal: 3,
    name: "Usos permitidos",
    status: "PUBLISHED" as const,
    updated: "2026-06-18",
    body: "Redação e revisão de conteúdo interno, geração de código com revisão obrigatória, sumarização de documentos Internos ou Públicos, apoio a pesquisa e prototipação sem dados de paciente.",
  },
  {
    ordinal: 4,
    name: "Usos restritos",
    status: "REVIEW" as const,
    updated: "2026-07-02",
    body: "Análise de dados Confidenciais exige ambiente com retenção zero e aprovação de Segurança. Atendimento assistido por IA a paciente exige human-in-the-loop com registro. Automação de decisão com efeito contratual exige aprovação do Comitê.",
  },
  {
    ordinal: 5,
    name: "Usos proibidos",
    status: "PUBLISHED" as const,
    updated: "2026-06-18",
    body: "Envio de PII/PHI para ferramenta pública sem BAA. Decisão clínica automatizada sem supervisão médica. Avaliação de crédito ou emprego exclusivamente por modelo. Geração de conteúdo que se apresente como parecer humano.",
  },
  {
    ordinal: 6,
    name: "IA voltada ao cliente",
    status: "DRAFT" as const,
    updated: "2026-07-09",
    body: "Rascunho: toda superfície de IA visível ao cliente exige divulgação explícita, caminho de escalonamento humano em até um clique, e registro de conversas por 24 meses.",
  },
  {
    ordinal: 7,
    name: "Requisitos de aprovação",
    status: "PUBLISHED" as const,
    updated: "2026-06-18",
    body: "Casos com dado Interno seguem via rápida (SLA 3 dias úteis). Confidencial exige Segurança (SLA 5 dias). Restrito ou externo exige Legal + Segurança e parecer do Comitê de IA (SLA 10 dias).",
  },
  {
    ordinal: 8,
    name: "Human-in-the-loop",
    status: "REVIEW" as const,
    updated: "2026-07-05",
    body: "Define três níveis: revisão integral (toda saída revisada), revisão por amostragem (≥20% com trilha) e supervisão passiva (alerta por exceção). O nível mínimo é derivado da criticidade da decisão.",
  },
  {
    ordinal: 9,
    name: "Escalonamento e exceções",
    status: "DRAFT" as const,
    updated: "2026-07-11",
    body: "Rascunho: exceções são temporárias, nominais e expiram em 90 dias. Toda exceção exige mitigação compensatória registrada e revisão no Comitê seguinte.",
  },
];

const VERSIONS = [
  {
    version: "v3.2",
    when: "2026-06-18",
    status: "PUBLISHED" as const,
    summary:
      "Classificação de dados reescrita com quatro níveis; PHI movido para Restrito.",
    changes: 6,
  },
  {
    version: "v3.1",
    when: "2026-04-04",
    status: "SUPERSEDED" as const,
    summary: "Retenção zero obrigatória para dados Confidenciais.",
    changes: 3,
  },
  {
    version: "v3.0",
    when: "2026-01-12",
    status: "SUPERSEDED" as const,
    summary:
      "Reestruturação completa após auditoria externa; adição de human-in-the-loop.",
    changes: 14,
  },
  {
    version: "v2.4",
    when: "2025-09-22",
    status: "SUPERSEDED" as const,
    summary: "Primeira versão com requisitos de aprovação por criticidade.",
    changes: 5,
  },
];

// ── Cláusulas ─────────────────────────────────────────────────────────────────

const CLAUSES = [
  {
    code: "CL-01",
    name: "Proibição de treinamento com dados do cliente",
    critical: true,
  },
  { code: "CL-02", name: "Retenção zero de prompt e resposta", critical: true },
  { code: "CL-03", name: "Notificação de incidente em 24h", critical: true },
  {
    code: "CL-04",
    name: "Lista de sub-processadores e direito de objeção",
    critical: true,
  },
  {
    code: "CL-05",
    name: "Localidade de processamento definida contratualmente",
    critical: false,
  },
  { code: "CL-06", name: "Direito de auditoria anual", critical: false },
  { code: "CL-07", name: "Indenização por violação de PI", critical: false },
  { code: "CL-08", name: "BAA / adendo de dado de saúde", critical: true },
];

// ── Fornecedores ──────────────────────────────────────────────────────────────
// `maxClass` NÃO vem daqui — é derivado das cláusulas (ADR-0003).

const VENDORS: {
  code: string;
  name: string;
  category: string;
  tier: CharterVendorTier;
  region: string;
  dpa: boolean;
  retention: string;
  subprocessors: number;
  renewal: string | null;
  score: number;
  notes: string;
  clauses: string[];
}[] = [
  {
    code: "V-01",
    name: "Lumen Assist",
    category: "Assistente de texto",
    tier: "APPROVED",
    region: "UE (Frankfurt)",
    dpa: true,
    retention: "Zero",
    subprocessors: 3,
    renewal: "2026-11-12",
    score: 28,
    notes:
      "DPA assinado com adendo de não-treinamento. Retenção zero verificada em abr/2026.",
    clauses: ["CL-01", "CL-02", "CL-03", "CL-04", "CL-05"],
  },
  {
    code: "V-02",
    name: "Kairos Decision Cloud",
    category: "Modelos de decisão",
    tier: "RESTRICTED",
    region: "EUA (Virgínia)",
    dpa: true,
    retention: "30 dias",
    subprocessors: 7,
    renewal: "2026-09-03",
    score: 62,
    notes:
      "Restrito: sem explicabilidade suficiente para decisão com efeito sobre pessoa física. Retenção de 30 dias incompatível com dado Confidencial.",
    clauses: ["CL-01", "CL-03", "CL-05"],
  },
  {
    code: "V-03",
    name: "Forge Dev Copilot",
    category: "Assistente de código",
    tier: "APPROVED",
    region: "UE (Dublin)",
    dpa: true,
    retention: "Zero",
    subprocessors: 2,
    renewal: "2027-01-20",
    score: 22,
    notes:
      "Escopo limitado a repositórios internos. Telemetria de sugestão desabilitada.",
    clauses: ["CL-01", "CL-02", "CL-03", "CL-04", "CL-06"],
  },
  {
    code: "V-04",
    name: "Meridian Health AI",
    category: VENDOR_CATEGORIES[0], // "Assistente de texto" — resume prontuário
    tier: "RESTRICTED",
    region: "BR (São Paulo)",
    dpa: true,
    retention: "Zero",
    subprocessors: 1,
    renewal: "2027-06-08",
    score: 55,
    notes:
      "Único fornecedor com BAA e ambiente dedicado. Uso exige revisão profissional integral.",
    clauses: ["CL-01", "CL-02", "CL-03", "CL-04", "CL-05", "CL-08"],
  },
  {
    code: "V-05",
    name: "Beacon Data Enrich",
    category: "Enriquecimento de dados",
    tier: "REVIEW",
    region: "EUA (Oregon)",
    dpa: false,
    retention: "90 dias",
    subprocessors: 11,
    renewal: null,
    score: 71,
    notes:
      "Em revisão: DPA pendente e 11 sub-processadores não mapeados. Bloqueado para qualquer dado não-público.",
    clauses: ["CL-03"],
  },
  {
    code: "V-06",
    name: "Corpus Legal Review",
    category: "Análise contratual",
    tier: "REVIEW",
    region: "UE (Amsterdã)",
    dpa: true,
    retention: "14 dias",
    subprocessors: 4,
    renewal: null,
    score: 48,
    notes:
      "Retenção de 14 dias incompatível com política para Confidencial. Negociação em curso.",
    clauses: ["CL-01", "CL-03", "CL-05"],
  },
  {
    code: "V-07",
    name: "Nimbus Voice Clone",
    category: "Síntese de voz",
    tier: "BLOCKED",
    region: "Não declarada",
    dpa: false,
    retention: "Indefinida",
    subprocessors: 0,
    renewal: null,
    score: 94,
    notes:
      "Bloqueado: retenção indefinida, região não declarada e risco de personificação de profissional de saúde.",
    clauses: [],
  },
];

// ── Casos de uso ──────────────────────────────────────────────────────────────

type SeedCase = {
  code: string;
  title: string;
  dept: string;
  owner: string;
  vendor: string;
  dataClass: CharterDataClass;
  exposure: "INTERNAL" | "EXTERNAL";
  criticality: "LOW" | "MEDIUM" | "HIGH";
  hitl: "FULL_REVIEW" | "SAMPLING" | "PASSIVE" | null;
  status:
    | "DRAFT"
    | "SUBMITTED"
    | "REVIEW"
    | "CHANGES"
    | "APPROVED"
    | "RESTRICTED"
    | "BLOCKED"
    | "ARCHIVED";
  approvalPath: string | null;
  slaTotal: number | null;
  submitted: string | null;
  reviewer: string | null;
  objective: string;
  risks: [number, number, number, number, number, number, number]; // privacy, regulatory, security, bias, ip, operational, reputational
  restrictions?: string[];
  blockReason?: string;
  changeRequest?: string;
};

const COMMITTEE = "Legal + Segurança + Comitê de IA";
const SEC_LEGAL = "Segurança + Legal";
const SEC = "Segurança";

const CASES: SeedCase[] = [
  {
    code: "UC-118",
    title: "Triagem assistida de sinistros",
    dept: "Operações",
    owner: "Rafael Lima",
    vendor: "V-02",
    dataClass: "RESTRICTED",
    exposure: "INTERNAL",
    criticality: "HIGH",
    hitl: "FULL_REVIEW",
    status: "REVIEW",
    approvalPath: COMMITTEE,
    slaTotal: 10,
    submitted: "2026-07-16",
    reviewer: "Diego Prado",
    objective:
      "Reduzir tempo de triagem de sinistros de saúde priorizando casos por completude documental.",
    risks: [5, 5, 4, 4, 2, 3, 3],
  },
  {
    code: "UC-117",
    title: "Copiloto de atendimento ao beneficiário",
    dept: "CX",
    owner: "Camila Ryu",
    vendor: "V-01",
    dataClass: "CONFIDENTIAL",
    exposure: "EXTERNAL",
    criticality: "HIGH",
    hitl: "FULL_REVIEW",
    status: "REVIEW",
    approvalPath: COMMITTEE,
    slaTotal: 10,
    submitted: "2026-07-21",
    reviewer: "Marina Alves",
    objective:
      "Responder dúvidas de cobertura com escalonamento humano em um clique.",
    risks: [4, 4, 3, 3, 2, 4, 5],
  },
  {
    code: "UC-116",
    title: "Geração de testes automatizados",
    dept: "Engenharia",
    owner: "Bruno Sato",
    vendor: "V-03",
    dataClass: "INTERNAL",
    exposure: "INTERNAL",
    criticality: "LOW",
    hitl: "SAMPLING",
    status: "APPROVED",
    approvalPath: SEC,
    slaTotal: 3,
    submitted: "2026-07-02",
    reviewer: "Diego Prado",
    objective:
      "Gerar suíte de testes a partir de especificações de API internas.",
    risks: [1, 1, 2, 1, 3, 2, 1],
  },
  {
    code: "UC-115",
    title: "Resumo de prontuário para equipe clínica",
    dept: DEPT,
    owner: "Dra. Helena Braz",
    vendor: "V-04",
    dataClass: "RESTRICTED",
    exposure: "INTERNAL",
    criticality: "HIGH",
    hitl: "FULL_REVIEW",
    status: "RESTRICTED",
    approvalPath: COMMITTEE,
    slaTotal: 10,
    submitted: "2026-06-24",
    reviewer: "Marina Alves",
    objective:
      "Sumarizar histórico clínico para reduzir tempo de leitura em consulta.",
    risks: [5, 5, 4, 3, 1, 3, 4],
    restrictions: [
      "Somente ambiente dedicado com BAA assinado",
      "Saída sempre revisada por profissional de saúde",
      "Retenção de prompt desabilitada e auditada trimestralmente",
    ],
  },
  {
    code: "UC-114",
    title: "Enriquecimento de leads com dados públicos",
    dept: "Growth",
    owner: "Tiago Muniz",
    vendor: "V-05",
    dataClass: "PUBLIC",
    exposure: "INTERNAL",
    criticality: "LOW",
    hitl: "PASSIVE",
    status: "APPROVED",
    approvalPath: "Via rápida — aprovação automática com registro",
    slaTotal: 1,
    submitted: "2026-06-20",
    reviewer: "Diego Prado",
    objective:
      "Complementar cadastro de leads com informação pública de empresa.",
    risks: [2, 2, 2, 2, 1, 1, 2],
  },
  {
    code: "UC-113",
    title: "Score de propensão a inadimplência",
    dept: "Financeiro",
    owner: "Paula Serra",
    vendor: "V-02",
    dataClass: "CONFIDENTIAL",
    exposure: "INTERNAL",
    criticality: "HIGH",
    hitl: "FULL_REVIEW",
    status: "BLOCKED",
    approvalPath: SEC_LEGAL,
    slaTotal: null,
    submitted: "2026-06-14",
    reviewer: "Marina Alves",
    objective: "Priorizar cobrança por probabilidade de inadimplência.",
    risks: [4, 5, 3, 5, 2, 3, 4],
    blockReason:
      "Decisão com efeito financeiro direto sobre pessoa física exige modelo auditável e explicabilidade — não atendido pelo fornecedor proposto.",
  },
  {
    code: "UC-112",
    title: "Tradução de material de marketing",
    dept: "Marketing",
    owner: "Lia Costa",
    vendor: "V-01",
    dataClass: "PUBLIC",
    exposure: "EXTERNAL",
    criticality: "LOW",
    hitl: "SAMPLING",
    status: "APPROVED",
    approvalPath: SEC,
    slaTotal: 3,
    submitted: "2026-06-11",
    reviewer: "Diego Prado",
    objective:
      "Traduzir campanhas para espanhol e inglês mantendo tom de marca.",
    risks: [1, 1, 1, 2, 3, 2, 3],
  },
  {
    code: "UC-111",
    title: "Assistente de auditoria de contratos",
    dept: "Legal",
    owner: "Marina Alves",
    vendor: "V-06",
    dataClass: "CONFIDENTIAL",
    exposure: "INTERNAL",
    criticality: "MEDIUM",
    hitl: "FULL_REVIEW",
    status: "CHANGES",
    approvalPath: SEC_LEGAL,
    slaTotal: 5,
    submitted: "2026-07-22",
    reviewer: "Diego Prado",
    objective: "Localizar cláusulas ausentes em contratos de fornecedor.",
    risks: [3, 3, 3, 1, 4, 2, 2],
    changeRequest:
      "Declarar sub-processadores do fornecedor e anexar evidência de retenção zero.",
  },
  {
    code: "UC-110",
    title: "Classificação de tickets de suporte",
    dept: "CX",
    owner: "Camila Ryu",
    vendor: "V-03",
    dataClass: "INTERNAL",
    exposure: "INTERNAL",
    criticality: "LOW",
    hitl: "PASSIVE",
    status: "APPROVED",
    approvalPath: SEC,
    slaTotal: 3,
    submitted: "2026-05-28",
    reviewer: "Diego Prado",
    objective: "Rotear tickets por tema e urgência.",
    risks: [2, 1, 2, 3, 1, 2, 1],
  },
  {
    code: "UC-109",
    title: "Geração de laudo preliminar por imagem",
    dept: DEPT,
    owner: "Dr. Ivo Mattos",
    vendor: "V-04",
    dataClass: "RESTRICTED",
    exposure: "EXTERNAL",
    criticality: "HIGH",
    hitl: "FULL_REVIEW",
    status: "SUBMITTED",
    approvalPath: COMMITTEE,
    slaTotal: 10,
    // Submetido há 11 dias corridos → SLA de 10 dias úteis estourado.
    // É o alerta vermelho no topo da Visão Geral, e é intencional.
    submitted: "2026-07-10",
    reviewer: null,
    objective:
      "Produzir laudo preliminar de exame de imagem para acelerar fila de diagnóstico.",
    risks: [5, 5, 4, 4, 2, 4, 5],
  },
  {
    code: "UC-108",
    title: "Sumarização de reuniões internas",
    dept: "Operações",
    owner: "Rafael Lima",
    vendor: "V-01",
    dataClass: "INTERNAL",
    exposure: "INTERNAL",
    criticality: "LOW",
    hitl: null,
    status: "DRAFT",
    approvalPath: null,
    slaTotal: null,
    submitted: null,
    reviewer: null,
    objective: "Gerar ata e itens de ação a partir de gravação de reunião.",
    risks: [3, 2, 2, 1, 2, 2, 2],
  },
  {
    code: "UC-107",
    title: "Chatbot de FAQ no site público",
    dept: "Marketing",
    owner: "Lia Costa",
    vendor: "V-05",
    dataClass: "PUBLIC",
    exposure: "EXTERNAL",
    criticality: "MEDIUM",
    hitl: "SAMPLING",
    status: "ARCHIVED",
    approvalPath: SEC,
    slaTotal: 3,
    submitted: "2026-05-02",
    reviewer: "Marina Alves",
    objective: "Responder dúvidas gerais de produto no site.",
    risks: [1, 2, 2, 2, 1, 2, 3],
  },
];

// ── Mitigações ────────────────────────────────────────────────────────────────

// Prazos deslocados em relação ao protótipo para preservar a *forma* do
// dataset com NOW = 28/07: exatamente uma mitigação atrasada (MIT-27, há 12
// dias), que é o alerta âmbar da Visão Geral. Copiar as datas literais do
// protótipo — cujo "hoje" implícito era ~13/07 — deixaria quatro atrasadas e
// afogaria o sinal.
const MITIGATIONS = [
  {
    code: "MIT-31",
    uc: "UC-118",
    cat: "PRIVACY" as const,
    action: "Pseudonimizar identificadores antes do envio ao modelo",
    owner: "Diego Prado",
    due: "2026-08-07",
    status: "PROGRESS" as const,
  },
  {
    code: "MIT-30",
    uc: "UC-118",
    cat: "BIAS" as const,
    action: "Auditoria de paridade por faixa etária e região",
    owner: "Rafael Lima",
    due: "2026-08-14",
    status: "OPEN" as const,
  },
  {
    code: "MIT-29",
    uc: "UC-117",
    cat: "REPUTATIONAL" as const,
    action: "Divulgação explícita de IA e escalonamento em 1 clique",
    owner: "Camila Ryu",
    due: "2026-08-01",
    status: "PROGRESS" as const,
  },
  {
    code: "MIT-28",
    uc: "UC-115",
    cat: "PRIVACY" as const,
    action: "Verificação trimestral de retenção zero no ambiente dedicado",
    owner: "Diego Prado",
    due: "2026-09-30",
    status: "DONE" as const,
  },
  // Única atrasada: vencida em 16/07, ainda aberta. `overdue` é derivado de
  // `dueDate < now && status != DONE`, nunca persistido.
  {
    code: "MIT-27",
    uc: "UC-111",
    cat: "IP" as const,
    action: "Mapear sub-processadores e anexar ao registro do fornecedor",
    owner: "Marina Alves",
    due: "2026-07-16",
    status: "OPEN" as const,
  },
  {
    code: "MIT-26",
    uc: "UC-109",
    cat: "REGULATORY" as const,
    action: "Parecer de conselho clínico antes de qualquer piloto",
    owner: "Dra. Helena Braz",
    due: "2026-08-05",
    status: "OPEN" as const,
  },
  {
    code: "MIT-25",
    uc: "UC-112",
    cat: "IP" as const,
    action: "Cláusula de não-treinamento em conteúdo de marca",
    owner: "Lia Costa",
    due: "2026-08-19",
    status: "PROGRESS" as const,
  },
];

// ── Trilhas de onboarding ─────────────────────────────────────────────────────
// Aceites são linhas reais, não contadores: `done`/`overdue`/cobertura são
// agregados na leitura. Um contador persistido entraria em drift no primeiro
// aceite registrado pela UI.

const TRACKS = [
  {
    code: "TR-01",
    name: "Fundamentos de uso de IA",
    audience: "Todos os colaboradores",
    modules: 4,
    minutes: 22,
    recert: "ANNUAL" as const,
    version: "v3.2",
    assigned: 1240,
    done: 1064,
    overdue: 61,
  },
  {
    code: "TR-02",
    name: "Dado de paciente e IA",
    audience: TRACK_AUDIENCES[1], // "Operações · Atendimento"
    modules: 5,
    minutes: 35,
    recert: "SEMIANNUAL" as const,
    version: "v3.2",
    assigned: 318,
    done: 241,
    overdue: 34,
  },
  {
    code: "TR-03",
    name: "IA em engenharia",
    audience: "Engenharia",
    modules: 3,
    minutes: 18,
    recert: "ANNUAL" as const,
    version: "v3.1",
    assigned: 214,
    done: 197,
    overdue: 5,
  },
  {
    code: "TR-04",
    name: "IA voltada ao cliente",
    audience: "CX · Marketing",
    modules: 4,
    minutes: 26,
    recert: "SEMIANNUAL" as const,
    version: "v3.2",
    assigned: 96,
    done: 52,
    overdue: 12,
  },
  {
    code: "TR-05",
    name: "Governança para gestores",
    audience: "Gestores · Diretoria",
    modules: 3,
    minutes: 20,
    recert: "ANNUAL" as const,
    version: "v3.2",
    assigned: 78,
    done: 44,
    overdue: 9,
  },
];

// Pendentes nomeados do protótipo — aparecem no topo da lista de aceites
// pendentes, ordenados por atraso.
const NAMED_PENDING = [
  {
    name: "Dr. Ivo Mattos",
    dept: DEPT,
    track: "TR-02",
    assignedDaysAgo: 34,
  },
  {
    name: "Paula Serra",
    dept: "Financeiro",
    track: "TR-01",
    assignedDaysAgo: 27,
  },
  { name: "Tiago Muniz", dept: "Growth", track: "TR-04", assignedDaysAgo: 25 },
  {
    name: "Bruno Sato",
    dept: "Engenharia",
    track: "TR-03",
    assignedDaysAgo: 23,
  },
  { name: "Lia Costa", dept: "Marketing", track: "TR-04", assignedDaysAgo: 20 },
  { name: "Helena Braz", dept: DEPT, track: "TR-05", assignedDaysAgo: 19 },
];

const FIRST_NAMES = [
  "Ana",
  "Bruno",
  "Carla",
  "Diego",
  "Elisa",
  "Felipe",
  "Gabriela",
  "Henrique",
  "Isabel",
  "João",
  "Karina",
  "Lucas",
  "Mariana",
  "Nelson",
  "Olívia",
  "Paulo",
  "Renata",
  "Sérgio",
  "Tatiana",
  "Vitor",
];
const LAST_NAMES = [
  "Almeida",
  "Barbosa",
  "Cardoso",
  "Duarte",
  "Esteves",
  "Faria",
  "Gomes",
  "Henriques",
  "Ferreira",
  "Lopes",
  "Moreira",
  "Nunes",
  "Oliveira",
  "Pinto",
  "Queiroz",
  "Ramos",
  "Silva",
  "Teixeira",
  "Vieira",
  "Xavier",
];
const DEPARTMENTS = INTAKE_DEPARTMENTS;

/** Nome sintético determinístico — o seed precisa ser reproduzível. */
function syntheticPerson(i: number) {
  return {
    name: `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[(i * 7) % LAST_NAMES.length]}`,
    department: DEPARTMENTS[(i * 3) % DEPARTMENTS.length],
  };
}

// ── Auditoria retroativa ──────────────────────────────────────────────────────

const AUDIT: {
  entity: string;
  action: string;
  target: string;
  when: string;
  note: string;
  role: string;
  actor: string;
  diff: [string, string, string][] | null;
}[] = [
  {
    entity: "charter.decision",
    action: "Aprovou com restrições",
    target: "UC-115 · Resumo de prontuário",
    when: "2026-06-24",
    note: "Três condições anexadas; válidas até a próxima revisão de política.",
    role: "COMPLIANCE",
    actor: "Marina Alves",
    diff: [
      ["Status", "REVIEW", "RESTRICTED"],
      ["Restrições", "—", "3 condições"],
    ],
  },
  {
    entity: "charter.section",
    action: "Editou seção",
    target: "S04 · Usos restritos",
    when: "2026-07-02",
    note: "Adicionado requisito de retenção zero para Confidencial.",
    role: "SECURITY",
    actor: "Diego Prado",
    diff: [
      ["Status", "PUBLISHED", "REVIEW"],
      ["Palavras", "548", "610"],
    ],
  },
  {
    entity: "charter.vendor",
    action: "Marcou como RESTRICTED",
    target: "V-02 · Kairos Decision Cloud",
    when: "2026-07-05",
    note: "Explicabilidade insuficiente para decisão com efeito sobre pessoa física.",
    role: "SECURITY",
    actor: "Diego Prado",
    diff: [
      ["Tier", "APPROVED", "RESTRICTED"],
      ["Classe máxima", "CONFIDENTIAL", "INTERNAL"],
    ],
  },
  {
    entity: "charter.risk",
    action: "Reavaliou risco",
    target: "UC-118 · Triagem de sinistros",
    when: "2026-07-08",
    note: "Viés elevado de 3 para 4 após teste de paridade.",
    role: "REQUESTER",
    actor: "Rafael Lima",
    diff: [
      ["Viés", "3", "4"],
      ["Severidade geral", "4", "5"],
    ],
  },
  {
    entity: "charter.decision",
    action: "Bloqueou caso",
    target: "UC-113 · Score de inadimplência",
    when: "2026-06-14",
    note: "Sem explicabilidade auditável para decisão financeira.",
    role: "COMPLIANCE",
    actor: "Marina Alves",
    diff: [["Status", "REVIEW", "BLOCKED"]],
  },
  {
    entity: "charter.track",
    action: "Publicou trilha",
    target: "TR-02 · Dado de paciente e IA",
    when: "2026-06-20",
    note: "Vinculada à política v3.2; 318 pessoas atribuídas.",
    role: "HR",
    actor: "Ana Beatriz",
    diff: [
      ["Versão", "v3.1", "v3.2"],
      ["Atribuídos", "296", "318"],
    ],
  },
  {
    entity: "charter.export",
    action: "Exportou pacote",
    target: "Evidência Q2 2026",
    when: "2026-06-30",
    note: "Período 01 abr – 30 jun; 4 categorias de artefato.",
    role: "COMPLIANCE",
    actor: "Marina Alves",
    diff: null,
  },
  {
    entity: "charter.policy",
    action: "Publicou versão",
    target: "Política de Uso de IA · v3.2",
    when: "2026-06-18",
    note: "Classificação de dados reescrita; PHI movido para Restrito.",
    role: "COMPLIANCE",
    actor: "Marina Alves",
    // Sem "Seções alteradas": o que mudou sai do snapshot na exportação
    // (`exportEvidence`), não de uma contagem gravada no evento.
    diff: [["Versão", "v3.1", "v3.2"]],
  },
];

// ── Execução ──────────────────────────────────────────────────────────────────

async function wipe(tx: Tx, tenantId: string) {
  // Ordem inversa de dependência. AuditLog é append-only por trigger de banco,
  // então entradas do Charter não são apagadas — reexecutar o seed acumula
  // trilha, que é exatamente o comportamento correto de uma tabela imutável.
  await tx.charterAcknowledgment.deleteMany({ where: { tenantId } });
  await tx.charterTrack.deleteMany({ where: { tenantId } });
  await tx.charterMitigation.deleteMany({ where: { tenantId } });
  await tx.charterDecision.deleteMany({ where: { tenantId } });
  await tx.charterUseCase.deleteMany({ where: { tenantId } });
  await tx.charterVendorClause.deleteMany({ where: { tenantId } });
  await tx.charterVendor.deleteMany({ where: { tenantId } });
  await tx.charterClause.deleteMany({ where: { tenantId } });
  await tx.charterPolicyVersion.deleteMany({ where: { tenantId } });
  await tx.charterPolicySection.deleteMany({ where: { tenantId } });
  await tx.charterPolicy.deleteMany({ where: { tenantId } });
  await tx.charterSequence.deleteMany({ where: { tenantId } });
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

  console.log(`\n🛡  Seed Charter → ${tenant.name} (${tenant.slug})\n`);

  // Usuários e módulo ficam fora da transação com contexto de tenant: User não
  // é tenant-scoped, e TenantModule precisa existir antes de qualquer coisa.
  await db.tenantModule.upsert({
    where: { tenantId_module: { tenantId, module: "CHARTER" } },
    create: {
      tenantId,
      module: "CHARTER",
      status: "ACTIVE",
      contractedAt: d("2026-01-15"),
    },
    update: { status: "ACTIVE" },
  });
  console.log("  ✓ módulo CHARTER contratado");

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
    personaIds[p.charterRole] = user.id;

    await db.tenantMember.upsert({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      create: { tenantId, userId: user.id, role: "MEMBER" },
      update: {},
    });
    await db.charterMembership.upsert({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      create: { tenantId, userId: user.id, role: p.charterRole },
      update: { role: p.charterRole },
    });

    // Credencial de desenvolvimento. Hash pelo mesmo contexto do better-auth
    // que a app usa, senão o login falha silenciosamente na comparação.
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
  console.log(
    `  ✓ ${PERSONAS.length} personas de governança (senha: ${PERSONA_PASSWORD})`
  );

  // O admin existente do tenant vira COMPLIANCE, senão quem já tem login não
  // consegue abrir o Charter (ADR-0002: ADMIN não herda permissão).
  const admin = await db.tenantMember.findFirst({
    where: { tenantId, role: "ADMIN" },
    select: { userId: true },
  });
  if (admin) {
    await db.charterMembership.upsert({
      where: { tenantId_userId: { tenantId, userId: admin.userId } },
      create: { tenantId, userId: admin.userId, role: "COMPLIANCE" },
      update: { role: "COMPLIANCE" },
    });
    console.log("  ✓ admin do tenant recebeu papel COMPLIANCE");
  }

  await db.charterSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      industry: "Healthtech · Pagamentos",
      geo: "BR · UE",
      posture: "CONSERVATIVE",
      employees: 1240,
      logRetentionDays: 365,
    },
    update: {},
  });

  const complianceId = personaIds.COMPLIANCE;
  const securityId = personaIds.SECURITY;
  const hrId = personaIds.HR;
  const requesterId = personaIds.REQUESTER;

  await db.$transaction(
    async (tx) => {
      // RLS está FORCE em todas as tabelas do Charter — sem o contexto de
      // tenant, todo INSERT é recusado pela policy, inclusive para o dono da
      // tabela. Mesmo mecanismo de withTenantDb().
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;

      await wipe(tx as Tx, tenantId);

      // ── Política ──
      const policy = await tx.charterPolicy.create({
        data: {
          tenantId,
          name: "Política de Uso de IA",
          version: "v3.2",
          publishedAt: d("2026-06-18"),
          approverId: complianceId,
          nextReview: d("2026-12-18"),
          scope:
            "Todos os colaboradores, contratados e fornecedores com acesso a sistemas da Vanta Saúde.",
        },
      });

      await tx.charterPolicySection.createMany({
        data: SECTIONS.map((s) => ({
          tenantId,
          policyId: policy.id,
          ordinal: s.ordinal,
          name: s.name,
          status: s.status,
          body: s.body,
          ownerId: s.status === "REVIEW" ? securityId : complianceId,
          updatedAt: d(s.updated),
        })),
      });

      const versionIds: Record<string, string> = {};
      for (const v of VERSIONS) {
        const created = await tx.charterPolicyVersion.create({
          data: {
            tenantId,
            policyId: policy.id,
            version: v.version,
            status: v.status,
            summary: v.summary,
            publishedById: complianceId,
            publishedAt: d(v.when),
            changeCount: v.changes,
            // Snapshot real das seções: o diff de auditoria não pode depender do
            // estado atual, que continua mudando depois da publicação.
            snapshot: SECTIONS.map((s) => ({
              ordinal: s.ordinal,
              name: s.name,
              body: s.body,
              status: s.status,
            })) as Prisma.InputJsonValue,
          },
        });
        versionIds[v.version] = created.id;
      }
      console.log(
        `  ✓ política v3.2 · ${SECTIONS.length} seções (${SECTIONS.filter((s) => s.status !== "PUBLISHED").length} fora de publicação) · ${VERSIONS.length} versões`
      );

      // ── Cláusulas ──
      const clauseIds: Record<string, string> = {};
      for (const c of CLAUSES) {
        const created = await tx.charterClause.create({
          data: { tenantId, code: c.code, name: c.name, critical: c.critical },
        });
        clauseIds[c.code] = created.id;
      }

      // ── Fornecedores ──
      const vendorIds: Record<string, string> = {};
      const derived: string[] = [];
      for (const v of VENDORS) {
        // Fonte da verdade do teto é a derivação, não o protótipo (ADR-0003).
        const { maxClass } = deriveVendorMaxClass({
          tier: v.tier,
          dpa: v.dpa,
          clauseCodes: v.clauses,
        });
        const created = await tx.charterVendor.create({
          data: {
            tenantId,
            code: v.code,
            name: v.name,
            category: v.category,
            tier: v.tier,
            region: v.region,
            dpa: v.dpa,
            retention: v.retention,
            subprocessors: v.subprocessors,
            renewalAt: v.renewal ? d(v.renewal) : null,
            score: v.score,
            maxClass,
            notes: v.notes,
          },
        });
        vendorIds[v.code] = created.id;
        derived.push(`${v.code}→${maxClass ?? "nenhuma"}`);

        if (v.clauses.length > 0) {
          await tx.charterVendorClause.createMany({
            data: v.clauses.map((code) => ({
              tenantId,
              vendorId: created.id,
              clauseId: clauseIds[code],
            })),
          });
        }
      }
      console.log(
        `  ✓ ${CLAUSES.length} cláusulas · ${VENDORS.length} fornecedores`
      );
      console.log(`    teto derivado: ${derived.join("  ")}`);

      // ── Casos de uso ──
      const caseIds: Record<string, string> = {};
      const ineligible: string[] = [];
      // Só duas personas do dataset são usuários da plataforma; o resto tem
      // apenas `ownerName` livre.
      const USER_BY_NAME: Record<string, string> = {
        "Rafael Lima": requesterId,
        "Marina Alves": complianceId,
        "Diego Prado": securityId,
      };
      const userFor = (name: string | null) =>
        (name && USER_BY_NAME[name]) ?? null;

      for (const c of CASES) {
        // Reavaliação de elegibilidade — o mesmo efeito que setVendorTier
        // dispara (DATA-MODEL §6). O tier de V-02 foi rebaixado em 05/07 (está
        // na trilha de auditoria), e o teto de V-06 nunca cobriu Confidencial:
        // os casos vinculados ficam sinalizados, não bloqueados em silêncio.
        const vendorSeed = VENDORS.find((v) => v.code === c.vendor);
        const gate = vendorEligibility(
          {
            maxClass: deriveVendorMaxClass({
              tier: vendorSeed?.tier ?? "REVIEW",
              dpa: vendorSeed?.dpa ?? false,
              clauseCodes: vendorSeed?.clauses ?? [],
            }).maxClass,
            notes: vendorSeed?.notes ?? null,
          },
          c.dataClass
        );
        if (!gate.eligible) {
          ineligible.push(c.code);
        }

        const created = await tx.charterUseCase.create({
          data: {
            tenantId,
            vendorIneligible: !gate.eligible,
            code: c.code,
            title: c.title,
            department: c.dept,
            ownerName: c.owner,
            ownerId: userFor(c.owner),
            objective: c.objective,
            vendorId: vendorIds[c.vendor],
            dataClass: c.dataClass,
            exposure: c.exposure,
            criticality: c.criticality,
            status: c.status,
            approvalPath: c.approvalPath,
            slaTotal: c.slaTotal,
            hitl: c.hitl,
            submittedAt: c.submitted ? d(c.submitted) : null,
            reviewerId: userFor(c.reviewer),
            riskPrivacy: c.risks[0],
            riskRegulatory: c.risks[1],
            riskSecurity: c.risks[2],
            riskBias: c.risks[3],
            riskIp: c.risks[4],
            riskOperational: c.risks[5],
            riskReputational: c.risks[6],
            restrictions: c.restrictions ?? [],
            blockReason: c.blockReason ?? null,
            changeRequest: c.changeRequest ?? null,
          },
        });
        caseIds[c.code] = created.id;

        // Decisão correspondente ao status terminal, com justificativa — sem
        // ela a trilha mostraria um caso decidido sem quem decidiu nem por quê.
        const terminal: Record<
          string,
          "APPROVED" | "RESTRICTED" | "CHANGES" | "BLOCKED"
        > = {
          APPROVED: "APPROVED",
          RESTRICTED: "RESTRICTED",
          CHANGES: "CHANGES",
          BLOCKED: "BLOCKED",
        };
        const outcome = terminal[c.status];
        if (outcome) {
          const isCompliance = c.reviewer === "Marina Alves";
          await tx.charterDecision.create({
            data: {
              tenantId,
              useCaseId: created.id,
              outcome,
              rationale:
                c.blockReason ??
                c.changeRequest ??
                (c.restrictions?.length
                  ? "Aprovado com condições explícitas de operação; risco residual aceito sob monitoramento."
                  : "Escopo compatível com a política vigente; risco residual dentro do apetite definido."),
              conditions: c.restrictions ?? [],
              deciderId: isCompliance ? complianceId : securityId,
              deciderRole: isCompliance ? "COMPLIANCE" : "SECURITY",
              previousStatus: "REVIEW",
              createdAt: c.submitted ? d(c.submitted) : NOW,
            },
          });
        }
      }
      const scores = CASES.map((c) =>
        riskScore({
          privacy: c.risks[0],
          regulatory: c.risks[1],
          security: c.risks[2],
          bias: c.risks[3],
          ip: c.risks[4],
          operational: c.risks[5],
          reputational: c.risks[6],
        })
      );
      console.log(
        `  ✓ ${CASES.length} casos · ${scores.filter((s) => s.label === "Crítico").length} críticos, ${scores.filter((s) => s.label === "Elevado").length} elevados`
      );
      console.log(
        `    fornecedor inelegível (sinalizado p/ revisão): ${ineligible.join(", ") || "nenhum"}`
      );

      // ── Mitigações ──
      await tx.charterMitigation.createMany({
        data: MITIGATIONS.map((m) => ({
          tenantId,
          code: m.code,
          useCaseId: caseIds[m.uc],
          category: m.cat,
          action: m.action,
          ownerName: m.owner,
          dueDate: d(m.due),
          status: m.status,
        })),
      });
      console.log(
        `  ✓ ${MITIGATIONS.length} mitigações (${MITIGATIONS.filter((m) => m.status !== "DONE" && d(m.due) < NOW).length} atrasada)`
      );

      // ── Onboarding ──
      let ackTotal = 0;
      for (const t of TRACKS) {
        const track = await tx.charterTrack.create({
          data: {
            tenantId,
            code: t.code,
            name: t.name,
            audience: t.audience,
            modules: t.modules,
            minutes: t.minutes,
            recert: t.recert,
            policyId: policy.id,
            policyVersionId: versionIds[t.version],
            // TR-03 está vinculada à v3.1 enquanto a publicada é v3.2 → precisa
            // de reatribuição. É a contraparte visível de FR-2.5.
            needsReassignment: t.version !== "v3.2",
            publishedAt: d("2026-06-20"),
          },
        });

        const named = NAMED_PENDING.filter((p) => p.track === t.code);
        const rows: Prisma.CharterAcknowledgmentCreateManyInput[] = [];

        for (const p of named) {
          rows.push({
            tenantId,
            trackId: track.id,
            personName: p.name,
            department: p.dept,
            status: "PENDING",
            assignedAt: daysAgo(p.assignedDaysAgo),
            dueAt: daysAgo(p.assignedDaysAgo - 14),
            policyVersionId: versionIds[t.version],
          });
        }

        for (let i = 0; i < t.assigned - named.length; i++) {
          const person = syntheticPerson(i + t.assigned);
          const isDone = i < t.done;
          const isOverdue = !isDone && i < t.done + t.overdue;
          rows.push({
            tenantId,
            trackId: track.id,
            personName: person.name,
            department: person.department,
            status: isDone ? "ACKNOWLEDGED" : "PENDING",
            assignedAt: daysAgo(38),
            dueAt: isOverdue ? daysAgo(4) : daysAhead(10),
            acknowledgedAt: isDone ? daysAgo(20 + (i % 15)) : null,
            policyVersionId: versionIds[t.version],
          });
        }

        await tx.charterAcknowledgment.createMany({ data: rows });
        ackTotal += rows.length;
      }
      const assigned = TRACKS.reduce((s, t) => s + t.assigned, 0);
      const done = TRACKS.reduce((s, t) => s + t.done, 0);
      console.log(
        `  ✓ ${TRACKS.length} trilhas · ${ackTotal} aceites · cobertura ${Math.round((done / assigned) * 100)}%`
      );

      // ── Sequências ──
      // Apontam para o próximo código livre, senão a primeira submissão pela UI
      // colidiria com um código semeado.
      await tx.charterSequence.createMany({
        data: [
          { tenantId, kind: "usecase", next: 119 },
          { tenantId, kind: "mitigation", next: 32 },
          { tenantId, kind: "vendor", next: 8 },
          { tenantId, kind: "clause", next: 9 },
          { tenantId, kind: "track", next: 6 },
        ],
      });

      // ── Auditoria retroativa ──
      const actorId: Record<string, string> = {
        COMPLIANCE: complianceId,
        SECURITY: securityId,
        HR: hrId,
        REQUESTER: requesterId,
      };
      for (const a of AUDIT) {
        await tx.auditLog.create({
          data: {
            tenantId,
            userId: actorId[a.role],
            actorId: actorId[a.role],
            actorType: "user",
            action: a.action,
            entityType: a.entity,
            entityId: policy.id,
            createdAt: d(a.when),
            diff: (a.diff ?? null) as Prisma.InputJsonValue,
            metadata: {
              target: a.target,
              note: a.note,
              charterRole: a.role,
              actorName: a.actor,
            } as Prisma.InputJsonValue,
          },
        });
      }
      // AuditLog é append-only por trigger de banco: wipe() não a toca, então
      // reexecutar o seed acumula. É o comportamento correto de uma tabela
      // imutável — mas confunde numa demo, então o total vai explícito.
      const auditTotal = await tx.auditLog.count({
        where: { tenantId, entityType: { startsWith: "charter." } },
      });
      console.log(
        `  ✓ ${AUDIT.length} entradas de auditoria retroativas` +
          (auditTotal > AUDIT.length
            ? `  (total acumulado na trilha: ${auditTotal} — append-only, seeds anteriores permanecem)`
            : "")
      );
    },
    { timeout: 180_000, maxWait: 30_000 }
  );

  console.log(`
  Logins de governança (senha: definir via reset-pw):`);
  for (const p of PERSONAS) {
    console.log(`    ${p.charterRole.padEnd(11)} ${p.email}  — ${p.title}`);
  }
  console.log(`
  Abrir: /charter
`);

  await db.$disconnect();
  await pool.end();
}

/** Guarda de entrypoint: main() apaga e recria o domínio Charter do tenant.
 *  Sem ela, qualquer import deste módulo dispararia o seed destrutivo. */
const isEntrypoint =
  !!process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (isEntrypoint) {
  main().catch((err) => {
    console.error("❌ seed-charter falhou:", err);
    process.exit(1);
  });
}
