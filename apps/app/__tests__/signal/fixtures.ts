// fixtures.ts — dados do protótipo `signal-data.jsx` (tenant Vanta Saúde),
// transcritos para alimentar os testes do motor de cálculo.
//
// Por que transcrever em vez de inventar números: o handoff é o contrato de
// comportamento. Se `roi()` devolver 4,3× para a IN-014, ou a porta está errada
// ou o protótipo estava — e a diferença precisa aparecer como falha de teste,
// não como ajuste silencioso de expectativa.
//
// ── DUAS DIVERGÊNCIAS DO MOCK, deliberadamente NÃO reproduzidas ──────────────
//
// O protótipo carrega `roi.returned` e `confidence.score` como números soltos,
// ao lado das listas que deveriam produzi-los. Em 2 dos 8 casos os dois lados
// não fecham:
//
//   1. IN-031 · `returned: 379200`, mas os componentes somam 421.760.
//      A premissa da própria iniciativa explica: "Atribuição da perda evitada
//      70%". O desconto já está dentro do mapeamento MP-04
//      ("(baseline_loss − actual_loss) × 0,70") e foi aplicado de novo no
//      total — desconto em dobro.
//   2. IN-014 · `score: 86`, mas os fatores somam 93. O alerta AL-30 do mesmo
//      mock diz "Confiança volta de 86% para 93%", tratando 93 como o estado
//      *corrigido* — enquanto a lista de fatores já está com o desconto do
//      Zendesk aplicado (`got: 18` de 25). Os dois não podem ser verdade juntos.
//
// A porta resolve isso por construção: `returned`, `invested` e `score` são
// DERIVADOS das listas, nunca colunas próprias. Um número que não bate com as
// suas partes é exatamente o que este produto existe para impedir; guardá-lo
// separado é convidar a divergência de volta. Ver `data-model.md` §
// SignalRoiFormula e a decisão D3 de `research.md`.
//
// Os valores esperados abaixo são, portanto, os DERIVADOS. Onde eles diferem do
// headline do mock, o campo `mockHeadline` registra o que o protótipo dizia.

export type RoiEntryFixture = {
  kind: "RETURN" | "COST";
  label: string;
  total: number;
  /** Obrigatória: "todo número tem fonte" é regra de conteúdo do produto
   *  (ui-contract §6.3), não enfeite. Fixture sem fonte não representa um
   *  estado que o produto aceita gravar. */
  sourceLabel: string;
};

export type ConfidenceFactorFixture = {
  key: string;
  label: string;
  weight: number;
  got: number;
  note?: string;
};

export type InitiativeFixture = {
  code: string;
  name: string;
  businessUnit: string;
  category: "PRODUCTIVITY" | "QUALITY" | "RISK" | "REVENUE";
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "CLOSED" | "CANCELLED";
  adoption: { activeUsers: number; licensedUsers: number };
  roiEntries: RoiEntryFixture[];
  confidenceFactors: ConfidenceFactorFixture[];
  /** Esperados, todos derivados das listas acima. */
  expected: {
    invested: number;
    returned: number;
    /** Múltiplo com uma casa, como a UI apresenta. */
    multiple: number;
    adoptionPct: number;
    confidenceScore: number;
    confidenceBand: "HIGH" | "MEDIUM" | "LOW" | "NONE";
    verdict: "PROVEN" | "VANITY" | "PROMISE" | "STOP";
  };
  /** Preenchido só onde o mock discorda do derivado. */
  mockHeadline?: { multiple?: number; confidenceScore?: number };
};

/** Limiares padrão do tenant — `SignalSettings.adoptionBar` / `.valueBar`. */
export const DEFAULT_BARS = { adoptionBar: 60, valueBar: 1.5 } as const;

/** Catálogo de fatores de confiança, pesos somando 100. */
export const CONFIDENCE_RULES = [
  {
    key: "baseline.signed",
    label: "Baseline assinado pelo dono do processo",
    weight: 30,
  },
  { key: "sources.fresh", label: "Fontes sincronizando (≤ 24 h)", weight: 25 },
  {
    key: "formula.reviewed",
    label: "Fórmula versionada e revisada",
    weight: 20,
  },
  { key: "sample.size", label: "Amostra ≥ 4 semanas pós-adoção", weight: 25 },
] as const;

const f = (
  key: string,
  got: number,
  note?: string
): ConfidenceFactorFixture => {
  const rule = CONFIDENCE_RULES.find((r) => r.key === key);
  if (!rule) {
    throw new Error(`Fator desconhecido: ${key}`);
  }
  return { key, label: rule.label, weight: rule.weight, got, note };
};

export const INITIATIVES: InitiativeFixture[] = [
  {
    code: "IN-014",
    name: "Triagem assistida de autorizações",
    businessUnit: "Operações",
    category: "PRODUCTIVITY",
    status: "ACTIVE",
    adoption: { activeUsers: 14, licensedUsers: 18 },
    roiEntries: [
      {
        kind: "RETURN",
        label: "Horas economizadas",
        total: 157_080,
        sourceLabel: "Jira · tempo em fila",
      },
      {
        kind: "RETURN",
        label: "Retrabalho evitado",
        total: 245_000,
        sourceLabel: "Zendesk · reaberturas",
      },
      {
        kind: "RETURN",
        label: "Capacidade liberada",
        total: 362_320,
        sourceLabel: "Diretório + folha",
      },
      {
        kind: "COST",
        label: "Licenças de IA",
        total: 96_000,
        sourceLabel: "Planilha de custos",
      },
      {
        kind: "COST",
        label: "Implantação",
        total: 61_000,
        sourceLabel: "Contrato Nebuloz",
      },
      {
        kind: "COST",
        label: "Treinamento",
        total: 25_000,
        sourceLabel: "Planilha de custos",
      },
    ],
    confidenceFactors: [
      f("baseline.signed", 30),
      f("sources.fresh", 18, "Zendesk desconectado desde 05 jul"),
      f("formula.reviewed", 20),
      f("sample.size", 25),
    ],
    expected: {
      invested: 182_000,
      returned: 764_400,
      multiple: 4.2,
      adoptionPct: 77.8,
      confidenceScore: 93,
      confidenceBand: "HIGH",
      verdict: "PROVEN",
    },
    // Ver divergência 2 no cabeçalho: o mock guardava 86, os fatores somam 93.
    mockHeadline: { confidenceScore: 86 },
  },
  {
    code: "IN-021",
    name: "Copiloto de atendimento N1",
    businessUnit: "Atendimento",
    category: "PRODUCTIVITY",
    status: "ACTIVE",
    adoption: { activeUsers: 52, licensedUsers: 62 },
    roiEntries: [
      {
        kind: "RETURN",
        label: "Horas economizadas",
        total: 59_740,
        sourceLabel: "Zendesk · handle time",
      },
      {
        kind: "RETURN",
        label: "Tickets desviados",
        total: 156_240,
        sourceLabel: "Zendesk · self-service",
      },
      {
        kind: "COST",
        label: "Licenças de IA",
        total: 186_000,
        sourceLabel: "Planilha de custos",
      },
      {
        kind: "COST",
        label: "Implantação",
        total: 34_000,
        sourceLabel: "Contrato Nebuloz",
      },
      {
        kind: "COST",
        label: "Treinamento",
        total: 20_000,
        sourceLabel: "Planilha de custos",
      },
    ],
    confidenceFactors: [
      f("baseline.signed", 30),
      f("sources.fresh", 25),
      f(
        "formula.reviewed",
        9,
        '"tickets desviados" não tem contrafactual — atribuição frágil'
      ),
      f(
        "sample.size",
        0,
        "amostra existe, mas o ganho está dentro da margem de erro"
      ),
    ],
    expected: {
      invested: 240_000,
      returned: 215_980,
      multiple: 0.9,
      adoptionPct: 83.9,
      confidenceScore: 64,
      confidenceBand: "LOW",
      // Adoção alta sem retorno — o caso que dá nome ao quadrante.
      verdict: "VANITY",
    },
  },
  {
    code: "IN-009",
    name: "Revisão de contratos com LLM",
    businessUnit: "Jurídico",
    category: "QUALITY",
    status: "ACTIVE",
    adoption: { activeUsers: 3, licensedUsers: 9 },
    roiEntries: [
      {
        kind: "RETURN",
        label: "Horas economizadas",
        total: 85_560,
        sourceLabel: "Planilha do jurídico",
      },
      {
        kind: "RETURN",
        label: "Exposição evitada",
        total: 144_000,
        sourceLabel: "Registro de auditoria",
      },
      {
        kind: "COST",
        label: "Licenças de IA",
        total: 42_000,
        sourceLabel: "Planilha de custos",
      },
      {
        kind: "COST",
        label: "Implantação",
        total: 22_000,
        sourceLabel: "Contrato Nebuloz",
      },
      {
        kind: "COST",
        label: "Treinamento",
        total: 10_000,
        sourceLabel: "Planilha de custos",
      },
    ],
    confidenceFactors: [
      f("baseline.signed", 30),
      f(
        "sources.fresh",
        16,
        "planilha do jurídico é atualizada à mão, semanalmente"
      ),
      f("formula.reviewed", 15, "custo de escape vem de amostra de 3 casos"),
      f("sample.size", 10, "só 3 usuários ativos — amostra pequena"),
    ],
    expected: {
      invested: 74_000,
      returned: 229_560,
      multiple: 3.1,
      adoptionPct: 33.3,
      confidenceScore: 71,
      confidenceBand: "MEDIUM",
      verdict: "PROMISE",
    },
  },
  {
    code: "IN-031",
    name: "Detecção de fraude em sinistros",
    businessUnit: "Risco",
    category: "RISK",
    status: "ACTIVE",
    adoption: { activeUsers: 14, licensedUsers: 21 },
    roiEntries: [
      {
        kind: "RETURN",
        label: "Perda evitada",
        total: 392_000,
        sourceLabel: "Snowflake · perdas",
      },
      {
        kind: "RETURN",
        label: "Horas de revisão economizadas",
        total: 29_760,
        sourceLabel: "Snowflake · revisão",
      },
      {
        kind: "COST",
        label: "Licenças de IA",
        total: 84_000,
        sourceLabel: "Planilha de custos",
      },
      {
        kind: "COST",
        label: "Implantação",
        total: 52_000,
        sourceLabel: "Contrato Nebuloz",
      },
      {
        kind: "COST",
        label: "Modelo dedicado",
        total: 22_000,
        sourceLabel: "Contrato Nebuloz",
      },
    ],
    confidenceFactors: [
      f("baseline.signed", 30),
      f("sources.fresh", 25),
      f("formula.reviewed", 14, "atribuição de 70% é julgamento, não medição"),
      f(
        "sample.size",
        10,
        "fraude tem sazonalidade — 15 semanas ainda é curto"
      ),
    ],
    expected: {
      invested: 158_000,
      returned: 421_760,
      multiple: 2.7,
      adoptionPct: 66.7,
      confidenceScore: 79,
      confidenceBand: "MEDIUM",
      verdict: "PROVEN",
    },
    // Ver divergência 1 no cabeçalho: desconto de atribuição aplicado em dobro.
    mockHeadline: { multiple: 2.4 },
  },
  {
    code: "IN-035",
    name: "Geração de propostas comerciais",
    businessUnit: "Comercial",
    category: "REVENUE",
    status: "ACTIVE",
    adoption: { activeUsers: 17, licensedUsers: 24 },
    roiEntries: [
      {
        kind: "RETURN",
        label: "Receita incremental",
        total: 139_400,
        sourceLabel: "Snowflake · funil",
      },
      {
        kind: "RETURN",
        label: "Horas economizadas",
        total: 33_280,
        sourceLabel: "Jira · deals",
      },
      {
        kind: "COST",
        label: "Licenças de IA",
        total: 62_000,
        sourceLabel: "Planilha de custos",
      },
      {
        kind: "COST",
        label: "Implantação",
        total: 24_000,
        sourceLabel: "Contrato Nebuloz",
      },
      {
        kind: "COST",
        label: "Treinamento",
        total: 10_000,
        sourceLabel: "Planilha de custos",
      },
    ],
    confidenceFactors: [
      f("baseline.signed", 30),
      f("sources.fresh", 25),
      f(
        "formula.reviewed",
        8,
        "pricing mudou no mesmo trimestre — atribuição contaminada"
      ),
      f("sample.size", 5, "9 semanas, com um trimestre de sazonalidade forte"),
    ],
    expected: {
      invested: 96_000,
      returned: 172_680,
      multiple: 1.8,
      adoptionPct: 70.8,
      confidenceScore: 68,
      confidenceBand: "MEDIUM",
      verdict: "PROVEN",
    },
  },
  {
    code: "IN-027",
    name: "Sumarização de laudos",
    businessUnit: "Clínico",
    category: "QUALITY",
    status: "ACTIVE",
    adoption: { activeUsers: 8, licensedUsers: 38 },
    roiEntries: [
      {
        kind: "RETURN",
        label: "Horas economizadas",
        total: 52_820,
        sourceLabel: "Planilha clínica",
      },
      {
        kind: "COST",
        label: "Licenças de IA",
        total: 58_000,
        sourceLabel: "Planilha de custos",
      },
      {
        kind: "COST",
        label: "Implantação",
        total: 21_000,
        sourceLabel: "Contrato Nebuloz",
      },
      {
        kind: "COST",
        label: "Treinamento",
        total: 9000,
        sourceLabel: "Planilha de custos",
      },
    ],
    confidenceFactors: [
      f("baseline.signed", 30),
      f("sources.fresh", 12, "planilha clínica atualizada quinzenalmente"),
      f(
        "formula.reviewed",
        10,
        "só um componente de retorno — não cobre a hipótese de qualidade"
      ),
      f("sample.size", 0, "adoção caiu no último mês; série não é estável"),
    ],
    expected: {
      invested: 88_000,
      returned: 52_820,
      multiple: 0.6,
      adoptionPct: 21.1,
      confidenceScore: 52,
      confidenceBand: "LOW",
      verdict: "STOP",
    },
  },
  {
    code: "IN-038",
    name: "Previsão de demanda de estoque",
    businessUnit: "Suprimentos",
    category: "PRODUCTIVITY",
    status: "PAUSED",
    adoption: { activeUsers: 5, licensedUsers: 11 },
    roiEntries: [
      {
        kind: "RETURN",
        label: "Venda recuperada",
        total: 123_300,
        sourceLabel: "Snowflake · estoque",
      },
      {
        kind: "COST",
        label: "Licenças de IA",
        total: 72_000,
        sourceLabel: "Planilha de custos",
      },
      {
        kind: "COST",
        label: "Implantação",
        total: 40_000,
        sourceLabel: "Contrato Nebuloz",
      },
    ],
    confidenceFactors: [
      f("baseline.signed", 30),
      f("sources.fresh", 3, "iniciativa pausada — sem sync há 6 dias"),
      f("formula.reviewed", 15),
      f("sample.size", 10, "adoção regrediu antes da pausa"),
    ],
    expected: {
      invested: 112_000,
      returned: 123_300,
      multiple: 1.1,
      adoptionPct: 45.5,
      confidenceScore: 58,
      confidenceBand: "LOW",
      verdict: "STOP",
    },
  },
  {
    code: "IN-003",
    name: "Chatbot de FAQ interno",
    businessUnit: "TI",
    category: "PRODUCTIVITY",
    status: "CLOSED",
    adoption: { activeUsers: 107, licensedUsers: 890 },
    roiEntries: [
      {
        kind: "RETURN",
        label: "Chamados evitados",
        total: 18_600,
        sourceLabel: "Jira Service Desk",
      },
      {
        kind: "RETURN",
        label: "Horas economizadas",
        total: 21_660,
        sourceLabel: "Jira Service Desk",
      },
      {
        kind: "COST",
        label: "Licenças de IA",
        total: 78_000,
        sourceLabel: "Planilha de custos",
      },
      {
        kind: "COST",
        label: "Implantação",
        total: 44_000,
        sourceLabel: "Contrato interno",
      },
      {
        kind: "COST",
        label: "Treinamento",
        total: 12_000,
        sourceLabel: "Planilha de custos",
      },
    ],
    confidenceFactors: [
      f("baseline.signed", 30),
      f("sources.fresh", 25),
      f("formula.reviewed", 19),
      f("sample.size", 0, "encerrada — série congelada em 30 abr"),
    ],
    expected: {
      invested: 134_000,
      returned: 40_260,
      multiple: 0.3,
      adoptionPct: 12.0,
      confidenceScore: 74,
      confidenceBand: "MEDIUM",
      verdict: "STOP",
    },
  },
  {
    // Iniciativa em rascunho: sem baseline, sem fonte, sem fórmula. Existe para
    // provar que o motor não divide por zero nem inventa veredito.
    code: "IN-042",
    name: "Onboarding assistido de credenciados",
    businessUnit: "Rede",
    category: "PRODUCTIVITY",
    status: "DRAFT",
    adoption: { activeUsers: 0, licensedUsers: 0 },
    roiEntries: [],
    confidenceFactors: [
      f("baseline.signed", 0, "não capturado"),
      f("sources.fresh", 0, "nenhuma fonte conectada"),
      f("formula.reviewed", 0, "fórmula não definida"),
      f("sample.size", 0, "iniciativa não iniciada"),
    ],
    expected: {
      invested: 0,
      returned: 0,
      multiple: 0,
      adoptionPct: 0,
      confidenceScore: 0,
      confidenceBand: "NONE",
      verdict: "STOP",
    },
  },
];

export const byCode = (code: string): InitiativeFixture => {
  const found = INITIATIVES.find((i) => i.code === code);
  if (!found) {
    throw new Error(`Fixture desconhecida: ${code}`);
  }
  return found;
};

/** Só as ativas — base dos agregados de portfólio. */
export const activeFixtures = (): InitiativeFixture[] =>
  INITIATIVES.filter((i) => i.status === "ACTIVE");
