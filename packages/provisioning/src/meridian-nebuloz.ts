// Meridian da própria Nebuloz.
//
// Dado real, não protótipo: as lacunas abaixo são as pendências do lançamento
// comercial que já estão escritas em documento — mapa de processo, RoPA de
// LGPD, índice mestre de fila, PRD do Scaffold, spec do Signal, ADR-0012 e o
// design de cadastro de 2FA. Cada lacuna carrega `fonte`, o caminho do
// documento de onde ela vem, e cita esse documento ao fim do `statement`.
// `fonte` não é coluna do Prisma — mora só aqui, e o teste em
// `apps/app/__tests__/meridian/nebuloz-dataset.test.ts` confirma que aponta
// para um arquivo que existe no repositório.
//
// Por que não há resposta à bateria: um assessment de verdade colheria
// respostas de pessoas da Nebuloz eixo a eixo. Isso não aconteceu — inventar
// respostas de LIKERT/SCALE para preencher `MeridianResponse` seria simular um
// diagnóstico que não ocorreu. As lacunas e o plano vêm direto do que já está
// escrito; o score por eixo é uma leitura declarada, não medida, derivada só
// da severidade das lacunas do próprio eixo — nunca de resposta inventada.
//
// ── Regra de score por eixo (declarada, não medida) ────────────────────────
//
//   penalidade(gap) = HIGH → 30 · MEDIUM → 15 · LOW → 5
//   score(eixo)      = 100 − média(penalidade(gap) para gap em NEBULOZ_GAPS
//                              com gap.axis === eixo)
//
// A média é aritmética simples sobre as lacunas do eixo — sem peso adicional
// por custo de atraso, para o número continuar auditável de cabeça. O
// resultado nasce com `status = COMPUTED`, `confidence = 0.30` (a mesma escala
// 0–1 que `MeridianAxisScore.confidence` já usa para score medido, aqui presa
// deliberadamente perto do piso) e uma `note` que diz, por extenso, que o
// número é regra sobre lacuna declarada, não resposta de bateria. `respondentCount
// = 0` e `spread = 0` pela mesma razão: não houve respondente, não há
// dispersão para medir.

export type NebulozAxis =
  | "DATA"
  | "PROCESS"
  | "PEOPLE"
  | "GOVERNANCE"
  | "INFRASTRUCTURE";

export type NebulozSeverity = "HIGH" | "MEDIUM" | "LOW";
export type NebulozEffort = "S" | "M" | "L";

export type NebulozGap = {
  /** "N-01" … — sequencial, independente do eixo. */
  code: string;
  axis: NebulozAxis;
  /** Uma frase, terminando com a citação curta do documento de origem. */
  statement: string;
  severity: NebulozSeverity;
  effort: NebulozEffort;
  /** 0–100. */
  costOfDelay: number;
  /** Sempre DECLARED aqui: nenhuma lacuna deste conjunto foi medida por
   *  bateria — todas vêm de documento já escrito. */
  confidence: "DECLARED";
  ownerLabel: string;
  /** Caminho do documento fonte, relativo à raiz do monorepo. Só existe neste
   *  módulo de dados — não é gravado em nenhuma coluna do Prisma. */
  fonte: string;
};

export type NebulozPlanItem = {
  gapCode: string;
  /** 1–4, mesmo domínio de `MeridianPlanItem.quarter`. */
  quarter: number;
  /** Rótulo calendário do trimestre — só documentação; não é coluna. */
  quarterLabel: string;
  seq: number;
  capacityNote: string;
};

export const NEBULOZ_ASSESSMENT_CODE = "AS-NEBULOZ-01";

export const NEBULOZ_ASSESSMENT = {
  code: NEBULOZ_ASSESSMENT_CODE,
  orgName: "Nebuloz — prontidão para o lançamento comercial",
  sector: "SaaS · Governança e prontidão para IA",
  sizeBand: "1–10",
  openedAt: "2026-09-04",
  deadline: "2026-10-16",
};

// ── Lacunas ─────────────────────────────────────────────────────────────────
//
// DATA (5) — dado, retenção e a espinha de dados pessoais do RoPA.
// PROCESS (10) — as 13 lacunas do mapa de processo comercial, menos as três
//   que são de governança financeira/de catálogo (movidas para GOVERNANCE).
// PEOPLE (2) — quem entrega e quem responde pelo SLA, ainda indefinidos.
// GOVERNANCE (8) — RACI, DPA, decisões jurídicas e financeiras do lançamento.
// INFRASTRUCTURE (4) — RLS inerte, segredo de 2FA vazado, storage e conectores.

export const NEBULOZ_GAPS: NebulozGap[] = [
  // DATA
  {
    code: "N-01",
    axis: "DATA",
    statement:
      "Job de expurgo de tenant em D+30 não existe: a policy promete deleção automática e nenhuma função roda esse trabalho (lgpd-ropa-e-lacunas §2.4).",
    severity: "HIGH",
    effort: "L",
    costOfDelay: 70,
    confidence: "DECLARED",
    ownerLabel: "Responsável pela entrega (RACI)",
    fonte: "docs/compliance/lgpd-ropa-e-lacunas.md",
  },
  {
    code: "N-02",
    axis: "DATA",
    statement:
      "Eliminação de titular não alcança CharterUseCase.ownerName, Proposal, StaffPerson e TeamMember — dado pessoal sobrevive ao pedido de apagamento (lgpd-ropa-e-lacunas §5).",
    severity: "MEDIUM",
    effort: "M",
    costOfDelay: 55,
    confidence: "DECLARED",
    ownerLabel: "Responsável pela entrega (RACI)",
    fonte: "docs/compliance/lgpd-ropa-e-lacunas.md",
  },
  {
    code: "N-03",
    axis: "DATA",
    statement:
      "Cinco finalidades do RoPA seguem sem prazo de retenção definido, incluindo diagnóstico e inteligência de reunião (lgpd-ropa-e-lacunas §3).",
    severity: "MEDIUM",
    effort: "S",
    costOfDelay: 45,
    confidence: "DECLARED",
    ownerLabel: "Encarregado de dados (a nomear)",
    fonte: "docs/compliance/lgpd-ropa-e-lacunas.md",
  },
  {
    code: "N-04",
    axis: "DATA",
    statement:
      "A lista de subprocessadores da policy não cita nenhum provedor de IA, apesar de dez pontos de chamada a LLM no código (lgpd-ropa-e-lacunas §2.1).",
    severity: "HIGH",
    effort: "S",
    costOfDelay: 78,
    confidence: "DECLARED",
    ownerLabel: "Encarregado de dados (a nomear)",
    fonte: "docs/compliance/lgpd-ropa-e-lacunas.md",
  },
  {
    code: "N-05",
    axis: "DATA",
    statement:
      "Baseline de iniciativa do Signal depende de captura manual por dimensão, sem automação de coleta (specs/003-signal-measure/spec.md §10, Q2).",
    severity: "LOW",
    effort: "M",
    costOfDelay: 30,
    confidence: "DECLARED",
    ownerLabel: "Dono do roadmap (RACI)",
    fonte: "specs/003-signal-measure/spec.md",
  },

  // PROCESS
  {
    code: "N-06",
    axis: "PROCESS",
    statement:
      "Sem captura automática de lead a partir do site, o funil de ICP começa com entrada manual (mapa-de-processo §9).",
    severity: "MEDIUM",
    effort: "S",
    costOfDelay: 40,
    confidence: "DECLARED",
    ownerLabel: "Responsável pela entrega (RACI, produto a definir)",
    fonte: "docs/comercial/mapa-de-processo.md",
  },
  {
    code: "N-07",
    axis: "PROCESS",
    statement:
      "Sem critério escrito de passagem de DISCOVERY para EVALUATION na qualificação comercial (mapa-de-processo §9).",
    severity: "MEDIUM",
    effort: "S",
    costOfDelay: 42,
    confidence: "DECLARED",
    ownerLabel: "Dono do roadmap comercial (RACI)",
    fonte: "docs/comercial/mapa-de-processo.md",
  },
  {
    code: "N-08",
    axis: "PROCESS",
    statement:
      "`proximaAcao` da qualificação não dispara lembrete — a ação combinada com o prospect depende de alguém lembrar sozinho (mapa-de-processo §9).",
    severity: "LOW",
    effort: "S",
    costOfDelay: 25,
    confidence: "DECLARED",
    ownerLabel: "Responsável pela entrega (RACI)",
    fonte: "docs/comercial/mapa-de-processo.md",
  },
  {
    code: "N-09",
    axis: "PROCESS",
    statement:
      "Ticket de diagnóstico, o SKU de entrada do funil, segue sem preço definido (mapa-de-processo §9).",
    severity: "HIGH",
    effort: "S",
    costOfDelay: 65,
    confidence: "DECLARED",
    ownerLabel: "Quem dirige a empresa (RACI)",
    fonte: "docs/comercial/mapa-de-processo.md",
  },
  {
    code: "N-10",
    axis: "PROCESS",
    statement:
      "Nenhuma ação do sistema marca proposta ENVIADA como ACEITA ou RECUSADA — a transição depende de edição manual (mapa-de-processo §9).",
    severity: "MEDIUM",
    effort: "M",
    costOfDelay: 50,
    confidence: "DECLARED",
    ownerLabel: "Responsável pela entrega (RACI)",
    fonte: "docs/comercial/mapa-de-processo.md",
  },
  {
    code: "N-11",
    axis: "PROCESS",
    statement:
      "Recusa de proposta não tem motivo estruturado, perdendo o dado que explicaria por que a venda caiu (mapa-de-processo §9).",
    severity: "LOW",
    effort: "S",
    costOfDelay: 28,
    confidence: "DECLARED",
    ownerLabel: "Responsável pela entrega (RACI)",
    fonte: "docs/comercial/mapa-de-processo.md",
  },
  {
    code: "N-12",
    axis: "PROCESS",
    statement:
      "Proposta comercial não tem validade nem expiração, ficando aberta indefinidamente após o envio (mapa-de-processo §9).",
    severity: "LOW",
    effort: "S",
    costOfDelay: 26,
    confidence: "DECLARED",
    ownerLabel: "Dono do roadmap (RACI)",
    fonte: "docs/comercial/mapa-de-processo.md",
  },
  {
    code: "N-13",
    axis: "PROCESS",
    statement:
      "Assinatura eletrônica de contrato não está implementada — o fechamento depende de processo fora da plataforma (mapa-de-processo §9).",
    severity: "MEDIUM",
    effort: "M",
    costOfDelay: 58,
    confidence: "DECLARED",
    ownerLabel: "Responsável pela entrega (RACI)",
    fonte: "docs/comercial/mapa-de-processo.md",
  },
  {
    code: "N-14",
    axis: "PROCESS",
    statement:
      "Contrato ACEITA não dispara provisionamento automático — o passo é manual e sujeito a esquecimento entre venda e entrega (mapa-de-processo §9).",
    severity: "HIGH",
    effort: "M",
    costOfDelay: 68,
    confidence: "DECLARED",
    ownerLabel: "Responsável pela entrega (RACI)",
    fonte: "docs/comercial/mapa-de-processo.md",
  },
  {
    code: "N-15",
    axis: "PROCESS",
    statement:
      "Reavaliação no Meridian não fecha o ciclo do Engagement de entrega — o produto não sabe quando o trabalho contratado terminou (mapa-de-processo §9).",
    severity: "MEDIUM",
    effort: "M",
    costOfDelay: 48,
    confidence: "DECLARED",
    ownerLabel: "Dono do roadmap (RACI, produto Meridian)",
    fonte: "docs/comercial/mapa-de-processo.md",
  },

  // PEOPLE
  {
    code: "N-16",
    axis: "PEOPLE",
    statement:
      "Não existe função dedicada de entrega para os pacotes do Scaffold; seis dos quinze candidatos setoriais exigem LAB e nenhum é vendável sem essa pendência de RH (scaffold-prd §5).",
    severity: "HIGH",
    effort: "L",
    costOfDelay: 60,
    confidence: "DECLARED",
    ownerLabel: "Responsável pela entrega (RACI)",
    fonte: "docs/produto/scaffold-prd.md",
  },
  {
    code: "N-17",
    axis: "PEOPLE",
    statement:
      "Dono do SLA e responsável pela entrega ainda podem ser a mesma pessoa — sem separação, o SLA é intenção, não compromisso (playbook-de-vendas §4).",
    severity: "MEDIUM",
    effort: "S",
    costOfDelay: 44,
    confidence: "DECLARED",
    ownerLabel: "Dono do SLA (RACI)",
    fonte: "docs/comercial/playbook-de-vendas.md",
  },

  // GOVERNANCE
  {
    code: "N-18",
    axis: "GOVERNANCE",
    statement:
      "Custo de aquisição de cliente totalmente carregado, com alocação contábil do custo de entrega, não é medido — precificação de módulo e serviço seguem no chute (mapa-de-processo §9).",
    severity: "HIGH",
    effort: "M",
    costOfDelay: 85,
    confidence: "DECLARED",
    ownerLabel: "Dono do SLA / financeiro (RACI)",
    fonte: "docs/comercial/mapa-de-processo.md",
  },
  {
    code: "N-19",
    axis: "GOVERNANCE",
    statement:
      "Signal está contratável e precificado no back-office a R$ 1.200/mês sem uma linha de código de produto (INDEX-MESTRE §2).",
    severity: "HIGH",
    effort: "S",
    costOfDelay: 82,
    confidence: "DECLARED",
    ownerLabel:
      "Dono do roadmap (RACI) — decisão de produto vendável vs. capacidade do Cosmos",
    fonte: "docs/superpowers/plans/INDEX-MESTRE.md",
  },
  {
    code: "N-20",
    axis: "GOVERNANCE",
    statement:
      "RACI de quem assina o contrato pela Nebuloz não está preenchido (playbook-de-vendas §4).",
    severity: "MEDIUM",
    effort: "S",
    costOfDelay: 46,
    confidence: "DECLARED",
    ownerLabel: "Quem dirige a empresa (RACI)",
    fonte: "docs/comercial/playbook-de-vendas.md",
  },
  {
    code: "N-21",
    axis: "GOVERNANCE",
    statement:
      "DPA não está confirmado com nenhum dos dezoito fornecedores do inventário — a policy afirma sete assinados e o Charter marca todos como a confirmar (charter-nebuloz §5).",
    severity: "HIGH",
    effort: "M",
    costOfDelay: 80,
    confidence: "DECLARED",
    ownerLabel: "Encarregado de dados (a nomear)",
    fonte: "docs/runbooks/charter-nebuloz.md",
  },
  {
    code: "N-22",
    axis: "GOVERNANCE",
    statement:
      "Decisão operadora × controladora para respondente do Meridian e participante externo de reunião não foi tomada, travando o DPA-modelo e o canal do titular (lgpd-ropa-e-lacunas §4).",
    severity: "HIGH",
    effort: "M",
    costOfDelay: 75,
    confidence: "DECLARED",
    ownerLabel: "Quem dirige a empresa (RACI)",
    fonte: "docs/compliance/lgpd-ropa-e-lacunas.md",
  },
  {
    code: "N-23",
    axis: "GOVERNANCE",
    statement:
      "Parecer jurídico sobre se aviso verbal na abertura da cerimônia sustenta a base legal de consentimento no modo STANDING ainda não existe (lgpd-ropa-e-lacunas §8).",
    severity: "MEDIUM",
    effort: "S",
    costOfDelay: 52,
    confidence: "DECLARED",
    ownerLabel: "Quem dirige a empresa (RACI)",
    fonte: "docs/compliance/lgpd-ropa-e-lacunas.md",
  },
  {
    code: "N-24",
    axis: "GOVERNANCE",
    statement:
      "Consentimento de gravação de reunião, único caso de uso crítico do inventário, segue sem resolução jurídica e trava a funcionalidade que destrava o trial da TOTVS (INDEX-MESTRE §3).",
    severity: "HIGH",
    effort: "M",
    costOfDelay: 90,
    confidence: "DECLARED",
    ownerLabel: "Quem dirige a empresa (RACI)",
    fonte: "docs/superpowers/plans/INDEX-MESTRE.md",
  },
  {
    code: "N-29",
    axis: "GOVERNANCE",
    statement:
      "Charter da própria Nebuloz ainda não foi provisionado — falta minutos de operação, não código, e trava o uso interno do produto (INDEX-MESTRE §4).",
    severity: "MEDIUM",
    effort: "S",
    costOfDelay: 38,
    confidence: "DECLARED",
    ownerLabel: "Quem dirige a empresa (RACI)",
    fonte: "docs/superpowers/plans/INDEX-MESTRE.md",
  },

  // INFRASTRUCTURE
  {
    code: "N-25",
    axis: "INFRASTRUCTURE",
    statement:
      "Aplicação conecta ao Postgres como superuser com BYPASSRLS — as declarações de RLS do repositório são inertes em runtime (ADR-0012).",
    severity: "HIGH",
    effort: "M",
    costOfDelay: 72,
    confidence: "DECLARED",
    ownerLabel: "Responsável pela entrega (RACI)",
    fonte: "docs/adr/0012-rls-anulada-por-conexao-superuser.md",
  },
  {
    code: "N-26",
    axis: "INFRASTRUCTURE",
    statement:
      "Segredo de cadastro de 2FA trafega em query string para um serviço de terceiro ao gerar o QR code — quem já cadastrou precisa recadastrar depois do fix (cadastro-2fa-totp-design).",
    severity: "HIGH",
    effort: "M",
    costOfDelay: 66,
    confidence: "DECLARED",
    ownerLabel: "Responsável pela entrega (RACI)",
    fonte: "docs/superpowers/specs/2026-08-13-cadastro-2fa-totp-design.md",
  },
  {
    code: "N-27",
    axis: "INFRASTRUCTURE",
    statement:
      "MeridianEvidence.storagePath não tem rotina de limpeza de storage — o arquivo de evidência sobrevive à eliminação do titular (lgpd-ropa-e-lacunas §5).",
    severity: "MEDIUM",
    effort: "M",
    costOfDelay: 42,
    confidence: "DECLARED",
    ownerLabel: "Responsável pela entrega (RACI)",
    fonte: "docs/compliance/lgpd-ropa-e-lacunas.md",
  },
  {
    code: "N-28",
    axis: "INFRASTRUCTURE",
    statement:
      "Integrações obrigatórias do Signal ficam para iteração futura — V1 entrega só contrato de conexão manual, sem conector automático (specs/003-signal-measure/spec.md §10, Q1).",
    severity: "LOW",
    effort: "M",
    costOfDelay: 24,
    confidence: "DECLARED",
    ownerLabel: "Dono do roadmap (RACI)",
    fonte: "specs/003-signal-measure/spec.md",
  },
];

// ── Plano ────────────────────────────────────────────────────────────────────
//
// As doze lacunas de maior `costOfDelay`, quatro trimestres a partir de
// 2026-Q4, três por trimestre. `capacityNote` é honesto de propósito: hoje não
// há função de entrega dedicada (scaffold-prd §5) nem separação entre dono do
// SLA e quem entrega (playbook-de-vendas §4) — o plano não finge que essas
// pendências de RACI já estão fechadas.

const CAPACITY_CAVEAT =
  "sem função de entrega dedicada nem separação entre dono do SLA e quem executa (scaffold-prd §5, playbook-de-vendas §4)";

export const NEBULOZ_PLAN: NebulozPlanItem[] = [
  // 2026-Q4
  {
    gapCode: "N-24",
    quarter: 1,
    quarterLabel: "2026-Q4",
    seq: 1,
    capacityNote: `2026-Q4 — decisão jurídica, não engenharia; ${CAPACITY_CAVEAT}.`,
  },
  {
    gapCode: "N-18",
    quarter: 1,
    quarterLabel: "2026-Q4",
    seq: 2,
    capacityNote: `2026-Q4 — decisão financeira, não engenharia; ${CAPACITY_CAVEAT}.`,
  },
  {
    gapCode: "N-19",
    quarter: 1,
    quarterLabel: "2026-Q4",
    seq: 3,
    capacityNote: `2026-Q4 — decisão de catálogo, uma linha de SQL depois de decidida; ${CAPACITY_CAVEAT}.`,
  },
  // 2027-Q1
  {
    gapCode: "N-21",
    quarter: 2,
    quarterLabel: "2027-Q1",
    seq: 4,
    capacityNote: `2027-Q1 — contratual, depende de resposta de dezoito fornecedores; ${CAPACITY_CAVEAT}.`,
  },
  {
    gapCode: "N-04",
    quarter: 2,
    quarterLabel: "2027-Q1",
    seq: 5,
    capacityNote: `2027-Q1 — reescrita de documento, sem código; ${CAPACITY_CAVEAT}.`,
  },
  {
    gapCode: "N-22",
    quarter: 2,
    quarterLabel: "2027-Q1",
    seq: 6,
    capacityNote: `2027-Q1 — decisão jurídica que trava o DPA-modelo; ${CAPACITY_CAVEAT}.`,
  },
  // 2027-Q2
  {
    gapCode: "N-25",
    quarter: 3,
    quarterLabel: "2027-Q2",
    seq: 7,
    capacityNote: `2027-Q2 — papel de aplicação sem BYPASSRLS, afeta todo o Cosmos, não só a Nebuloz; ${CAPACITY_CAVEAT}.`,
  },
  {
    gapCode: "N-01",
    quarter: 3,
    quarterLabel: "2027-Q2",
    seq: 8,
    capacityNote: `2027-Q2 — função Inngest nova, escopo de engenharia próprio; ${CAPACITY_CAVEAT}.`,
  },
  {
    gapCode: "N-14",
    quarter: 3,
    quarterLabel: "2027-Q2",
    seq: 9,
    capacityNote: `2027-Q2 — automação do provisionamento pós-contrato; ${CAPACITY_CAVEAT}.`,
  },
  // 2027-Q3
  {
    gapCode: "N-26",
    quarter: 4,
    quarterLabel: "2027-Q3",
    seq: 10,
    capacityNote: `2027-Q3 — mover o QR code para o servidor, recadastro dos já cadastrados; ${CAPACITY_CAVEAT}.`,
  },
  {
    gapCode: "N-09",
    quarter: 4,
    quarterLabel: "2027-Q3",
    seq: 11,
    capacityNote: `2027-Q3 — decisão de preço do ticket de diagnóstico; ${CAPACITY_CAVEAT}.`,
  },
  {
    gapCode: "N-16",
    quarter: 4,
    quarterLabel: "2027-Q3",
    seq: 12,
    capacityNote: `2027-Q3 — a própria função dedicada de entrega, pré-requisito dos pacotes que dependem dela; ${CAPACITY_CAVEAT}.`,
  },
];

// ── Score por eixo, regra declarada ─────────────────────────────────────────

const SEVERITY_PENALTY: Record<NebulozSeverity, number> = {
  HIGH: 30,
  MEDIUM: 15,
  LOW: 5,
};

/** Confiança fixa das cinco leituras: baixa de propósito, na mesma escala 0–1
 *  de `MeridianAxisScore.confidence`, para marcar "declarado" mesmo num campo
 *  que não tem enum de confiança. */
export const NEBULOZ_AXIS_SCORE_CONFIDENCE = 0.3;

export const NEBULOZ_AXIS_SCORE_NOTE =
  "Score derivado por regra declarada (100 − penalidade média por severidade das lacunas do eixo: HIGH 30 · MEDIUM 15 · LOW 5) a partir das lacunas registradas neste assessment. Nenhuma resposta à bateria existe — não há respondente nem `MeridianResponse` para este assessment.";

/**
 * Score declarado de um eixo: 100 menos a penalidade média das lacunas desse
 * eixo em `NEBULOZ_GAPS`. Arredondado, limitado a [0, 100].
 *
 * Retorna `null` quando o eixo não tem nenhuma lacuna — é o caso em que o
 * script de seed não deve gravar `MeridianAxisScore` nenhum, em vez de
 * inventar um score sem lacuna que o sustente.
 */
export function computeDeclaredAxisScore(
  axis: NebulozAxis,
  gaps: readonly NebulozGap[] = NEBULOZ_GAPS
): number | null {
  const axisGaps = gaps.filter((g) => g.axis === axis);
  if (axisGaps.length === 0) {
    return null;
  }
  const totalPenalty = axisGaps.reduce(
    (sum, g) => sum + SEVERITY_PENALTY[g.severity],
    0
  );
  const avgPenalty = totalPenalty / axisGaps.length;
  return Math.max(0, Math.min(100, Math.round(100 - avgPenalty)));
}
