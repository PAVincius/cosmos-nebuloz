/**
 * Seed de demonstração do Signal — tenant "Vanta Saúde" do handoff.
 *
 * Idempotente: roda quantas vezes quiser. Tudo por `upsert` na chave natural
 * (tenantId + code), então rodar de novo atualiza em vez de duplicar.
 *
 * Uso: pnpm --filter @repo/database exec tsx seed-signal.ts
 *
 * Os números vêm de `signal-data.jsx` do projeto de design, com UMA correção
 * deliberada: `invested`/`returned`/`score` não são semeados como totais soltos,
 * porque não existem como coluna — saem das entradas e dos fatores. Nos dois
 * casos em que o mock discordava de si mesmo (IN-031 com desconto de atribuição
 * em dobro, IN-014 com score 86 contra fatores somando 93), o que vale é a soma
 * das partes. Ver `apps/app/__tests__/signal/fixtures.ts`.
 */

// Carrega packages/database/.env — o tsx não lê .env sozinho, e sem isso o
// `pg` recebe senha undefined e morre em "client password must be a string".
import "dotenv/config";
import { PrismaClient } from "./generated/client";

// Prisma 7 exige driver adapter explícito — mesma construção do seed-admin.
// Não dá para importar o `database` de `index.ts`: aquele módulo carrega
// "server-only" e só roda dentro do runtime do Next.
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const db = new PrismaClient({
  adapter: new PrismaPg(
    new Pool({ connectionString: process.env.DATABASE_URL })
  ),
});

const TENANT_SLUG = "cosmos-dev";

type EntrySeed = {
  kind: "RETURN" | "COST";
  label: string;
  quantityLabel?: string;
  unitLabel?: string;
  total: number;
  sourceLabel: string;
};

type InitiativeSeed = {
  code: string;
  name: string;
  businessUnit: string;
  category: "PRODUCTIVITY" | "QUALITY" | "RISK" | "REVENUE";
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "CLOSED" | "CANCELLED";
  hypothesis: string;
  startedAt: string | null;
  closure?: { at: string; reason: string };
  baseline?: {
    version: number;
    windowLabel: string;
    windowStart: string;
    windowEnd: string;
    signedAt: string;
    dims: { key: string; label: string; value: string; sourceLabel: string }[];
  };
  adoption: {
    activeUsers: number;
    licensedUsers: number;
    frequencyLabel: string;
    depthNote: string;
  }[];
  outcome: {
    metricLabel: string;
    baselineValue: string;
    currentValue: string;
    numericBaseline: number;
    numericCurrent: number;
    isSecondary?: boolean;
    direction?: "LOWER_IS_BETTER" | "HIGHER_IS_BETTER";
  }[];
  roi: {
    version: number;
    horizonMonths: number;
    entries: EntrySeed[];
    assumptions: { label: string; value: string; note: string }[];
  };
  confidence: { key: string; got: number; note?: string }[];
};

const INITIATIVES: InitiativeSeed[] = [
  {
    code: "IN-014",
    name: "Triagem assistida de autorizações",
    businessUnit: "Operações",
    category: "PRODUCTIVITY",
    status: "ACTIVE",
    startedAt: "2026-06-02",
    hypothesis:
      "Se a triagem priorizar por critério econômico em vez de ordem de chegada, o cycle time cai ≥ 20% sem aumentar negativa indevida.",
    baseline: {
      version: 2,
      windowLabel: "4 semanas · mai/2026",
      windowStart: "2026-05-01",
      windowEnd: "2026-05-29",
      signedAt: "2026-06-18",
      dims: [
        {
          key: "TIME",
          label: "Tempo por caso",
          value: "46 min",
          sourceLabel: "Jira · tempo em fila",
        },
        {
          key: "COST",
          label: "Custo por caso",
          value: "R$ 64",
          sourceLabel: "Planilha de custos",
        },
        {
          key: "THROUGHPUT",
          label: "Volume",
          value: "340/semana",
          sourceLabel: "Jira · issues criadas",
        },
        {
          key: "QUALITY",
          label: "Qualidade",
          value: "8,2% retrabalho",
          sourceLabel: "Zendesk · reaberturas",
        },
        {
          key: "USER_BASE",
          label: "Base de usuários",
          value: "18 analistas",
          sourceLabel: "Diretório interno",
        },
      ],
    },
    adoption: [
      {
        activeUsers: 4,
        licensedUsers: 18,
        frequencyLabel: "2,1 usos/semana",
        depthNote: "usa só no primeiro passo",
      },
      {
        activeUsers: 7,
        licensedUsers: 18,
        frequencyLabel: "4,0 usos/semana",
        depthNote: "usa nos dois primeiros passos",
      },
      {
        activeUsers: 9,
        licensedUsers: 18,
        frequencyLabel: "6,2 usos/semana",
        depthNote: "usa em 2 dos 4 passos do fluxo",
      },
      {
        activeUsers: 11,
        licensedUsers: 18,
        frequencyLabel: "7,8 usos/semana",
        depthNote: "usa em 3 dos 4 passos do fluxo",
      },
      {
        activeUsers: 13,
        licensedUsers: 18,
        frequencyLabel: "8,9 usos/semana",
        depthNote: "usa em 3 dos 4 passos do fluxo",
      },
      {
        activeUsers: 14,
        licensedUsers: 18,
        frequencyLabel: "9,4 usos/semana",
        depthNote: "usa em 3 dos 4 passos do fluxo",
      },
    ],
    outcome: [
      {
        metricLabel: "Tempo por caso",
        baselineValue: "46 min",
        currentValue: "31 min",
        numericBaseline: 46,
        numericCurrent: 31,
      },
      {
        metricLabel: "Retrabalho",
        baselineValue: "8,2%",
        currentValue: "6,1%",
        numericBaseline: 8.2,
        numericCurrent: 6.1,
        isSecondary: true,
      },
    ],
    roi: {
      version: 3,
      horizonMonths: 12,
      entries: [
        {
          kind: "RETURN",
          label: "Horas economizadas",
          quantityLabel: "1.870 h",
          unitLabel: "R$ 84/h",
          total: 157_080,
          sourceLabel: "Jira · tempo em fila",
        },
        {
          kind: "RETURN",
          label: "Retrabalho evitado",
          quantityLabel: "196 casos",
          unitLabel: "R$ 1.250/caso",
          total: 245_000,
          sourceLabel: "Zendesk · reaberturas",
        },
        {
          kind: "RETURN",
          label: "Capacidade liberada",
          quantityLabel: "2,1 FTE",
          unitLabel: "R$ 172.000/FTE",
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
      assumptions: [
        {
          label: "Custo-hora do analista",
          value: "R$ 84",
          note: "folha + encargos ÷ 1.760 h",
        },
        {
          label: "Custo de um retrabalho",
          value: "R$ 1.250",
          note: "média de 2025, informada pelo Financeiro",
        },
        {
          label: "Horizonte",
          value: "12 meses",
          note: "anualizado sobre 6 semanas medidas",
        },
      ],
    },
    confidence: [
      { key: "baseline.signed", got: 30 },
      {
        key: "sources.fresh",
        got: 18,
        note: "Zendesk desconectado desde 05 jul",
      },
      { key: "formula.reviewed", got: 20 },
      { key: "sample.size", got: 25 },
    ],
  },
  {
    code: "IN-021",
    name: "Copiloto de atendimento N1",
    businessUnit: "Atendimento",
    category: "PRODUCTIVITY",
    status: "ACTIVE",
    startedAt: "2026-04-14",
    hypothesis:
      "Se o N1 tiver rascunho automático de resposta, o tempo de primeira resposta cai 40% mantendo CSAT.",
    baseline: {
      version: 1,
      windowLabel: "4 semanas · mar/2026",
      windowStart: "2026-03-02",
      windowEnd: "2026-03-30",
      signedAt: "2026-04-28",
      dims: [
        {
          key: "TIME",
          label: "Tempo de 1ª resposta",
          value: "12 min",
          sourceLabel: "Zendesk · first reply",
        },
        {
          key: "COST",
          label: "Custo por ticket",
          value: "R$ 9,40",
          sourceLabel: "Planilha de custos",
        },
        {
          key: "THROUGHPUT",
          label: "Volume",
          value: "4.100/semana",
          sourceLabel: "Zendesk · tickets",
        },
        {
          key: "QUALITY",
          label: "Qualidade",
          value: "CSAT 4,3",
          sourceLabel: "Zendesk · survey",
        },
        {
          key: "USER_BASE",
          label: "Base de usuários",
          value: "62 agentes",
          sourceLabel: "Diretório interno",
        },
      ],
    },
    adoption: [
      {
        activeUsers: 19,
        licensedUsers: 62,
        frequencyLabel: "9 usos/semana",
        depthNote: "usa só no rascunho",
      },
      {
        activeUsers: 32,
        licensedUsers: 62,
        frequencyLabel: "17 usos/semana",
        depthNote: "usa só no rascunho",
      },
      {
        activeUsers: 42,
        licensedUsers: 62,
        frequencyLabel: "24 usos/semana",
        depthNote: "usa só no rascunho",
      },
      {
        activeUsers: 48,
        licensedUsers: 62,
        frequencyLabel: "28 usos/semana",
        depthNote: "usa só no rascunho, não na classificação",
      },
      {
        activeUsers: 50,
        licensedUsers: 62,
        frequencyLabel: "30 usos/semana",
        depthNote: "usa só no rascunho, não na classificação",
      },
      {
        activeUsers: 52,
        licensedUsers: 62,
        frequencyLabel: "31 usos/semana",
        depthNote: "usa só no rascunho, não na classificação",
      },
    ],
    outcome: [
      {
        metricLabel: "Tempo de 1ª resposta",
        baselineValue: "12 min",
        currentValue: "11 min",
        numericBaseline: 12,
        numericCurrent: 11,
      },
      {
        metricLabel: "CSAT",
        baselineValue: "4,3",
        currentValue: "4,2",
        numericBaseline: 4.3,
        numericCurrent: 4.2,
        isSecondary: true,
        direction: "HIGHER_IS_BETTER",
      },
    ],
    roi: {
      version: 2,
      horizonMonths: 12,
      entries: [
        {
          kind: "RETURN",
          label: "Horas economizadas",
          quantityLabel: "1.030 h",
          unitLabel: "R$ 58/h",
          total: 59_740,
          sourceLabel: "Zendesk · handle time",
        },
        {
          kind: "RETURN",
          label: "Tickets desviados",
          quantityLabel: "1.240",
          unitLabel: "R$ 126/ticket",
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
      assumptions: [
        {
          label: "Custo-hora do agente",
          value: "R$ 58",
          note: "folha + encargos ÷ 1.760 h",
        },
        {
          label: "Valor de um ticket desviado",
          value: "R$ 126",
          note: "custo médio de atendimento humano",
        },
        {
          label: "Horizonte",
          value: "12 meses",
          note: "anualizado sobre 11 semanas medidas",
        },
      ],
    },
    confidence: [
      { key: "baseline.signed", got: 30 },
      { key: "sources.fresh", got: 25 },
      {
        key: "formula.reviewed",
        got: 9,
        note: '"tickets desviados" não tem contrafactual — atribuição frágil',
      },
      {
        key: "sample.size",
        got: 0,
        note: "amostra existe, mas o ganho está dentro da margem de erro",
      },
    ],
  },
  {
    code: "IN-009",
    name: "Revisão de contratos com LLM",
    businessUnit: "Jurídico",
    category: "QUALITY",
    status: "ACTIVE",
    startedAt: "2026-02-20",
    hypothesis:
      "Se o jurídico receber cláusulas de risco pré-marcadas, o tempo de parecer cai 30% e escapes de cláusula caem a zero.",
    baseline: {
      version: 3,
      windowLabel: "6 semanas · jan/2026",
      windowStart: "2026-01-05",
      windowEnd: "2026-02-13",
      signedAt: "2026-03-06",
      dims: [
        {
          key: "TIME",
          label: "Tempo por contrato",
          value: "4,2 h",
          sourceLabel: "Planilha do jurídico",
        },
        {
          key: "COST",
          label: "Custo por contrato",
          value: "R$ 780",
          sourceLabel: "Planilha de custos",
        },
        {
          key: "THROUGHPUT",
          label: "Volume",
          value: "48/mês",
          sourceLabel: "Snowflake · contratos",
        },
        {
          key: "QUALITY",
          label: "Qualidade",
          value: "3 escapes/trimestre",
          sourceLabel: "Registro de auditoria",
        },
        {
          key: "USER_BASE",
          label: "Base de usuários",
          value: "9 advogados",
          sourceLabel: "Diretório interno",
        },
      ],
    },
    adoption: [
      {
        activeUsers: 1,
        licensedUsers: 9,
        frequencyLabel: "0,6 uso/semana",
        depthNote: "um advogado sênior testando",
      },
      {
        activeUsers: 1,
        licensedUsers: 9,
        frequencyLabel: "0,9 uso/semana",
        depthNote: "um advogado sênior",
      },
      {
        activeUsers: 2,
        licensedUsers: 9,
        frequencyLabel: "1,4 uso/semana",
        depthNote: "dois advogados sêniores",
      },
      {
        activeUsers: 2,
        licensedUsers: 9,
        frequencyLabel: "1,8 uso/semana",
        depthNote: "dois advogados sêniores",
      },
      {
        activeUsers: 3,
        licensedUsers: 9,
        frequencyLabel: "2,0 usos/semana",
        depthNote: "dois advogados sêniores concentram 80% do uso",
      },
      {
        activeUsers: 3,
        licensedUsers: 9,
        frequencyLabel: "2,1 usos/semana",
        depthNote: "dois advogados sêniores concentram 80% do uso",
      },
    ],
    outcome: [
      {
        metricLabel: "Tempo por contrato",
        baselineValue: "4,2 h",
        currentValue: "2,6 h",
        numericBaseline: 4.2,
        numericCurrent: 2.6,
      },
      {
        metricLabel: "Escapes de cláusula",
        baselineValue: "3/tri",
        currentValue: "0/tri",
        numericBaseline: 3,
        numericCurrent: 0,
        isSecondary: true,
      },
    ],
    roi: {
      version: 3,
      horizonMonths: 12,
      entries: [
        {
          kind: "RETURN",
          label: "Horas economizadas",
          quantityLabel: "460 h",
          unitLabel: "R$ 186/h",
          total: 85_560,
          sourceLabel: "Planilha do jurídico",
        },
        {
          kind: "RETURN",
          label: "Exposição evitada",
          quantityLabel: "3 escapes",
          unitLabel: "R$ 48.000/escape",
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
      assumptions: [
        {
          label: "Custo-hora do advogado",
          value: "R$ 186",
          note: "folha + encargos ÷ 1.760 h",
        },
        {
          label: "Custo de um escape de cláusula",
          value: "R$ 48.000",
          note: "média histórica de 3 casos, validada pelo jurídico",
        },
        {
          label: "Horizonte",
          value: "12 meses",
          note: "anualizado sobre 18 semanas medidas",
        },
      ],
    },
    confidence: [
      { key: "baseline.signed", got: 30 },
      {
        key: "sources.fresh",
        got: 16,
        note: "planilha do jurídico é atualizada à mão, semanalmente",
      },
      {
        key: "formula.reviewed",
        got: 15,
        note: "custo de escape vem de amostra de 3 casos",
      },
      {
        key: "sample.size",
        got: 10,
        note: "só 3 usuários ativos — amostra pequena",
      },
    ],
  },
  {
    code: "IN-031",
    name: "Detecção de fraude em sinistros",
    businessUnit: "Risco",
    category: "RISK",
    status: "ACTIVE",
    startedAt: "2026-03-11",
    hypothesis:
      "Se sinistros suspeitos forem sinalizados na entrada, a perda por fraude cai 25% sem elevar falso positivo acima de 5%.",
    baseline: {
      version: 2,
      windowLabel: "8 semanas · jan/2026",
      windowStart: "2026-01-05",
      windowEnd: "2026-02-27",
      signedAt: "2026-03-25",
      dims: [
        {
          key: "TIME",
          label: "Tempo de análise",
          value: "38 min",
          sourceLabel: "Snowflake · sinistros",
        },
        {
          key: "COST",
          label: "Perda por fraude",
          value: "R$ 1,4 mi/ano",
          sourceLabel: "Snowflake · perdas",
        },
        {
          key: "THROUGHPUT",
          label: "Volume",
          value: "2.300/mês",
          sourceLabel: "Snowflake · sinistros",
        },
        {
          key: "QUALITY",
          label: "Qualidade",
          value: "falso positivo 11%",
          sourceLabel: "Snowflake · revisão",
        },
        {
          key: "USER_BASE",
          label: "Base de usuários",
          value: "21 analistas",
          sourceLabel: "Diretório interno",
        },
      ],
    },
    adoption: [
      {
        activeUsers: 3,
        licensedUsers: 21,
        frequencyLabel: "4 usos/semana",
        depthNote: "usa só na entrada",
      },
      {
        activeUsers: 6,
        licensedUsers: 21,
        frequencyLabel: "8 usos/semana",
        depthNote: "usa só na entrada",
      },
      {
        activeUsers: 9,
        licensedUsers: 21,
        frequencyLabel: "12 usos/semana",
        depthNote: "usa na entrada",
      },
      {
        activeUsers: 11,
        licensedUsers: 21,
        frequencyLabel: "15 usos/semana",
        depthNote: "usa na entrada e na revisão de segunda linha",
      },
      {
        activeUsers: 13,
        licensedUsers: 21,
        frequencyLabel: "17 usos/semana",
        depthNote: "usa na entrada e na revisão de segunda linha",
      },
      {
        activeUsers: 14,
        licensedUsers: 21,
        frequencyLabel: "18 usos/semana",
        depthNote: "usa na entrada e na revisão de segunda linha",
      },
    ],
    outcome: [
      {
        metricLabel: "Perda por fraude",
        baselineValue: "R$ 1,4 mi",
        currentValue: "R$ 1,01 mi",
        numericBaseline: 1.4,
        numericCurrent: 1.01,
      },
      {
        metricLabel: "Falso positivo",
        baselineValue: "11%",
        currentValue: "4,6%",
        numericBaseline: 11,
        numericCurrent: 4.6,
        isSecondary: true,
      },
    ],
    roi: {
      version: 4,
      horizonMonths: 12,
      entries: [
        {
          kind: "RETURN",
          label: "Perda evitada",
          quantityLabel: "R$ 392 mil",
          unitLabel: "direto",
          total: 392_000,
          sourceLabel: "Snowflake · perdas",
        },
        {
          kind: "RETURN",
          label: "Horas de revisão economizadas",
          quantityLabel: "310 h",
          unitLabel: "R$ 96/h",
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
      assumptions: [
        {
          label: "Custo-hora do analista de risco",
          value: "R$ 96",
          note: "folha + encargos ÷ 1.760 h",
        },
        {
          label: "Atribuição da perda evitada",
          value: "70%",
          note: "desconto já aplicado no mapeamento MP-04, não repetido no total",
        },
        {
          label: "Horizonte",
          value: "12 meses",
          note: "anualizado sobre 15 semanas medidas",
        },
      ],
    },
    confidence: [
      { key: "baseline.signed", got: 30 },
      { key: "sources.fresh", got: 25 },
      {
        key: "formula.reviewed",
        got: 14,
        note: "atribuição de 70% é julgamento, não medição",
      },
      {
        key: "sample.size",
        got: 10,
        note: "fraude tem sazonalidade — 15 semanas ainda é curto",
      },
    ],
  },
  {
    code: "IN-035",
    name: "Geração de propostas comerciais",
    businessUnit: "Comercial",
    category: "REVENUE",
    status: "ACTIVE",
    startedAt: "2026-05-05",
    hypothesis:
      "Se a proposta sair em 1 dia em vez de 5, a taxa de conversão sobe 6 pontos no mesmo funil.",
    baseline: {
      version: 1,
      windowLabel: "4 semanas · abr/2026",
      windowStart: "2026-04-01",
      windowEnd: "2026-04-29",
      signedAt: "2026-05-19",
      dims: [
        {
          key: "TIME",
          label: "Tempo até proposta",
          value: "5,1 dias",
          sourceLabel: "Jira · deals",
        },
        {
          key: "COST",
          label: "Custo por proposta",
          value: "R$ 420",
          sourceLabel: "Planilha de custos",
        },
        {
          key: "THROUGHPUT",
          label: "Volume",
          value: "86/mês",
          sourceLabel: "Jira · deals",
        },
        {
          key: "QUALITY",
          label: "Qualidade",
          value: "conversão 18%",
          sourceLabel: "Snowflake · funil",
        },
        {
          key: "USER_BASE",
          label: "Base de usuários",
          value: "24 vendedores",
          sourceLabel: "Diretório interno",
        },
      ],
    },
    adoption: [
      {
        activeUsers: 4,
        licensedUsers: 24,
        frequencyLabel: "1,8 uso/semana",
        depthNote: "usa na montagem",
      },
      {
        activeUsers: 8,
        licensedUsers: 24,
        frequencyLabel: "3,1 usos/semana",
        depthNote: "usa na montagem",
      },
      {
        activeUsers: 12,
        licensedUsers: 24,
        frequencyLabel: "4,4 usos/semana",
        depthNote: "usa na montagem, não no pricing",
      },
      {
        activeUsers: 14,
        licensedUsers: 24,
        frequencyLabel: "5,3 usos/semana",
        depthNote: "usa na montagem, não no pricing",
      },
      {
        activeUsers: 16,
        licensedUsers: 24,
        frequencyLabel: "5,9 usos/semana",
        depthNote: "usa na montagem, não no pricing",
      },
      {
        activeUsers: 17,
        licensedUsers: 24,
        frequencyLabel: "6,2 usos/semana",
        depthNote: "usa na montagem, não no pricing",
      },
    ],
    outcome: [
      {
        metricLabel: "Tempo até proposta",
        baselineValue: "5,1 dias",
        currentValue: "1,4 dia",
        numericBaseline: 5.1,
        numericCurrent: 1.4,
      },
      {
        metricLabel: "Conversão",
        baselineValue: "18%",
        currentValue: "21,4%",
        numericBaseline: 18,
        numericCurrent: 21.4,
        isSecondary: true,
        direction: "HIGHER_IS_BETTER",
      },
    ],
    roi: {
      version: 2,
      horizonMonths: 12,
      entries: [
        {
          kind: "RETURN",
          label: "Receita incremental",
          quantityLabel: "3,4 pts de conversão",
          unitLabel: "R$ 41.000/pt",
          total: 139_400,
          sourceLabel: "Snowflake · funil",
        },
        {
          kind: "RETURN",
          label: "Horas economizadas",
          quantityLabel: "520 h",
          unitLabel: "R$ 64/h",
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
      assumptions: [
        {
          label: "Valor de 1 ponto de conversão",
          value: "R$ 41.000",
          note: "ticket médio × volume do funil",
        },
        {
          label: "Atribuição da conversão",
          value: "60%",
          note: "desconto por mudança simultânea de pricing",
        },
        {
          label: "Horizonte",
          value: "12 meses",
          note: "anualizado sobre 9 semanas medidas",
        },
      ],
    },
    confidence: [
      { key: "baseline.signed", got: 30 },
      { key: "sources.fresh", got: 25 },
      {
        key: "formula.reviewed",
        got: 8,
        note: "pricing mudou no mesmo trimestre — atribuição contaminada",
      },
      {
        key: "sample.size",
        got: 5,
        note: "9 semanas, com um trimestre de sazonalidade forte",
      },
    ],
  },
  {
    code: "IN-027",
    name: "Sumarização de laudos",
    businessUnit: "Clínico",
    category: "QUALITY",
    status: "ACTIVE",
    startedAt: "2026-04-22",
    hypothesis:
      "Se o laudo vier com resumo estruturado, o tempo de leitura do médico cai 40%.",
    baseline: {
      version: 1,
      windowLabel: "4 semanas · abr/2026",
      windowStart: "2026-04-01",
      windowEnd: "2026-04-29",
      signedAt: "2026-05-06",
      dims: [
        {
          key: "TIME",
          label: "Tempo de leitura",
          value: "9 min",
          sourceLabel: "Planilha clínica",
        },
        {
          key: "COST",
          label: "Custo por laudo",
          value: "R$ 52",
          sourceLabel: "Planilha de custos",
        },
        {
          key: "THROUGHPUT",
          label: "Volume",
          value: "1.900/mês",
          sourceLabel: "Snowflake · laudos",
        },
        {
          key: "QUALITY",
          label: "Qualidade",
          value: "discordância 4%",
          sourceLabel: "Registro clínico",
        },
        {
          key: "USER_BASE",
          label: "Base de usuários",
          value: "38 médicos",
          sourceLabel: "Diretório interno",
        },
      ],
    },
    adoption: [
      {
        activeUsers: 5,
        licensedUsers: 38,
        frequencyLabel: "0,9 uso/semana",
        depthNote: "abre o resumo",
      },
      {
        activeUsers: 7,
        licensedUsers: 38,
        frequencyLabel: "1,1 uso/semana",
        depthNote: "abre o resumo",
      },
      {
        activeUsers: 9,
        licensedUsers: 38,
        frequencyLabel: "1,4 uso/semana",
        depthNote: "abre o resumo, mas relê o laudo inteiro",
      },
      {
        activeUsers: 10,
        licensedUsers: 38,
        frequencyLabel: "1,5 uso/semana",
        depthNote: "abre o resumo, mas relê o laudo inteiro",
      },
      {
        activeUsers: 9,
        licensedUsers: 38,
        frequencyLabel: "1,4 uso/semana",
        depthNote: "abre o resumo, mas relê o laudo inteiro",
      },
      {
        activeUsers: 8,
        licensedUsers: 38,
        frequencyLabel: "1,3 uso/semana",
        depthNote: "abre o resumo, mas relê o laudo inteiro",
      },
    ],
    outcome: [
      {
        metricLabel: "Tempo de leitura",
        baselineValue: "9 min",
        currentValue: "8,4 min",
        numericBaseline: 9,
        numericCurrent: 8.4,
      },
      {
        metricLabel: "Discordância",
        baselineValue: "4%",
        currentValue: "4,2%",
        numericBaseline: 4,
        numericCurrent: 4.2,
        isSecondary: true,
      },
    ],
    roi: {
      version: 1,
      horizonMonths: 12,
      entries: [
        {
          kind: "RETURN",
          label: "Horas economizadas",
          quantityLabel: "190 h",
          unitLabel: "R$ 278/h",
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
      assumptions: [
        {
          label: "Custo-hora do médico",
          value: "R$ 278",
          note: "folha + encargos ÷ 1.760 h",
        },
        {
          label: "Horizonte",
          value: "12 meses",
          note: "anualizado sobre 10 semanas medidas",
        },
      ],
    },
    confidence: [
      { key: "baseline.signed", got: 30 },
      {
        key: "sources.fresh",
        got: 12,
        note: "planilha clínica atualizada quinzenalmente",
      },
      {
        key: "formula.reviewed",
        got: 10,
        note: "só um componente de retorno — não cobre a hipótese de qualidade",
      },
      {
        key: "sample.size",
        got: 0,
        note: "adoção caiu no último mês; série não é estável",
      },
    ],
  },
  {
    code: "IN-038",
    name: "Previsão de demanda de estoque",
    businessUnit: "Suprimentos",
    category: "PRODUCTIVITY",
    status: "PAUSED",
    startedAt: "2026-01-18",
    hypothesis:
      "Se a reposição seguir previsão semanal, a ruptura cai 30% sem aumentar capital parado.",
    baseline: {
      version: 2,
      windowLabel: "8 semanas · nov/2025",
      windowStart: "2025-11-03",
      windowEnd: "2025-12-26",
      signedAt: "2026-02-01",
      dims: [
        {
          key: "QUALITY",
          label: "Ruptura",
          value: "6,8%",
          sourceLabel: "Snowflake · estoque",
        },
        {
          key: "COST",
          label: "Capital parado",
          value: "R$ 3,2 mi",
          sourceLabel: "Snowflake · estoque",
        },
        {
          key: "THROUGHPUT",
          label: "Volume",
          value: "1.100 SKUs",
          sourceLabel: "Snowflake · SKUs",
        },
        {
          key: "TIME",
          label: "Erro de previsão",
          value: "22%",
          sourceLabel: "Snowflake · forecast",
        },
        {
          key: "USER_BASE",
          label: "Base de usuários",
          value: "11 compradores",
          sourceLabel: "Diretório interno",
        },
      ],
    },
    adoption: [
      {
        activeUsers: 3,
        licensedUsers: 11,
        frequencyLabel: "2,0 usos/semana",
        depthNote: "usa para SKUs classe A apenas",
      },
      {
        activeUsers: 4,
        licensedUsers: 11,
        frequencyLabel: "2,8 usos/semana",
        depthNote: "usa para SKUs classe A apenas",
      },
      {
        activeUsers: 5,
        licensedUsers: 11,
        frequencyLabel: "3,3 usos/semana",
        depthNote: "usa para SKUs classe A apenas",
      },
      {
        activeUsers: 5,
        licensedUsers: 11,
        frequencyLabel: "3,4 usos/semana",
        depthNote: "usa para SKUs classe A apenas",
      },
      {
        activeUsers: 5,
        licensedUsers: 11,
        frequencyLabel: "3,2 usos/semana",
        depthNote: "usa para SKUs classe A apenas",
      },
      {
        activeUsers: 5,
        licensedUsers: 11,
        frequencyLabel: "3,1 usos/semana",
        depthNote: "usa para SKUs classe A apenas",
      },
    ],
    outcome: [
      {
        metricLabel: "Ruptura",
        baselineValue: "6,8%",
        currentValue: "5,9%",
        numericBaseline: 6.8,
        numericCurrent: 5.9,
      },
      {
        metricLabel: "Capital parado",
        baselineValue: "R$ 3,2 mi",
        currentValue: "R$ 3,3 mi",
        numericBaseline: 3.2,
        numericCurrent: 3.3,
        isSecondary: true,
      },
    ],
    roi: {
      version: 2,
      horizonMonths: 12,
      entries: [
        {
          kind: "RETURN",
          label: "Venda recuperada",
          quantityLabel: "0,9 pt de ruptura",
          unitLabel: "R$ 137.000/pt",
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
      assumptions: [
        {
          label: "Valor de 1 ponto de ruptura",
          value: "R$ 137.000",
          note: "margem perdida por indisponibilidade",
        },
        {
          label: "Horizonte",
          value: "12 meses",
          note: "anualizado sobre 20 semanas medidas",
        },
      ],
    },
    confidence: [
      { key: "baseline.signed", got: 30 },
      {
        key: "sources.fresh",
        got: 3,
        note: "iniciativa pausada — sem sync há 6 dias",
      },
      { key: "formula.reviewed", got: 15 },
      { key: "sample.size", got: 10, note: "adoção regrediu antes da pausa" },
    ],
  },
  {
    code: "IN-003",
    name: "Chatbot de FAQ interno",
    businessUnit: "TI",
    category: "PRODUCTIVITY",
    status: "CLOSED",
    startedAt: "2025-09-09",
    closure: {
      at: "2026-04-30",
      reason:
        "Adoção nunca passou de 31% e caiu por 6 meses seguidos. Retorno de 0,3× com confiança 74% — o número era confiável, a hipótese estava errada. Licenças realocadas para IN-014.",
    },
    hypothesis:
      "Se o FAQ interno responder sozinho, o volume de chamados ao service desk cai 25%.",
    baseline: {
      version: 1,
      windowLabel: "4 semanas · ago/2025",
      windowStart: "2025-08-04",
      windowEnd: "2025-09-01",
      signedAt: "2025-09-23",
      dims: [
        {
          key: "THROUGHPUT",
          label: "Chamados/mês",
          value: "1.240",
          sourceLabel: "Jira Service Desk",
        },
        {
          key: "COST",
          label: "Custo por chamado",
          value: "R$ 31",
          sourceLabel: "Planilha de custos",
        },
        {
          key: "TIME",
          label: "Tempo por chamado",
          value: "18 min",
          sourceLabel: "Jira Service Desk",
        },
        {
          key: "QUALITY",
          label: "Resolução 1º contato",
          value: "61%",
          sourceLabel: "Jira Service Desk",
        },
        {
          key: "USER_BASE",
          label: "Base de usuários",
          value: "890 colaboradores",
          sourceLabel: "Diretório interno",
        },
      ],
    },
    adoption: [
      {
        activeUsers: 276,
        licensedUsers: 890,
        frequencyLabel: "1,1 uso/semana",
        depthNote: "abandonado na 2ª pergunta em 52% das sessões",
      },
      {
        activeUsers: 231,
        licensedUsers: 890,
        frequencyLabel: "0,9 uso/semana",
        depthNote: "abandonado na 2ª pergunta em 58% das sessões",
      },
      {
        activeUsers: 187,
        licensedUsers: 890,
        frequencyLabel: "0,7 uso/semana",
        depthNote: "abandonado na 2ª pergunta em 61% das sessões",
      },
      {
        activeUsers: 151,
        licensedUsers: 890,
        frequencyLabel: "0,6 uso/semana",
        depthNote: "abandonado na 2ª pergunta em 64% das sessões",
      },
      {
        activeUsers: 125,
        licensedUsers: 890,
        frequencyLabel: "0,5 uso/semana",
        depthNote: "abandonado na 2ª pergunta em 66% das sessões",
      },
      {
        activeUsers: 107,
        licensedUsers: 890,
        frequencyLabel: "0,4 uso/semana",
        depthNote: "abandonado na 2ª pergunta em 68% das sessões",
      },
    ],
    outcome: [
      {
        metricLabel: "Chamados/mês",
        baselineValue: "1.240",
        currentValue: "1.190",
        numericBaseline: 1240,
        numericCurrent: 1190,
      },
      {
        metricLabel: "Resolução 1º contato",
        baselineValue: "61%",
        currentValue: "60%",
        numericBaseline: 61,
        numericCurrent: 60,
        isSecondary: true,
        direction: "HIGHER_IS_BETTER",
      },
    ],
    roi: {
      version: 2,
      horizonMonths: 12,
      entries: [
        {
          kind: "RETURN",
          label: "Chamados evitados",
          quantityLabel: "600",
          unitLabel: "R$ 31/chamado",
          total: 18_600,
          sourceLabel: "Jira Service Desk",
        },
        {
          kind: "RETURN",
          label: "Horas economizadas",
          quantityLabel: "380 h",
          unitLabel: "R$ 57/h",
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
      assumptions: [
        {
          label: "Custo de um chamado",
          value: "R$ 31",
          note: "custo total do service desk ÷ volume",
        },
        {
          label: "Horizonte",
          value: "12 meses",
          note: "realizado, não projetado",
        },
      ],
    },
    confidence: [
      { key: "baseline.signed", got: 30 },
      { key: "sources.fresh", got: 25 },
      { key: "formula.reviewed", got: 19 },
      {
        key: "sample.size",
        got: 0,
        note: "encerrada — série congelada em 30 abr",
      },
    ],
  },
  {
    code: "IN-042",
    name: "Onboarding assistido de credenciados",
    businessUnit: "Rede",
    category: "PRODUCTIVITY",
    status: "DRAFT",
    startedAt: null,
    hypothesis:
      "Se o credenciamento tiver checagem documental automática, o tempo de entrada na rede cai de 21 para 7 dias.",
    adoption: [],
    outcome: [],
    roi: { version: 1, horizonMonths: 12, entries: [], assumptions: [] },
    confidence: [
      { key: "baseline.signed", got: 0, note: "não capturado" },
      { key: "sources.fresh", got: 0, note: "nenhuma fonte conectada" },
      { key: "formula.reviewed", got: 0, note: "fórmula não definida" },
      { key: "sample.size", got: 0, note: "iniciativa não iniciada" },
    ],
  },
];

const CONNECTIONS = [
  {
    code: "CN-01",
    name: "Jira",
    kind: "Rastreador de tarefas",
    icon: "kanban",
    health: "HEALTHY" as const,
    lastSyncAt: "2026-07-09T11:56:00Z",
    expectedFreqMinutes: 15,
    rowsLabel: "1,2 mi eventos",
  },
  {
    code: "CN-02",
    name: "Zendesk",
    kind: "Atendimento",
    icon: "inbox",
    health: "DOWN" as const,
    lastSyncAt: "2026-06-30T23:58:00Z",
    expectedFreqMinutes: 15,
    rowsLabel: null,
    errorMessage:
      "OAuth revogado em 05 jul. Reautorizar o app Signal no Zendesk Admin → Apps → OAuth clients.",
    impactNote:
      "Retrabalho evitado (IN-014) e Tickets desviados (IN-021) congelados em 04 jul.",
  },
  {
    code: "CN-03",
    name: "Snowflake",
    kind: "Data warehouse",
    icon: "database",
    health: "HEALTHY" as const,
    lastSyncAt: "2026-07-09T11:38:00Z",
    expectedFreqMinutes: 60,
    rowsLabel: "48 mi linhas",
  },
  {
    code: "CN-04",
    name: "Planilha de custos",
    kind: "Google Sheets",
    icon: "fileText",
    health: "STALE" as const,
    lastSyncAt: "2026-06-30T12:00:00Z",
    expectedFreqMinutes: null,
    rowsLabel: "412 linhas",
    errorMessage:
      "Última edição em 04 jul. Todo custo de licença depende desta aba.",
    impactNote:
      "7 iniciativas usam custo desatualizado — investimento pode estar subestimado.",
  },
  {
    code: "CN-05",
    name: "Slack",
    kind: "Comunicação",
    icon: "mail",
    health: "HEALTHY" as const,
    lastSyncAt: "2026-07-09T11:49:00Z",
    expectedFreqMinutes: 15,
    rowsLabel: "340 mil eventos",
  },
  {
    code: "CN-06",
    name: "Diretório interno",
    kind: "SCIM / Azure AD",
    icon: "users",
    health: "HEALTHY" as const,
    lastSyncAt: "2026-07-09T11:00:00Z",
    expectedFreqMinutes: 360,
    rowsLabel: "890 usuários",
  },
];

const MAPPINGS = [
  {
    code: "MP-01",
    conn: "CN-01",
    initiative: "IN-014",
    eventKey: "jira.issue.transitioned → Done",
    metricLabel: "Horas economizadas",
    transform: "sum(time_in_status) ÷ 60",
    unit: "horas",
    version: 4,
    state: "ACTIVE" as const,
  },
  {
    code: "MP-02",
    conn: "CN-02",
    initiative: "IN-014",
    eventKey: "zendesk.ticket.reopened",
    metricLabel: "Retrabalho evitado",
    transform: "count(reopened) × custo_retrabalho",
    unit: "R$",
    version: 2,
    state: "BROKEN" as const,
  },
  {
    code: "MP-03",
    conn: "CN-02",
    initiative: "IN-021",
    eventKey: "zendesk.ticket.first_reply",
    metricLabel: "Tempo de 1ª resposta",
    transform: "avg(first_reply_at − created_at)",
    unit: "minutos",
    version: 1,
    state: "BROKEN" as const,
  },
  {
    code: "MP-04",
    conn: "CN-03",
    initiative: "IN-031",
    eventKey: "snowflake.claims.loss_amount",
    metricLabel: "Perda evitada",
    transform: "(baseline_loss − actual_loss) × 0,70",
    unit: "R$",
    version: 3,
    state: "ACTIVE" as const,
  },
  {
    code: "MP-05",
    conn: "CN-03",
    initiative: "IN-035",
    eventKey: "snowflake.funnel.conversion",
    metricLabel: "Receita incremental",
    transform: "(conv_now − conv_base) × valor_ponto × 0,60",
    unit: "R$",
    version: 2,
    state: "REVIEW" as const,
  },
  {
    code: "MP-06",
    conn: "CN-04",
    initiative: null,
    eventKey: "sheets.costs.license_total",
    metricLabel: "Licenças de IA",
    transform: "sum(range B2:B48) por iniciativa",
    unit: "R$",
    version: 1,
    state: "STALE" as const,
  },
  {
    code: "MP-07",
    conn: "CN-06",
    initiative: null,
    eventKey: "directory.user.active_seat",
    metricLabel: "Base de usuários",
    transform: "count(distinct user) where group = initiative",
    unit: "usuários",
    version: 2,
    state: "ACTIVE" as const,
  },
  {
    code: "MP-08",
    conn: "CN-01",
    initiative: "IN-035",
    eventKey: "jira.deal.proposal_sent",
    metricLabel: "Tempo até proposta",
    transform: "avg(sent_at − deal_created_at) ÷ 86400",
    unit: "dias",
    version: 1,
    state: "ACTIVE" as const,
  },
];

const ALERTS = [
  {
    code: "AL-31",
    kind: "WEAK" as const,
    initiative: "IN-021",
    raisedAt: "2026-07-07",
    what: "84% dos agentes usam o copiloto e o retorno está em 0,9× — abaixo do break-even.",
    nextStep:
      'Recalcular sem "tickets desviados" e decidir no comitê de 15 jul.',
  },
  {
    code: "AL-30",
    kind: "STALE" as const,
    initiative: "IN-014",
    raisedAt: "2026-07-09",
    what: 'Zendesk desconectado há 4 dias. "Retrabalho evitado" (R$ 245 mil do retorno) está congelado em 04 jul.',
    nextStep: "Reautorizar OAuth do Zendesk. Confiança volta de 86% para 93%.",
  },
  {
    code: "AL-29",
    kind: "LOW" as const,
    initiative: "IN-009",
    raisedAt: "2026-07-05",
    what: "ROI de 3,1× concentrado em 3 dos 9 advogados. O ganho existe e não escalou.",
    nextStep:
      "Sessão de habilitação com os 6 restantes — potencial de 3,1× para toda a área.",
  },
  {
    code: "AL-28",
    kind: "LOW" as const,
    initiative: "IN-027",
    raisedAt: "2026-07-02",
    what: "Adoção caiu de 25% para 22% e o tempo de leitura só cedeu 7%. Médicos releem o laudo inteiro.",
    nextStep: "Entrevistar 5 médicos antes de renovar licença em set.",
  },
  {
    code: "AL-27",
    kind: "STALE" as const,
    initiative: "IN-038",
    raisedAt: "2026-07-01",
    what: "Iniciativa pausada há 6 dias sem sync — série de ruptura não avança.",
    nextStep: "Decidir retomada ou encerramento até 20 jul.",
  },
];

const REPORTS = [
  {
    code: "RP-118",
    name: "Board Q2 · FY26",
    kind: "EXECUTIVE" as const,
    periodLabel: "abr – jun 2026",
    periodStart: "2026-04-01",
    periodEnd: "2026-06-30",
    state: "FINAL" as const,
    pageCount: 6,
    generatedAt: "2026-07-09",
    note: "Congelado. Números não mudam mesmo se a fonte atualizar.",
  },
  {
    code: "RP-117",
    name: "Comitê de IA · julho",
    kind: "PORTFOLIO" as const,
    periodLabel: "jan – jul 2026",
    periodStart: "2026-01-01",
    periodEnd: "2026-07-31",
    state: "FINAL" as const,
    pageCount: 11,
    generatedAt: "2026-07-08",
    note: "Inclui as duas iniciativas encerradas e a justificativa de parada.",
  },
  {
    code: "RP-116",
    name: "CFO mensal · junho",
    kind: "EXECUTIVE" as const,
    periodLabel: "jun 2026",
    periodStart: "2026-06-01",
    periodEnd: "2026-06-30",
    state: "FINAL" as const,
    pageCount: 4,
    generatedAt: "2026-07-02",
    note: null,
  },
  {
    code: "RP-119",
    name: "Board Q3 · FY26",
    kind: "EXECUTIVE" as const,
    periodLabel: "jul – set 2026",
    periodStart: "2026-07-01",
    periodEnd: "2026-09-30",
    state: "DRAFT" as const,
    pageCount: null,
    generatedAt: null,
    note: null,
    blockedReason:
      "Bloqueado: 2 fontes fora do ar deixariam 3 números sem lastro.",
  },
];

const CONFIDENCE_RULES = [
  {
    key: "baseline.signed",
    label: "Baseline assinado pelo dono do processo",
    weight: 30,
    order: 0,
  },
  {
    key: "sources.fresh",
    label: "Fontes sincronizando (≤ 24 h)",
    weight: 25,
    order: 1,
  },
  {
    key: "formula.reviewed",
    label: "Fórmula versionada e revisada",
    weight: 20,
    order: 2,
  },
  {
    key: "sample.size",
    label: "Amostra ≥ 4 semanas pós-adoção",
    weight: 25,
    order: 3,
  },
];

/** Séries mensais retroativas a partir de uma data-fim, uma por período. */
function periodsEndingAt(
  end: Date,
  count: number
): { start: Date; end: Date }[] {
  const out: { start: Date; end: Date }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const s = new Date(end);
    s.setMonth(s.getMonth() - i - 1);
    const e = new Date(end);
    e.setMonth(e.getMonth() - i);
    out.push({ start: s, end: e });
  }
  return out;
}

async function main() {
  const tenant = await db.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (!tenant) {
    throw new Error(
      `Tenant "${TENANT_SLUG}" não existe. Rode o seed base antes (seed-admin.ts).`
    );
  }
  const user = await db.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) {
    throw new Error("Nenhum usuário no banco. Rode o seed base antes.");
  }
  const tenantId = tenant.id;
  const userId = user.id;

  // Contratação do módulo: sem linha em TenantModule o guard nega tudo.
  await db.tenantModule.upsert({
    where: { tenantId_module: { tenantId, module: "SIGNAL" } },
    create: { tenantId, module: "SIGNAL", status: "ACTIVE" },
    update: { status: "ACTIVE" },
  });

  // Papel de medição: contratar o módulo não concede acesso por si.
  await db.signalMember.upsert({
    where: { tenantId_userId: { tenantId, userId } },
    create: { tenantId, userId, role: "ADMIN" },
    update: { role: "ADMIN" },
  });

  await db.signalSettings.upsert({
    where: { tenantId },
    create: { tenantId, fiscalYearLabel: "FY26", currency: "BRL" },
    update: { fiscalYearLabel: "FY26" },
  });

  const rules = new Map<string, string>();
  for (const r of CONFIDENCE_RULES) {
    const row = await db.signalConfidenceRule.upsert({
      where: { tenantId_key: { tenantId, key: r.key } },
      create: { tenantId, ...r },
      update: { label: r.label, weight: r.weight, order: r.order },
    });
    rules.set(r.key, row.id);
  }

  const connectionIds = new Map<string, string>();
  for (const c of CONNECTIONS) {
    const row = await db.signalConnection.upsert({
      where: { tenantId_code: { tenantId, code: c.code } },
      create: {
        tenantId,
        code: c.code,
        name: c.name,
        kind: c.kind,
        icon: c.icon,
        health: c.health,
        lastSyncAt: c.lastSyncAt ? new Date(c.lastSyncAt) : null,
        expectedFreqMinutes: c.expectedFreqMinutes,
        rowsLabel: c.rowsLabel ?? null,
        ownerId: userId,
        errorMessage: c.errorMessage ?? null,
        impactNote: c.impactNote ?? null,
      },
      update: {
        health: c.health,
        lastSyncAt: c.lastSyncAt ? new Date(c.lastSyncAt) : null,
        errorMessage: c.errorMessage ?? null,
        impactNote: c.impactNote ?? null,
      },
    });
    connectionIds.set(c.code, row.id);
  }

  const initiativeIds = new Map<string, string>();
  for (const i of INITIATIVES) {
    const row = await db.signalInitiative.upsert({
      where: { tenantId_code: { tenantId, code: i.code } },
      create: {
        tenantId,
        code: i.code,
        name: i.name,
        businessUnit: i.businessUnit,
        category: i.category,
        status: i.status,
        ownerId: userId,
        hypothesis: i.hypothesis,
        startedAt: i.startedAt ? new Date(i.startedAt) : null,
        closedAt: i.closure ? new Date(i.closure.at) : null,
        closedById: i.closure ? userId : null,
        closureReason: i.closure?.reason ?? null,
      },
      update: { name: i.name, status: i.status, hypothesis: i.hypothesis },
    });
    initiativeIds.set(i.code, row.id);
    const initiativeId = row.id;

    if (i.baseline) {
      const b = await db.signalBaseline.upsert({
        where: {
          tenantId_initiativeId_version: {
            tenantId,
            initiativeId,
            version: i.baseline.version,
          },
        },
        create: {
          tenantId,
          initiativeId,
          version: i.baseline.version,
          windowLabel: i.baseline.windowLabel,
          windowStart: new Date(i.baseline.windowStart),
          windowEnd: new Date(i.baseline.windowEnd),
          signedById: userId,
          signedAt: new Date(i.baseline.signedAt),
        },
        update: {},
      });
      await db.signalBaselineDimension.deleteMany({
        where: { baselineId: b.id },
      });
      await db.signalBaselineDimension.createMany({
        data: i.baseline.dims.map((d, order) => ({
          tenantId,
          baselineId: b.id,
          key: d.key,
          label: d.label,
          value: d.value,
          sourceLabel: d.sourceLabel,
          order,
        })),
      });
    }

    const periods = periodsEndingAt(new Date("2026-07-09"), i.adoption.length);
    await db.signalAdoptionSnapshot.deleteMany({ where: { initiativeId } });
    if (i.adoption.length > 0) {
      await db.signalAdoptionSnapshot.createMany({
        data: i.adoption.map((a, idx) => ({
          tenantId,
          initiativeId,
          periodStart: periods[idx]?.start as Date,
          periodEnd: periods[idx]?.end as Date,
          activeUsers: a.activeUsers,
          licensedUsers: a.licensedUsers,
          frequencyLabel: a.frequencyLabel,
          depthNote: a.depthNote,
        })),
      });
    }

    await db.signalOutcomeSnapshot.deleteMany({ where: { initiativeId } });
    if (i.outcome.length > 0) {
      const last = periods.at(-1);
      await db.signalOutcomeSnapshot.createMany({
        data: i.outcome.map((o) => ({
          tenantId,
          initiativeId,
          periodStart: (last?.start ?? new Date("2026-06-09")) as Date,
          periodEnd: (last?.end ?? new Date("2026-07-09")) as Date,
          metricLabel: o.metricLabel,
          baselineValue: o.baselineValue,
          currentValue: o.currentValue,
          numericBaseline: o.numericBaseline,
          numericCurrent: o.numericCurrent,
          isSecondary: o.isSecondary ?? false,
          direction: o.direction ?? "LOWER_IS_BETTER",
        })),
      });
    }

    if (i.roi.entries.length > 0) {
      const f = await db.signalRoiFormula.upsert({
        where: {
          tenantId_initiativeId_version: {
            tenantId,
            initiativeId,
            version: i.roi.version,
          },
        },
        create: {
          tenantId,
          initiativeId,
          version: i.roi.version,
          horizonMonths: i.roi.horizonMonths,
          state: "ACTIVE",
          changedById: userId,
        },
        update: { state: "ACTIVE" },
      });
      await db.signalRoiEntry.deleteMany({ where: { formulaId: f.id } });
      await db.signalRoiEntry.createMany({
        data: i.roi.entries.map((e, order) => ({
          tenantId,
          formulaId: f.id,
          kind: e.kind,
          label: e.label,
          quantityLabel: e.quantityLabel ?? null,
          unitLabel: e.unitLabel ?? null,
          total: e.total,
          sourceLabel: e.sourceLabel,
          order,
        })),
      });
      await db.signalRoiAssumption.deleteMany({ where: { formulaId: f.id } });
      await db.signalRoiAssumption.createMany({
        data: i.roi.assumptions.map((a, order) => ({
          tenantId,
          formulaId: f.id,
          label: a.label,
          value: a.value,
          note: a.note,
          order,
        })),
      });
    }

    for (const c of i.confidence) {
      const ruleId = rules.get(c.key);
      if (!ruleId) {
        continue;
      }
      await db.signalConfidenceScore.upsert({
        where: {
          tenantId_initiativeId_ruleId: { tenantId, initiativeId, ruleId },
        },
        create: {
          tenantId,
          initiativeId,
          ruleId,
          got: c.got,
          note: c.note ?? null,
        },
        update: { got: c.got, note: c.note ?? null },
      });
    }
  }

  for (const m of MAPPINGS) {
    const connectionId = connectionIds.get(m.conn);
    if (!connectionId) {
      continue;
    }
    await db.signalMetricMapping.upsert({
      where: {
        tenantId_code_version: { tenantId, code: m.code, version: m.version },
      },
      create: {
        tenantId,
        code: m.code,
        connectionId,
        initiativeId: m.initiative
          ? (initiativeIds.get(m.initiative) ?? null)
          : null,
        eventKey: m.eventKey,
        metricLabel: m.metricLabel,
        transform: m.transform,
        unit: m.unit,
        version: m.version,
        state: m.state,
        changedById: userId,
      },
      update: { state: m.state },
    });
  }

  for (const a of ALERTS) {
    const initiativeId = initiativeIds.get(a.initiative);
    if (!initiativeId) {
      continue;
    }
    await db.signalAlert.upsert({
      where: { tenantId_code: { tenantId, code: a.code } },
      create: {
        tenantId,
        code: a.code,
        kind: a.kind,
        state: "OPEN",
        initiativeId,
        what: a.what,
        nextStep: a.nextStep,
        ownerId: userId,
        raisedAt: new Date(a.raisedAt),
      },
      update: { what: a.what, nextStep: a.nextStep },
    });
  }

  for (const r of REPORTS) {
    await db.signalReportSnapshot.upsert({
      where: { tenantId_code: { tenantId, code: r.code } },
      create: {
        tenantId,
        code: r.code,
        name: r.name,
        kind: r.kind,
        periodLabel: r.periodLabel,
        periodStart: new Date(r.periodStart),
        periodEnd: new Date(r.periodEnd),
        state: r.state,
        pageCount: r.pageCount ?? null,
        note: r.note ?? null,
        blockedReason: (r as { blockedReason?: string }).blockedReason ?? null,
        generatedById: r.generatedAt ? userId : null,
        generatedAt: r.generatedAt ? new Date(r.generatedAt) : null,
        // Snapshot congelado: o payload é o contrato. Aqui vai um esqueleto,
        // porque o gerador real (`lib/signal/report-payload.ts`) entra na Fase 8.
        payload:
          r.state === "FINAL" ? { seeded: true, initiatives: [] } : undefined,
      },
      update: { state: r.state },
    });
  }

  // Sequências alinhadas com o maior código semeado, para o próximo `nextCode`
  // não colidir com o que já existe.
  const seq: [string, number][] = [
    ["initiative", 43],
    ["connection", 7],
    ["mapping", 9],
    ["alert", 32],
    ["report", 120],
    ["evidence", 8842],
  ];
  for (const [kind, next] of seq) {
    await db.signalSequence.upsert({
      where: { tenantId_kind: { tenantId, kind } },
      create: { tenantId, kind, next },
      update: { next },
    });
  }

  const counts = {
    iniciativas: await db.signalInitiative.count({ where: { tenantId } }),
    conexões: await db.signalConnection.count({ where: { tenantId } }),
    mapeamentos: await db.signalMetricMapping.count({ where: { tenantId } }),
    alertas: await db.signalAlert.count({ where: { tenantId } }),
    relatórios: await db.signalReportSnapshot.count({ where: { tenantId } }),
  };
  process.stdout.write(
    `Signal semeado em "${tenant.name}" (${TENANT_SLUG}): ${JSON.stringify(counts)}\n`
  );
}

main()
  .catch((e) => {
    process.stderr.write(`${String(e)}\n`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
