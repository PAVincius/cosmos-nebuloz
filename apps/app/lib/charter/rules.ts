import type {
  CharterCriticality,
  CharterDataClass,
  CharterExposure,
  CharterHitl,
  CharterSectionStatus,
  CharterVendorTier,
} from "@repo/database";

// Charter — as quatro regras que são o produto.
//
// Módulo isomórfico de propósito: sem `server-only`, sem I/O, sem Prisma. O
// intake precisa recalcular ao vivo no cliente a cada tecla (FR-4.2) e o
// servidor precisa validar autoritativamente a mesma coisa. Duas implementações
// divergiriam no primeiro ajuste de regra.
//
// Fonte: design_handoff_charter/DATA-MODEL.md §4.

export type Tone = "green" | "amber" | "red" | "accent" | "blue" | "purple";

// ── Classe de dado ────────────────────────────────────────────────────────────

/** Peso de cada classe. O salto 2→4 é intencional: Confidencial cruza a
 *  fronteira de revisão obrigatória. Não é ordinal decorativo — entra na
 *  fórmula de recommendPath(). */
const DATA_CLASS_WEIGHT: Record<CharterDataClass, 1 | 2 | 4 | 5> = {
  PUBLIC: 1,
  INTERNAL: 2,
  CONFIDENTIAL: 4,
  RESTRICTED: 5,
};

export const DATA_CLASS_LABEL: Record<CharterDataClass, string> = {
  PUBLIC: "Público",
  INTERNAL: "Interno",
  CONFIDENTIAL: "Confidencial",
  RESTRICTED: "Restrito (PII/PHI)",
};

export const DATA_CLASS_RULE: Record<CharterDataClass, string> = {
  PUBLIC: "Uso livre em qualquer ferramenta aprovada.",
  INTERNAL: "Somente ferramentas com DPA assinado.",
  CONFIDENTIAL: "Exige revisão de Segurança e retenção zero.",
  RESTRICTED: "Proibido em ferramenta pública. Só ambiente dedicado com BAA.",
};

export const DATA_CLASS_TONE: Record<CharterDataClass, Tone> = {
  PUBLIC: "green",
  INTERNAL: "blue",
  CONFIDENTIAL: "amber",
  RESTRICTED: "red",
};

export const DATA_CLASS_ORDER: CharterDataClass[] = [
  "PUBLIC",
  "INTERNAL",
  "CONFIDENTIAL",
  "RESTRICTED",
];

export function dataClassWeight(dataClass: CharterDataClass): number {
  return DATA_CLASS_WEIGHT[dataClass];
}

// ── 1. recommendPath — caminho de aprovação, SLA e HITL ───────────────────────

export type PathRecommendation = {
  path: string;
  slaDays: number;
  tone: Tone;
  hitl: CharterHitl;
  /** A regra que produziu o resultado. O requester precisa entender por que caiu
   *  no Comitê — mostrar só o resultado não atende FR-4.3. */
  rule: string;
};

/**
 * Roda ao vivo no intake, antes de qualquer revisor humano tocar o caso.
 * Primeira condição que casar vence — a ordem importa.
 */
export function recommendPath(
  dataClass: CharterDataClass,
  exposure: CharterExposure,
  criticality: CharterCriticality
): PathRecommendation {
  const w = dataClassWeight(dataClass);

  if (w >= 5 || (exposure === "EXTERNAL" && criticality === "HIGH")) {
    return {
      path: "Legal + Segurança + Comitê de IA",
      slaDays: 10,
      tone: "red",
      hitl: "FULL_REVIEW",
      rule:
        w >= 5
          ? "Dado Restrito (PII/PHI) vai ao Comitê de IA independente de exposição e criticidade."
          : "Exposição externa combinada com criticidade alta vai ao Comitê de IA.",
    };
  }

  if (w >= 4 || criticality === "HIGH") {
    return {
      path: "Segurança + Legal",
      slaDays: 5,
      tone: "amber",
      hitl: "FULL_REVIEW",
      rule:
        w >= 4
          ? "Dado Confidencial exige revisão de Segurança e de Legal."
          : "Decisão de criticidade alta exige revisão de Segurança e de Legal.",
    };
  }

  if (w >= 2 || exposure === "EXTERNAL") {
    return {
      path: "Segurança",
      slaDays: 3,
      tone: "accent",
      hitl: "SAMPLING",
      rule:
        w >= 2
          ? "Qualquer dado acima de Público exige revisão de Segurança."
          : "Qualquer exposição externa exige revisão de Segurança.",
    };
  }

  return {
    path: "Via rápida — aprovação automática com registro",
    slaDays: 1,
    tone: "green",
    hitl: "PASSIVE",
    rule: "Dado Público, uso interno e criticidade baixa entram na via rápida com registro.",
  };
}

export const HITL_LABEL: Record<CharterHitl, string> = {
  FULL_REVIEW: "Revisão integral",
  SAMPLING: "Revisão por amostragem",
  PASSIVE: "Supervisão passiva",
};

// ── 2. Gate de fornecedor por classe de dado ──────────────────────────────────

export type VendorGateInput = {
  maxClass: CharterDataClass | null;
  notes: string | null;
};

export type VendorGate =
  | { eligible: true }
  | { eligible: false; reason: string };

/**
 * Barra a submissão no formulário — não submete para reprovar depois.
 * A mensagem nomeia o motivo contratual concreto, lido de `vendor.notes`
 * (DPA ausente, retenção incompatível, sem BAA).
 */
export function vendorEligibility(
  vendor: VendorGateInput,
  dataClass: CharterDataClass
): VendorGate {
  if (vendor.maxClass === null) {
    return {
      eligible: false,
      reason:
        vendor.notes?.trim() ||
        "Fornecedor sem classe máxima de dado — postura contratual não permite nenhum uso.",
    };
  }

  if (dataClassWeight(vendor.maxClass) >= dataClassWeight(dataClass)) {
    return { eligible: true };
  }

  const ceiling = DATA_CLASS_LABEL[vendor.maxClass];
  const asked = DATA_CLASS_LABEL[dataClass];
  const why = vendor.notes?.trim();
  return {
    eligible: false,
    reason: why
      ? `Fornecedor processa no máximo dado ${ceiling}; o caso pede ${asked}. ${why}`
      : `Fornecedor processa no máximo dado ${ceiling}; o caso pede ${asked}.`,
  };
}

// ── 3. Score de risco ─────────────────────────────────────────────────────────

export type RiskProfile = {
  privacy: number;
  regulatory: number;
  security: number;
  bias: number;
  ip: number;
  operational: number;
  reputational: number;
};

export type RiskResult = {
  severity: number;
  likelihood: number;
  score: number;
  label: "Crítico" | "Elevado" | "Moderado" | "Baixo";
  tone: Tone;
};

/**
 * Rótulo de severidade a partir de um score (severidade × probabilidade) já
 * calculado — os mesmos limiares que `riskScore()` usa logo abaixo, extraídos
 * para que outro leitor com um score pronto (hoje só `capabilities.ts`,
 * RISK_SCORING, que pontua uma dimensão em vez das 7) fale o vocabulário que
 * o resto do Charter fala, em vez de manter uma segunda tabela de limiares.
 * Foi exatamente esse o defeito achado na review final: `nivel()`
 * (`risk-matrix.ts`) usa 15/9/4 e maiúsculas — no score 15 ele diz "CRITICO"
 * enquanto isto aqui diz "Elevado". Duas escalas de risco no mesmo produto.
 */
export function scoreLabel(
  score: number
): "Crítico" | "Elevado" | "Moderado" | "Baixo" {
  if (score >= 16) {
    return "Crítico";
  }
  if (score >= 9) {
    return "Elevado";
  }
  if (score >= 4) {
    return "Moderado";
  }
  return "Baixo";
}

const TONE_BY_LABEL: Record<RiskResult["label"], Tone> = {
  Crítico: "red",
  Elevado: "amber",
  Moderado: "green",
  Baixo: "green",
};

/**
 * Severidade é MÁXIMO, não média, de propósito: um risco de privacidade 5 não
 * pode ser diluído por seis categorias em 1. Probabilidade é a média
 * arredondada — o perfil geral do caso.
 */
export function riskScore(risks: RiskProfile): RiskResult {
  const values = [
    risks.privacy,
    risks.regulatory,
    risks.security,
    risks.bias,
    risks.ip,
    risks.operational,
    risks.reputational,
  ];
  const severity = Math.max(...values);
  const likelihood = Math.max(
    1,
    Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
  );
  const score = severity * likelihood;
  const label = scoreLabel(score);

  return { severity, likelihood, score, label, tone: TONE_BY_LABEL[label] };
}

export const RISK_CATEGORY_LABEL = {
  PRIVACY: "Privacidade",
  REGULATORY: "Regulatório",
  SECURITY: "Segurança",
  BIAS: "Viés",
  IP: "PI / Confidencialidade",
  OPERATIONAL: "Operacional",
  REPUTATIONAL: "Reputacional",
} as const;

export const RISK_CATEGORY_DESC = {
  PRIVACY: "Exposição de dado pessoal ou sensível.",
  REGULATORY: "LGPD, GDPR, ANS e normas setoriais.",
  SECURITY: "Superfície de ataque, retenção e vazamento.",
  BIAS: "Discriminação em decisão sobre pessoa.",
  IP: "Propriedade intelectual e segredo de negócio.",
  OPERATIONAL: "Dependência, indisponibilidade, erro em cadeia.",
  REPUTATIONAL: "Percepção pública e confiança do cliente.",
} as const;

/** Tom fixo por gravidade intrínseca da categoria (DESIGN.md §3). Não recolorir
 *  por dado — a categoria não muda de natureza porque um caso pontuou baixo. */
export const RISK_CATEGORY_TONE = {
  PRIVACY: "red",
  REGULATORY: "red",
  SECURITY: "amber",
  BIAS: "amber",
  IP: "accent",
  OPERATIONAL: "accent",
  REPUTATIONAL: "accent",
} as const satisfies Record<keyof typeof RISK_CATEGORY_LABEL, Tone>;

// ── 4. Bloqueio de publicação de política ─────────────────────────────────────

export type SectionRef = {
  id: string;
  name: string;
  status: CharterSectionStatus;
};

/**
 * Retorna os bloqueadores — não um booleano. O modal precisa listar cada um por
 * nome e status (FR-2.3); só desabilitar o botão não diz ao usuário o que fazer.
 *
 * Política sem nenhuma seção também bloqueia: publicar versão vazia produziria
 * evidência de auditoria sem conteúdo.
 */
export function policyPublishBlockers(sections: SectionRef[]): SectionRef[] {
  if (sections.length === 0) {
    return [
      {
        id: "__empty__",
        name: "Política sem seções",
        status: "DRAFT",
      },
    ];
  }
  return sections.filter((s) => s.status !== "PUBLISHED");
}

export const SECTION_STATUS_LABEL: Record<CharterSectionStatus, string> = {
  PUBLISHED: "Publicada",
  REVIEW: "Em revisão",
  DRAFT: "Rascunho",
};

export const SECTION_STATUS_TONE: Record<CharterSectionStatus, Tone> = {
  PUBLISHED: "green",
  REVIEW: "amber",
  DRAFT: "accent",
};

// ── Derivação da classe máxima do fornecedor ──────────────────────────────────

/**
 * Cláusulas críticas: a ausência de qualquer uma limita o teto contratual.
 *
 * NOTA DE ESPECIFICAÇÃO: o handoff exige derivar a classe máxima e exibir o
 * raciocínio (FR-9.2) e recalcular ao marcar/desmarcar cláusula (FR-9.3), mas
 * não fornece o algoritmo — no protótipo `maxClass` é valor escrito à mão. A
 * escada abaixo é derivada do texto normativo de cada classe em
 * DATA-MODEL.md §1 (DataClass.rule), único fundamento disponível:
 *   Interno       "exige DPA assinado"                     → DPA + CL-01
 *   Confidencial  "revisão de Segurança + retenção zero"   → + CL-02, CL-03, CL-04
 *   Restrito      "só ambiente dedicado com BAA"           → + CL-08
 */
export const CRITICAL_CLAUSE_CODES = [
  "CL-01",
  "CL-02",
  "CL-03",
  "CL-04",
  "CL-08",
] as const;

export const CLAUSE_LABEL: Record<string, string> = {
  "CL-01": "Proibição de treinamento com dados do cliente",
  "CL-02": "Retenção zero de prompt e resposta",
  "CL-03": "Notificação de incidente em 24h",
  "CL-04": "Lista de sub-processadores e direito de objeção",
  "CL-05": "Localidade de processamento definida contratualmente",
  "CL-06": "Direito de auditoria anual",
  "CL-07": "Indenização por violação de PI",
  "CL-08": "BAA / adendo de dado de saúde",
};

export type VendorPosture = {
  tier: CharterVendorTier;
  dpa: boolean;
  clauseCodes: string[];
};

export type MaxClassDerivation = {
  maxClass: CharterDataClass | null;
  /** Um degrau por linha, na ordem em que foi avaliado. Alimenta o painel de
   *  postura contratual — o CISO precisa ver por que o teto é aquele. */
  reasoning: string[];
};

export function deriveVendorMaxClass(
  vendor: VendorPosture
): MaxClassDerivation {
  const has = (code: string) => vendor.clauseCodes.includes(code);
  const reasoning: string[] = [];

  if (vendor.tier === "BLOCKED") {
    return {
      maxClass: null,
      reasoning: [
        "Bloqueado por decisão de governança — nenhum dado permitido.",
      ],
    };
  }

  if (!(vendor.dpa && has("CL-01"))) {
    reasoning.push(
      vendor.dpa
        ? "Teto Público: falta CL-01 (proibição de treinamento com dados do cliente)."
        : "Teto Público: DPA não assinado."
    );
    return { maxClass: "PUBLIC", reasoning };
  }
  reasoning.push("DPA assinado e CL-01 presente → permite dado Interno.");

  const confidentialGaps = ["CL-02", "CL-03", "CL-04"].filter((c) => !has(c));
  if (confidentialGaps.length > 0) {
    reasoning.push(
      `Teto Interno: falta ${confidentialGaps
        .map((c) => `${c} (${CLAUSE_LABEL[c]})`)
        .join(", ")}.`
    );
    return { maxClass: "INTERNAL", reasoning };
  }
  reasoning.push("CL-02, CL-03 e CL-04 presentes → permite dado Confidencial.");

  if (!has("CL-08")) {
    reasoning.push(
      `Teto Confidencial: falta CL-08 (${CLAUSE_LABEL["CL-08"]}), exigida para PII/PHI.`
    );
    return { maxClass: "CONFIDENTIAL", reasoning };
  }
  reasoning.push("CL-08 presente → permite dado Restrito (PII/PHI).");

  return { maxClass: "RESTRICTED", reasoning };
}

// ── SLA em dias úteis ─────────────────────────────────────────────────────────

/** Dias úteis decorridos entre duas datas (exclui sábado e domingo). Feriado
 *  não entra: exigiria calendário por geografia do tenant, que o V1 não modela. */
function businessDaysBetween(from: Date, to: Date): number {
  if (to <= from) {
    return 0;
  }
  let days = 0;
  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(0, 0, 0, 0);

  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      days += 1;
    }
  }
  return days;
}

/**
 * Dias úteis restantes do SLA. Negativo quando vencido — a UI precisa
 * distinguir "vence hoje" de "vencido há 3 dias" e escrever a palavra
 * "vencido" (cor nunca carrega estado sozinha).
 * Null quando o caso ainda não foi submetido.
 */
export function slaRemaining(
  submittedAt: Date | null,
  slaTotal: number | null,
  now: Date = new Date()
): number | null {
  if (!(submittedAt && slaTotal)) {
    return null;
  }
  return slaTotal - businessDaysBetween(submittedAt, now);
}

/** Tom do SLA por proximidade do vencimento (FR-3.3). */
export function slaTone(remaining: number | null): Tone {
  if (remaining === null) {
    return "accent";
  }
  if (remaining < 0) {
    return "red";
  }
  if (remaining <= 2) {
    return "amber";
  }
  return "green";
}
