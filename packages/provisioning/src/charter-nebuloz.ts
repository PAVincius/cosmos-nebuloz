// Dado do Charter interno da Nebuloz — fornecedores e casos de uso reais,
// extraídos de `docs/runbooks/charter-nebuloz.md` (§5 fornecedores, §6 casos
// de uso). Consumido por `apps/app/scripts/seed-charter-nebuloz.ts`.
//
// Só dados e tipos aqui — sem import de valor de `@repo/database` nem de
// qualquer coisa que carregue "server-only": o script roda por `tsx`, e um
// import de valor de um módulo "server-only" derruba o processo antes da
// primeira linha (mesmo motivo documentado em seed-charter.ts e
// seed-meridian.ts). Os tipos de enum abaixo são `import type`, apagados na
// compilação — seguros mesmo vindo do índice de `@repo/database`.
//
// ── Proveniência campo a campo ──────────────────────────────────────────────
//
// Fornecedores (§5):
//   code / name / category → colunas "Código" / "Fornecedor" / "Categoria".
//   tier → token de enum dentro da coluna "Tier sugerido" (ex. "REVIEW até DPA
//     confirmado" → tier REVIEW). A condição que sobra ("até DPA confirmado",
//     "após DPA") não tem campo próprio no schema — foi anexada ao fim de
//     `notes` como frase própria, para não desaparecer.
//   notes → coluna "Observação para o campo notes"; branco quando o runbook
//     não escreveu nada ali (V-06, V-10, V-13).
//   V-12..V-18 (tabela "não processam dado de cliente") não têm coluna Tier:
//     `tier` fica ausente no objeto, e o upsert do script não escreve o campo
//     — o default do schema (`REVIEW`) vale na criação e nada é sobrescrito
//     numa reexecução.
//   dpa / retention / subprocessors / renewalAt / region / score não entram
//     aqui: o runbook é explícito — "Toda coluna contratual está como 'a
//     confirmar' de propósito" (§5, abertura). Ficam no default do schema
//     (`dpa=false`, `subprocessors=0`, `score=50`, os demais null) até alguém
//     confirmar o contrato na tela.
//
// Casos de uso (§6):
//   code / title → colunas "Código" / "Caso".
//   objective → não existe uma coluna de objetivo em prosa no runbook; para
//     não inventar, o campo é a concatenação do título com a coluna "Origem
//     no código" (citação literal do caminho), no formato
//     "<Caso>. Origem no código (runbook §6): `<caminho>`.".
//   dataClass / exposure / criticality / approvalPath / slaTotal / hitl →
//     colunas correspondentes da tabela principal de §6. approvalPath e
//     slaTotal são os valores já "congelados" que o runbook lista — o script
//     não roda `recommendPath()` de novo.
//   risk (7 eixos, impacto/probabilidade) → tabela "Perfil de risco" de §6,
//     todas as 9 linhas têm os dois números por eixo.
//   vendorCode → só quando o runbook nomeia o fornecedor em prosa, não como
//     coluna: UC-01 ("a dependência do V-01") e UC-07 (a entrada de V-11 cita
//     o mesmo arquivo do UC-07). Os outros sete casos não têm fornecedor
//     nomeado no runbook — campo ausente, não inventado.
//   department / ownerId / ownerName / status / restrictions / blockReason /
//     changeRequest não entram: §6 não atribui dono nem decide os casos (isso
//     é o item 8 do runbook, fora do escopo deste seed). Ficam no default do
//     schema (`status = DRAFT`, os demais null/vazio).

import type {
  CharterCriticality,
  CharterDataClass,
  CharterExposure,
  CharterHitl,
  CharterVendorTier,
} from "@repo/database";

export type NebulozVendorSeed = {
  code: string;
  name: string;
  category: string;
  /** Ausente para V-12..V-18: o runbook não sugere tier para quem não
   *  processa dado de cliente. O schema aplica o default (`REVIEW`). */
  tier?: CharterVendorTier;
  notes?: string;
};

export const NEBULOZ_VENDORS: NebulozVendorSeed[] = [
  // ── Processam dado de cliente (§5, primeira tabela) ──
  {
    code: "V-01",
    name: "Anthropic",
    category: "Modelo de linguagem",
    tier: "REVIEW",
    notes:
      "Provedor padrão do roteador (packages/ai/lib/router.ts). Confirmar zero-retention e região. Tier sugerido REVIEW até DPA confirmado.",
  },
  {
    code: "V-02",
    name: "OpenAI",
    category: "Modelo de linguagem",
    tier: "REVIEW",
    notes:
      "Usado em packages/ai/lib/models.ts (gpt-4o-mini). Confirmar se ainda é caminho ativo ou herança do template.",
  },
  {
    code: "V-03",
    name: "Google",
    category: "Modelo de linguagem",
    tier: "REVIEW",
    notes: "Terceira rota do roteador (gemini-2.0-flash).",
  },
  {
    code: "V-04",
    name: "Langfuse",
    category: "Observabilidade de LLM",
    tier: "RESTRICTED",
    notes:
      "Ponto sensível: LANGFUSE_CAPTURE_CONTENT liga o envio de prompt e resposta em claro. Ausente = mascarado. A restrição a registrar é: nunca ligar em ambiente com dado de cliente.",
  },
  {
    code: "V-05",
    name: "Neon / PostgreSQL",
    category: "Banco de dados",
    tier: "APPROVED",
    notes:
      "Guarda tudo. Anotar ADR-0012 aqui — o isolamento hoje é de aplicação. Tier sugerido APPROVED após DPA confirmado.",
  },
  {
    code: "V-06",
    name: "Vercel",
    category: "Hospedagem e execução",
    tier: "APPROVED",
    notes: "Tier sugerido APPROVED após DPA confirmado.",
  },
  {
    code: "V-07",
    name: "Upstash",
    category: "Cache e rate limit",
    tier: "APPROVED",
    notes:
      "Guarda lista de módulos por tenant (5 min). Tier sugerido APPROVED após DPA confirmado.",
  },
  {
    code: "V-08",
    name: "Sentry",
    category: "Observabilidade de erro",
    tier: "RESTRICTED",
    notes:
      "Stack trace carrega dado incidental. Confirmar política de scrubbing.",
  },
  {
    code: "V-09",
    name: "Liveblocks",
    category: "Colaboração em tempo real",
    tier: "REVIEW",
    notes: "Conteúdo de documento em trânsito.",
  },
  {
    code: "V-10",
    name: "Resend",
    category: "E-mail transacional",
    tier: "APPROVED",
    notes: "Tier sugerido APPROVED após DPA confirmado.",
  },
  {
    code: "V-11",
    name: "Fireflies",
    category: "Transcrição de reunião",
    tier: "REVIEW",
    notes:
      "Maior risco do inventário. Transcrição de reunião de cliente entra em LLM por lib/inngest/fireflies-insights.ts. Confirmar consentimento de gravação antes de aprovar.",
  },
  // ── Não processam dado de cliente, ou uso a confirmar (§5, segunda tabela) ──
  {
    code: "V-12",
    name: "PostHog",
    category: "Analytics de produto",
    notes: "Confirmar o que é enviado por evento.",
  },
  {
    code: "V-13",
    name: "Arcjet",
    category: "Segurança de borda",
  },
  {
    code: "V-14",
    name: "Inngest",
    category: "Execução de jobs",
    notes: "Orquestra V-11 — herda o risco dele.",
  },
  {
    code: "V-15",
    name: "Svix",
    category: "Webhooks",
    notes: "Confirmar se está em uso: três arquivos importam o pacote.",
  },
  {
    code: "V-16",
    name: "Knock",
    category: "Notificações",
    notes:
      "Um arquivo importa — provável herança do Next Forge. Confirmar antes de cadastrar.",
  },
  {
    code: "V-17",
    name: "BaseHub",
    category: "CMS do site",
    notes: "Quatro arquivos. O site já tirou /legal do CMS de propósito.",
  },
  {
    code: "V-18",
    name: "Stripe",
    category: "Pagamentos",
    notes: "Três arquivos. Confirmar se está ativo.",
  },
];

/** Um eixo de risco: impacto (`risk`) e probabilidade (`prob`), 1..5, exatos
 *  como a tabela "Perfil de risco" de §6 — formato "impacto/probabilidade". */
export type NebulozRiskAxis = { risk: number; prob: number };

export type NebulozRiskProfile = {
  privacy: NebulozRiskAxis;
  regulatory: NebulozRiskAxis;
  security: NebulozRiskAxis;
  bias: NebulozRiskAxis;
  ip: NebulozRiskAxis;
  operational: NebulozRiskAxis;
  reputational: NebulozRiskAxis;
};

export type NebulozUseCaseSeed = {
  code: string;
  title: string;
  objective: string;
  dataClass: CharterDataClass;
  exposure: CharterExposure;
  criticality: CharterCriticality;
  approvalPath: string;
  slaTotal: number;
  hitl: CharterHitl;
  risk: NebulozRiskProfile;
  /** Só quando o runbook nomeia o fornecedor em prosa (UC-01 → V-01,
   *  UC-07 → V-11). Ausente nos outros sete — não inventado. */
  vendorCode?: string;
};

const objectiveOf = (title: string, path: string): string =>
  `${title}. Origem no código (runbook §6): \`${path}\`.`;

export const NEBULOZ_USE_CASES: NebulozUseCaseSeed[] = [
  {
    code: "UC-01",
    title: "Geração de rascunho de política",
    objective: objectiveOf(
      "Geração de rascunho de política",
      "(charter)/actions/policy-generate.ts"
    ),
    dataClass: "CONFIDENTIAL",
    exposure: "EXTERNAL",
    criticality: "HIGH",
    approvalPath: "Legal + Segurança + Comitê de IA",
    slaTotal: 10,
    hitl: "FULL_REVIEW",
    vendorCode: "V-01",
    risk: {
      privacy: { risk: 3, prob: 3 },
      regulatory: { risk: 4, prob: 3 },
      security: { risk: 4, prob: 2 },
      bias: { risk: 2, prob: 2 },
      ip: { risk: 3, prob: 2 },
      operational: { risk: 3, prob: 3 },
      reputational: { risk: 4, prob: 3 },
    },
  },
  {
    code: "UC-02",
    title: "Copilot conversacional",
    objective: objectiveOf(
      "Copilot conversacional",
      "api/copilot/chat/route.ts"
    ),
    dataClass: "CONFIDENTIAL",
    exposure: "EXTERNAL",
    criticality: "HIGH",
    approvalPath: "Legal + Segurança + Comitê de IA",
    slaTotal: 10,
    hitl: "FULL_REVIEW",
    risk: {
      privacy: { risk: 3, prob: 3 },
      regulatory: { risk: 3, prob: 2 },
      security: { risk: 4, prob: 3 },
      bias: { risk: 3, prob: 3 },
      ip: { risk: 3, prob: 2 },
      operational: { risk: 3, prob: 3 },
      reputational: { risk: 4, prob: 3 },
    },
  },
  {
    code: "UC-03",
    title: "Análise INVEST de épico",
    objective: objectiveOf(
      "Análise INVEST de épico",
      "actions/epics/analyze-invest.ts"
    ),
    dataClass: "CONFIDENTIAL",
    exposure: "EXTERNAL",
    criticality: "MEDIUM",
    approvalPath: "Segurança + Legal",
    slaTotal: 5,
    hitl: "FULL_REVIEW",
    risk: {
      privacy: { risk: 2, prob: 2 },
      regulatory: { risk: 2, prob: 1 },
      security: { risk: 3, prob: 2 },
      bias: { risk: 3, prob: 3 },
      ip: { risk: 2, prob: 2 },
      operational: { risk: 3, prob: 3 },
      reputational: { risk: 3, prob: 2 },
    },
  },
  {
    code: "UC-04",
    title: "Rascunho de hipótese de épico",
    objective: objectiveOf(
      "Rascunho de hipótese de épico",
      "actions/epics/draft-hypothesis.ts"
    ),
    dataClass: "CONFIDENTIAL",
    exposure: "EXTERNAL",
    criticality: "MEDIUM",
    approvalPath: "Segurança + Legal",
    slaTotal: 5,
    hitl: "FULL_REVIEW",
    risk: {
      privacy: { risk: 2, prob: 2 },
      regulatory: { risk: 2, prob: 1 },
      security: { risk: 3, prob: 2 },
      bias: { risk: 3, prob: 3 },
      ip: { risk: 3, prob: 2 },
      operational: { risk: 2, prob: 3 },
      reputational: { risk: 3, prob: 2 },
    },
  },
  {
    code: "UC-05",
    title: "Rebalanceamento WSJF",
    objective: objectiveOf("Rebalanceamento WSJF", "actions/wsjf/rebalance.ts"),
    dataClass: "CONFIDENTIAL",
    exposure: "EXTERNAL",
    criticality: "MEDIUM",
    approvalPath: "Segurança + Legal",
    slaTotal: 5,
    hitl: "FULL_REVIEW",
    risk: {
      privacy: { risk: 2, prob: 2 },
      regulatory: { risk: 2, prob: 1 },
      security: { risk: 3, prob: 2 },
      bias: { risk: 4, prob: 3 },
      ip: { risk: 2, prob: 2 },
      operational: { risk: 4, prob: 3 },
      reputational: { risk: 3, prob: 2 },
    },
  },
  {
    code: "UC-06",
    title: "Narrativa de anomalia de custo",
    objective: objectiveOf(
      "Narrativa de anomalia de custo",
      "lib/cost/anomaly-narrative.ts"
    ),
    dataClass: "CONFIDENTIAL",
    exposure: "EXTERNAL",
    criticality: "MEDIUM",
    approvalPath: "Segurança + Legal",
    slaTotal: 5,
    hitl: "FULL_REVIEW",
    risk: {
      privacy: { risk: 2, prob: 2 },
      regulatory: { risk: 2, prob: 1 },
      security: { risk: 3, prob: 2 },
      bias: { risk: 2, prob: 2 },
      ip: { risk: 2, prob: 1 },
      operational: { risk: 3, prob: 3 },
      reputational: { risk: 3, prob: 2 },
    },
  },
  {
    code: "UC-07",
    title: "Insights de reunião",
    objective: objectiveOf(
      "Insights de reunião",
      "lib/inngest/fireflies-insights.ts"
    ),
    dataClass: "RESTRICTED",
    exposure: "EXTERNAL",
    criticality: "HIGH",
    approvalPath: "Legal + Segurança + Comitê de IA",
    slaTotal: 10,
    hitl: "FULL_REVIEW",
    vendorCode: "V-11",
    risk: {
      privacy: { risk: 5, prob: 4 },
      regulatory: { risk: 5, prob: 4 },
      security: { risk: 4, prob: 3 },
      bias: { risk: 3, prob: 2 },
      ip: { risk: 4, prob: 3 },
      operational: { risk: 3, prob: 3 },
      reputational: { risk: 5, prob: 3 },
    },
  },
  {
    code: "UC-08",
    title: "Geração de prompt",
    objective: objectiveOf(
      "Geração de prompt",
      "actions/ai-prompt/generate-prompt.ts"
    ),
    dataClass: "INTERNAL",
    exposure: "EXTERNAL",
    criticality: "LOW",
    approvalPath: "Segurança",
    slaTotal: 3,
    hitl: "SAMPLING",
    risk: {
      privacy: { risk: 1, prob: 1 },
      regulatory: { risk: 1, prob: 1 },
      security: { risk: 3, prob: 3 },
      bias: { risk: 2, prob: 2 },
      ip: { risk: 1, prob: 1 },
      operational: { risk: 2, prob: 2 },
      reputational: { risk: 2, prob: 2 },
    },
  },
  {
    code: "UC-09",
    title: "Desenvolvimento assistido por IA",
    objective: objectiveOf(
      "Desenvolvimento assistido por IA",
      "fora do produto"
    ),
    dataClass: "CONFIDENTIAL",
    exposure: "INTERNAL",
    criticality: "MEDIUM",
    approvalPath: "Segurança + Legal",
    slaTotal: 5,
    hitl: "FULL_REVIEW",
    risk: {
      privacy: { risk: 2, prob: 2 },
      regulatory: { risk: 2, prob: 2 },
      security: { risk: 4, prob: 3 },
      bias: { risk: 2, prob: 2 },
      ip: { risk: 5, prob: 3 },
      operational: { risk: 3, prob: 3 },
      reputational: { risk: 3, prob: 2 },
    },
  },
];
