// Dado da tela Fornecedores e DPA e da tela Consentimento — evidência de
// docs/compliance/dpa-fornecedores.md (5 set 2026) e
// docs/compliance/aviso-de-gravacao.md §4. Consumido por
// apps/app/scripts/seed-empresa-nebuloz.ts.
//
// Só dados e tipos: sem import de valor de "@repo/database" (server-only).
//
// ── Proveniência ──────────────────────────────────────────────────────────
// codigo / nome        → §1 colunas Código / Fornecedor.
// estado               → §1 coluna DPA: "embutido" → EMBUTIDO, "a assinar" →
//                        A_ASSINAR, "não encontrado" → SEM_DOCUMENTO.
// classificacaoProvisoria → asterisco em §1 (só V-07).
// regiao / retencao / transferencia → §1, literal; "não declarada", "não
//                        confirmada", "não confirmado" e "não encontrado"
//                        (e variantes como "não confirmada p/ API") viram
//                        null (a tela mostra o traço).
// subprocessadoresUrl  → link da coluna Subprocessadores de §1; null em V-17.
// dpaUrl               → primeiro link de DPA/termos do bloco do fornecedor
//                        em §2; null onde §2 diz "nenhum DPA público"
//                        (V-13, V-14, V-15, V-17).
// acaoPendente / donoPapel / bloqueiaVenda → §3; fornecedores fora de §3 têm
//                        acaoPendente null, donoPapel null e bloqueiaVenda
//                        false (Anthropic, Neon, Vercel, Liveblocks, Resend).
// verificadoEm         → 2026-09-05 para todos.

export const VERIFICADO_EM = "2026-09-05";

export type FornecedorDpaSeed = {
  codigo: string;
  nome: string;
  estado: "EMBUTIDO" | "A_ASSINAR" | "SEM_DOCUMENTO";
  classificacaoProvisoria?: boolean;
  regiao: string | null;
  retencao: string | null;
  transferencia: string | null;
  dpaUrl: string | null;
  subprocessadoresUrl: string | null;
  acaoPendente: string | null;
  donoPapel: string | null;
  bloqueiaVenda: boolean;
};

export const FORNECEDORES_DPA: FornecedorDpaSeed[] = [
  {
    codigo: "V-01",
    nome: "Anthropic",
    estado: "EMBUTIDO",
    regiao: null,
    retencao: null,
    transferencia: "SCCs",
    dpaUrl: "https://www.anthropic.com/legal/commercial-terms",
    subprocessadoresUrl: "https://trust.anthropic.com/subprocessors",
    acaoPendente: null,
    donoPapel: null,
    bloqueiaVenda: false,
  },
  {
    codigo: "V-02",
    nome: "OpenAI",
    estado: "EMBUTIDO",
    regiao: null,
    retencao: "ZDR sob aprovação",
    transferencia: null,
    dpaUrl: "https://openai.com/policies/data-processing-addendum/",
    subprocessadoresUrl: "https://openai.com/policies/sub-processor-list/",
    acaoPendente: "Decidir se é rota ativa; se for, pedir ZDR",
    donoPapel: "Responsável pela entrega",
    bloqueiaVenda: false,
  },
  {
    codigo: "V-03",
    nome: "Google (Gemini API)",
    estado: "EMBUTIDO",
    regiao: null,
    retencao: "ZDR documentado",
    transferencia: null,
    dpaUrl: "https://ai.google.dev/gemini-api/terms",
    subprocessadoresUrl: "https://cloud.google.com/terms/subprocessors",
    acaoPendente: "Confirmar que a chave é de plano pago",
    donoPapel: "Responsável pela entrega",
    bloqueiaVenda: true,
  },
  {
    codigo: "V-04",
    nome: "Langfuse (ClickHouse)",
    estado: "A_ASSINAR",
    regiao: "US, EU, JP, HIPAA",
    retencao: null,
    transferencia: "SCCs + DPF",
    dpaUrl: "https://clickhouse.com/legal/agreements/data-processing-addendum",
    subprocessadoresUrl:
      "https://clickhouse.com/legal/agreements/langfuse-subprocessors",
    acaoPendente: "assinar (definir entidade contratante)",
    donoPapel: "Auditor / revisor",
    bloqueiaVenda: false,
  },
  {
    codigo: "V-05",
    nome: "Neon (Databricks)",
    estado: "EMBUTIDO",
    regiao: "região do cliente",
    retencao: null,
    transferencia: null,
    dpaUrl: "https://neon.com/platform-terms",
    subprocessadoresUrl:
      "https://www.databricks.com/legal/databricks-subprocessors",
    acaoPendente: null,
    donoPapel: null,
    bloqueiaVenda: false,
  },
  {
    codigo: "V-06",
    nome: "Vercel",
    estado: "EMBUTIDO",
    regiao: "AWS/Azure/GCP",
    retencao: null,
    transferencia: "SCCs + UK IDTA",
    dpaUrl: "https://vercel.com/legal/dpa",
    subprocessadoresUrl: "https://security.vercel.com/",
    acaoPendente: null,
    donoPapel: null,
    bloqueiaVenda: false,
  },
  {
    codigo: "V-07",
    nome: "Upstash",
    estado: "A_ASSINAR",
    classificacaoProvisoria: true,
    regiao: null,
    retencao: null,
    transferencia: null,
    dpaUrl: "https://upstash.com/trust/dpa.pdf",
    subprocessadoresUrl: "https://upstash.com/trust/subprocessors.pdf",
    acaoPendente: "ler o PDF do DPA; assinar se não for automático",
    donoPapel: "Auditor / revisor",
    bloqueiaVenda: false,
  },
  {
    codigo: "V-08",
    nome: "Sentry",
    estado: "A_ASSINAR",
    regiao: "US ou EU",
    retencao: null,
    transferencia: "SCCs + DPF",
    dpaUrl: "https://sentry.io/legal/dpa/",
    subprocessadoresUrl: "https://sentry.io/legal/subprocessors/",
    acaoPendente: "aceitar o DPA no portal",
    donoPapel: "Dono do SLA",
    bloqueiaVenda: false,
  },
  {
    codigo: "V-09",
    nome: "Liveblocks",
    estado: "EMBUTIDO",
    regiao: null,
    retencao: null,
    transferencia: "SCCs + UK",
    dpaUrl: "https://liveblocks.io/dpa",
    subprocessadoresUrl: "https://liveblocks.io/subprocessors",
    acaoPendente: null,
    donoPapel: null,
    bloqueiaVenda: false,
  },
  {
    codigo: "V-10",
    nome: "Resend",
    estado: "EMBUTIDO",
    regiao: "EUA",
    retencao: null,
    transferencia: "SCCs + UK",
    dpaUrl: "https://resend.com/legal/dpa",
    subprocessadoresUrl: "https://resend.com/legal/subprocessors",
    acaoPendente: null,
    donoPapel: null,
    bloqueiaVenda: false,
  },
  {
    codigo: "V-11",
    nome: "Fireflies",
    estado: "A_ASSINAR",
    regiao: null,
    retencao: "0 dias com fornecedores",
    transferencia: null,
    dpaUrl: "https://fireflies.ai/dpa",
    subprocessadoresUrl: "https://trust.fireflies.ai/subprocessors",
    acaoPendente: "assinar, depois de resolver consentimento",
    donoPapel: "Dono do roadmap",
    bloqueiaVenda: true,
  },
  {
    codigo: "V-12",
    nome: "PostHog",
    estado: "A_ASSINAR",
    regiao: "EUA ou Alemanha",
    retencao: null,
    transferencia: "SCCs + DPF",
    dpaUrl: "https://posthog.com/dpa",
    subprocessadoresUrl: "https://posthog.com/subprocessors",
    acaoPendente: "gerar e assinar (self-serve)",
    donoPapel: "Auditor / revisor",
    bloqueiaVenda: false,
  },
  {
    codigo: "V-13",
    nome: "Arcjet",
    estado: "SEM_DOCUMENTO",
    regiao: "multi-região",
    retencao: "30 dias",
    transferencia: null,
    dpaUrl: null,
    subprocessadoresUrl: "https://trust.arcjet.com/subprocessors",
    acaoPendente: "pedir DPA",
    donoPapel: "Auditor / revisor",
    bloqueiaVenda: false,
  },
  {
    codigo: "V-14",
    nome: "Inngest",
    estado: "SEM_DOCUMENTO",
    regiao: null,
    retencao: null,
    transferencia: null,
    dpaUrl: null,
    subprocessadoresUrl: "https://trust.inngest.com/subprocessors",
    acaoPendente: "pedir DPA (orquestra o V-11)",
    donoPapel: "Dono do SLA",
    bloqueiaVenda: true,
  },
  {
    codigo: "V-15",
    nome: "Svix",
    estado: "SEM_DOCUMENTO",
    regiao: "região do cliente",
    retencao: null,
    transferencia: null,
    dpaUrl: null,
    subprocessadoresUrl: "https://www.svix.com/legal/subprocessors/",
    acaoPendente: "confirmar uso; pedir DPA se ativo",
    donoPapel: "Responsável pela entrega",
    bloqueiaVenda: false,
  },
  {
    codigo: "V-16",
    nome: "Knock",
    estado: "A_ASSINAR",
    regiao: null,
    retencao: "sem prazo",
    transferencia: "SCCs + UK IDTA",
    dpaUrl: "https://knock.app/legal/data-processing-addendum",
    subprocessadoresUrl: "https://knock.app/legal/subprocessors",
    acaoPendente: "confirmar uso; remover do inventário se não",
    donoPapel: "Responsável pela entrega",
    bloqueiaVenda: false,
  },
  {
    codigo: "V-17",
    nome: "BaseHub",
    estado: "SEM_DOCUMENTO",
    regiao: null,
    retencao: null,
    transferencia: null,
    dpaUrl: null,
    subprocessadoresUrl: null,
    acaoPendente: "pedir DPA",
    donoPapel: "Auditor / revisor",
    bloqueiaVenda: false,
  },
  {
    codigo: "V-18",
    nome: "Stripe",
    estado: "EMBUTIDO",
    regiao: "global, EUA",
    retencao: null,
    transferencia: "SCCs + DPF",
    dpaUrl: "https://stripe.com/en-br/legal/dpa",
    subprocessadoresUrl: "https://stripe.com/br/legal/service-providers",
    acaoPendente: "confirmar se está ativo",
    donoPapel: "Dono do roadmap",
    bloqueiaVenda: false,
  },
];

export type PerguntaSeed = {
  numero: number;
  pergunta: string;
  donoPapel: string;
};

export const PERGUNTAS_AO_PARECER: PerguntaSeed[] = [
  {
    numero: 1,
    pergunta:
      "A base legal da finalidade 7 do RoPA é consentimento (art. 7º, I) ou legítimo interesse (art. 7º, IX)?",
    donoPapel: "responsável jurídico",
  },
  {
    numero: 2,
    pergunta:
      'Se consentimento: o aviso opt-out da §1 satisfaz o "inequívoca" do art. 5º, XII?',
    donoPapel: "responsável jurídico",
  },
  {
    numero: 3,
    pergunta:
      "Se consentimento: a cláusula da §2 satisfaz o art. 8º, § 1º e § 4º como está redigida?",
    donoPapel: "responsável jurídico",
  },
  {
    numero: 4,
    pergunta: "STANDING é habilitável?",
    donoPapel: "responsável jurídico",
  },
  {
    numero: 5,
    pergunta:
      "Se legítimo interesse: quem redige o teste do art. 10 e o relatório de impacto, e até quando?",
    donoPapel: "Dono do SLA",
  },
  {
    numero: 6,
    pergunta: "Qual o prazo de retenção da finalidade 7?",
    donoPapel: "Dono do SLA",
  },
  {
    numero: 7,
    pergunta: "Consentimento colhido de empregado nesta forma é livre?",
    donoPapel: "responsável jurídico",
  },
];
