// scaffold-templates-fundacao.ts — "Fundação de Prontidão de IA" (D-24).
//
// Molde derivado do assessment do Meridian: as faixas e os arquétipos do
// diagnóstico dizem por onde começar, e a trilha leva o cliente de "Inicial" a
// "Estruturado" nos eixos que travam a adoção. "O score é instrução de
// sequência, não nota."
//
// Fonte: `docs/produto/trilhas/framework-no-scaffold.md` §7 (D-24, revisão do
// Atlas de 2026-09-30). Os 16 entregáveis (4 por fase) e os critérios de gate
// saem de lá; se o documento mudar, este arquivo muda junto, com teste.
//
// Sem forma de trabalho: o template NÃO tem `archetype` (é a F3 da D-23). Uma
// trilha de prontidão cobre a organização, não uma forma de trabalho
// (conversacional, triagem…), e forçar um valor mentiria para o Signal e para
// o Charter, que casam modelo de medição e perfil de controle pela forma.
//
// Só dado. Os códigos de passo e de entregável ficam estáveis entre versões e
// nunca são reusados (ST-03). Não usa o `A3.2`, reservado ao caso de negócio
// assinado (`BUSINESS_CASE_DELIVERABLE_CODE`): o SG-04 vale para esta trilha
// pelo gate, e o baseline da ASSESS são os scores do assessment (§7.3).
//
// Prazos: `estimateMinutes` guarda a MEDIANA da faixa, a 40 h por semana (2.400
// min por semana, 480 por dia; MAPEAMENTO §5), e a faixa original fica no texto do
// passo. Os da proposta do CEO vêm dela. A4, S3 e E3 não estão na proposta: são
// estimativa do CPO (§7.7), sem medição, e o texto do passo diz que é a calibrar.
//
// O que NÃO está aqui, de propósito: `requiresModule` (nenhum entregável exige
// módulo, §7.6) e passos condicionais por arquétipo, que entram em versão
// seguinte (D-25).

import type { TemplateSeed, VersionSeed } from "./scaffold-templates";

export const FUNDACAO_KEY = "ai-readiness-foundation";

const MIN_POR_SEMANA = 2400;
const MIN_POR_DIA = 480;

/** Mediana de uma faixa em semanas, em minutos. */
const semanas = (de: number, ate: number = de) =>
  Math.round(((de + ate) / 2) * MIN_POR_SEMANA);
/** Mediana de uma faixa em dias de 8 h, em minutos. */
const dias = (de: number, ate: number = de) =>
  Math.round(((de + ate) / 2) * MIN_POR_DIA);

/** Nomes e versões dos conjuntos do catálogo do Charter, como estão em
 *  `regulacao-corpora.ts`. A referência usa o que é estável entre ambientes
 *  (nome, versão, código) e nunca o `id` (D-23 F1). */
const ISO = { set: "ISO/IEC 42001 — objetivos de controle", versao: "2023" };
const NIST = { set: "NIST AI RMF 1.0", versao: "1.0" };
const LGPD = {
  set: "LGPD — tratamento e decisão automatizada",
  versao: "13.709/2018",
};

const FUNDACAO_V1: VersionSeed = {
  label: "v1.0",
  authorLabel: "método Nebuloz",
  note: "Versão inicial: trilha derivada do assessment do Meridian, com reavaliação nos gates do Scale e do Embed.",
  phases: [
    {
      phase: "ASSESS",
      steps: [
        {
          key: "A1",
          statement:
            "Consolidar o relatório de prontidão do Meridian: faixa, arquétipo e confiança por eixo (1 a 2 semanas)",
          expectedArtefact: "Relatório de prontidão por eixo",
          estimateMinutes: semanas(1, 2),
        },
        {
          key: "A2",
          statement:
            "Fazer o workshop liderança–operação nos eixos com confiança abaixo de 0,6 (1 semana)",
          expectedArtefact: "Ata do workshop",
          estimateMinutes: semanas(1),
          // Condicional: sem eixo de confiança baixa não há o que revalidar.
          required: false,
        },
        {
          key: "A3",
          statement:
            "Mapear o arquétipo dominante para a trilha seguinte (3 a 5 dias)",
          expectedArtefact: "Mapa arquétipo → trilha",
          estimateMinutes: dias(3, 5),
        },
        {
          key: "A4",
          statement:
            "Escrever a política mínima de uso de IA para o piloto e obter a aprovação do dono do processo (1 semana; estimativa a calibrar)",
          expectedArtefact: "Política mínima de uso de IA aprovada",
          estimateMinutes: semanas(1),
        },
      ],
      deliverables: [
        {
          stepCode: "A1",
          code: "A1.1",
          title: "Relatório de prontidão por eixo",
          description:
            "Faixa por eixo (Inicial, Em formação, Estruturado, Maduro), arquétipo dominante com traço secundário e a marca de confiança baixa, tirados do assessment de origem.",
          kind: "REPORT",
          producer: "CONSULTANT",
        },
        {
          stepCode: "A2",
          code: "A2.1",
          title: "Ata do workshop liderança–operação",
          description:
            "Registro do que liderança e operação concordaram nos eixos de confiança baixa. Obrigatório só se algum eixo tiver confiança abaixo de 0,6; sem eixo assim, a consultora dispensa com o motivo.",
          kind: "DOCUMENT",
          producer: "CONSULTANT",
        },
        {
          stepCode: "A3",
          code: "A3.1",
          title: "Mapa arquétipo → trilha",
          description:
            "Qual trilha atende cada arquétipo encontrado e por quê, com a ordem em que o cliente as percorre.",
          kind: "DOCUMENT",
          producer: "CONSULTANT",
        },
        {
          stepCode: "A4",
          code: "A4.1",
          title: "Política mínima de uso de IA para o piloto",
          description:
            "Uma página: que classe de dado pode entrar no ambiente do piloto, quem acessa e que ferramentas estão aprovadas. Aprovada pelo dono do processo. Não substitui a carta de governança do Embed (E1.1).",
          kind: "DOCUMENT",
          producer: "OWNER",
        },
      ],
      criteria: [
        {
          key: "gaps-identified",
          statement:
            "Os gaps críticos por eixo estão identificados no relatório de prontidão",
        },
        {
          key: "archetype-agreed",
          statement:
            "O arquétipo dominante foi acordado com o dono do processo",
        },
        {
          key: "tracks-chosen",
          statement:
            "As trilhas seguintes estão escolhidas no mapa arquétipo → trilha",
        },
        {
          key: "low-confidence-revalidated",
          statement:
            "Todo eixo com confiança abaixo de 0,6 foi revalidado no workshop, ou nenhum eixo estava abaixo",
        },
        {
          key: "minimum-policy-approved",
          statement:
            "A política mínima de uso de IA para o piloto foi aprovada pelo dono do processo",
        },
        {
          key: "baseline-signed",
          statement:
            "Dono do processo assinou o baseline: os scores por eixo do assessment de origem e a meta de faixa do Embed",
          // SG-04: a ASSESS não fecha sem o caso de negócio assinado.
          evaluationType: "DERIVED",
        },
      ],
    },
    {
      phase: "PILOT",
      steps: [
        {
          key: "P1",
          statement:
            "Montar o catálogo inicial de dados para IA: de 3 a 5 fontes críticas, com dono e sensibilidade (4 a 8 semanas, em paralelo com o ambiente)",
          expectedArtefact: "Catálogo inicial de dados para IA",
          estimateMinutes: semanas(4, 8),
        },
        {
          key: "P2",
          statement:
            "Subir o ambiente segregado com logging, versionamento de modelo e custo de inferência por caso (4 a 8 semanas, em paralelo com o catálogo)",
          expectedArtefact: "Ambiente segregado com MLOps básico",
          estimateMinutes: semanas(4, 8),
        },
        {
          key: "P3",
          statement:
            "Rodar o AI Adopt: personas, trilha de capacitação por persona e papéis formais de IA e dados em 1 ou 2 áreas (3 a 6 semanas)",
          expectedArtefact: "Trilhas de capacitação e papéis formais",
          estimateMinutes: semanas(3, 6),
        },
      ],
      deliverables: [
        {
          stepCode: "P1",
          code: "P1.1",
          title: "Catálogo inicial de dados para IA",
          description:
            "De 3 a 5 fontes críticas, cada uma com dono, sensibilidade e uso previsto em IA. O dono do dado, do lado do cliente, é quem produz.",
          kind: "SPREADSHEET",
          producer: "OWNER",
        },
        {
          stepCode: "P2",
          code: "P2.1",
          title: "Ambiente segregado com MLOps básico",
          description:
            "Ambiente separado do produtivo, com logging, versionamento de modelo e custo de inferência por caso de uso medido.",
          kind: "CONFIGURATION",
          producer: "TECHNICAL",
        },
        {
          stepCode: "P3",
          code: "P3.1",
          title: "Trilhas de capacitação por persona",
          description:
            "Uma trilha de capacitação para cada persona definida, com a participação registrada.",
          kind: "TRAINING",
          producer: "CONSULTANT",
        },
        {
          stepCode: "P3",
          code: "P3.2",
          title: "Papéis formais de IA e dados em 1 ou 2 áreas",
          description:
            "Quem decide e quem responde por dado e IA nas áreas do piloto, com o papel nomeado e aceito.",
          kind: "DOCUMENT",
          producer: "OWNER",
        },
      ],
      criteria: [
        {
          key: "catalog-operating",
          statement:
            "O catálogo de dados para IA está em uso, com dono e sensibilidade em cada fonte",
        },
        {
          key: "environment-operating",
          statement:
            "O ambiente segregado opera com logging, versionamento de modelo e custo de inferência por caso",
        },
        {
          key: "adopt-operating",
          statement:
            "A capacitação por persona está rodando e os papéis formais de IA e dados estão exercidos nas áreas do piloto",
        },
        {
          key: "operational-baseline-recorded",
          statement:
            "O baseline operacional está registrado em nova versão do caso de negócio: qualidade de dado, tempo e custo do processo piloto, custo de inferência e participação na capacitação",
        },
      ],
    },
    {
      phase: "SCALE",
      steps: [
        {
          key: "S1",
          statement:
            "Priorizar o portfólio de casos de uso com um critério econômico comum (4 a 8 semanas)",
          expectedArtefact: "Portfólio de casos de uso priorizado",
          estimateMinutes: semanas(4, 8),
        },
        {
          key: "S2",
          statement:
            "Ativar o comitê de IA com atas e publicar o painel simples de métricas de IA confiável (2 a 4 semanas)",
          expectedArtefact: "Atas do comitê e painel de métricas",
          estimateMinutes: semanas(2, 4),
        },
        {
          key: "S3",
          statement:
            "Reavaliar no Meridian os eixos Dados e Infra, ligando a reavaliação ao assessment de origem (2 semanas; estimativa a calibrar)",
          expectedArtefact: "Reavaliação do Meridian (AS-xxx)",
          estimateMinutes: semanas(2),
        },
      ],
      deliverables: [
        {
          stepCode: "S1",
          code: "S1.1",
          title: "Portfólio de casos de uso priorizado",
          description:
            "Casos de uso ordenados por um critério econômico comum a todos, com o racional de cada posição.",
          kind: "SPREADSHEET",
          producer: "OWNER",
        },
        {
          stepCode: "S2",
          code: "S2.1",
          title: "Evidências de comitê de IA ativo",
          description:
            "Atas das reuniões do comitê, com as decisões tomadas e quem as tomou.",
          kind: "DOCUMENT",
          producer: "OWNER",
        },
        {
          stepCode: "S2",
          code: "S2.2",
          title: "Painel simples de métricas de IA confiável",
          description:
            "Poucas métricas de qualidade, risco e custo por sistema de IA, atualizadas e visíveis ao comitê.",
          kind: "REPORT",
          producer: "TECHNICAL",
        },
        {
          stepCode: "S3",
          code: "S3.1",
          title: "Reavaliação do Meridian nos eixos Dados e Infra",
          description:
            "Reavaliação ligada ao assessment de origem (reassessmentOfId), com o código AS-xxx dela. É a evidência do critério de gate do Scale.",
          kind: "REPORT",
          producer: "CONSULTANT",
        },
      ],
      criteria: [
        {
          key: "charter-policy-acked",
          statement:
            "Política do Charter aplicável ao fluxo foi aceita pelo dono do processo",
          // SG-05, condicional: só bloqueia com o Charter contratado.
          evaluationType: "DERIVED",
        },
        {
          key: "committee-active",
          statement: "O comitê de IA está ativo e registra atas",
        },
        {
          key: "economic-criterion-running",
          statement:
            "O critério econômico comum está aplicado ao portfólio de casos de uso",
        },
        {
          key: "data-infra-forming",
          statement:
            "Dados e Infra estão pelo menos Em formação (faixa de 40 a 59 ou acima), pela reavaliação do passo S3 — informe o código AS-xxx",
        },
      ],
    },
    {
      phase: "EMBED",
      steps: [
        {
          key: "E1",
          statement:
            "Redigir a carta de governança, a política e a matriz de risco, alinhadas às normas do Charter (4 a 8 semanas)",
          expectedArtefact: "Carta de governança, política e matriz de risco",
          estimateMinutes: semanas(4, 8),
        },
        {
          key: "E2",
          statement:
            "Montar o inventário único de sistemas de IA com classificação de risco e a declaração de aplicabilidade (3 a 6 semanas)",
          expectedArtefact:
            "Inventário de sistemas de IA e declaração de aplicabilidade",
          estimateMinutes: semanas(3, 6),
        },
        {
          key: "E3",
          statement:
            "Reavaliar no Meridian os eixos Dados, Governança e Infra (2 semanas; estimativa a calibrar)",
          expectedArtefact: "Reavaliação do Meridian (AS-xxx)",
          estimateMinutes: semanas(2),
        },
      ],
      deliverables: [
        {
          stepCode: "E1",
          code: "E1.1",
          title: "Carta de governança, política e matriz de risco",
          description:
            "Carta que cria o comitê e define quem decide, política de uso de IA com dono e data de revisão e matriz de classificação de risco. Alinhada às normas do catálogo do Charter.",
          kind: "DOCUMENT",
          producer: "LEGAL",
          requirementRefs: [
            { ...ISO, codigo: "ISO-CL05" },
            { ...ISO, codigo: "ISO-CL06" },
            { ...NIST, codigo: "NIST-GOVERN-1" },
            { ...NIST, codigo: "NIST-MANAGE-1" },
          ],
        },
        {
          stepCode: "E2",
          code: "E2.1",
          title:
            "Inventário único de sistemas de IA com classificação de risco",
          description:
            "Fonte única de verdade sobre os sistemas de IA da organização (modelos, agentes, fornecedores), cada um com classificação de risco e a evidência mínima para auditoria.",
          kind: "SPREADSHEET",
          producer: "TECHNICAL",
          requirementRefs: [
            { ...ISO, codigo: "ISO-CL04" },
            { ...NIST, codigo: "NIST-MAP-1" },
            { ...NIST, codigo: "NIST-MAP-2" },
            { ...LGPD, codigo: "LGPD-ART37" },
          ],
        },
        {
          stepCode: "E2",
          code: "E2.2",
          title: "Declaração de aplicabilidade",
          description:
            "Quais controles da ISO/IEC 42001 se aplicam e por quê. Cita a cláusula e formula com texto próprio, sem copiar a norma.",
          kind: "DOCUMENT",
          producer: "LEGAL",
          requirementRefs: [{ ...ISO, codigo: "ISO-CL06" }],
        },
        {
          stepCode: "E3",
          code: "E3.1",
          title: "Reavaliação do Meridian nos eixos Dados, Governança e Infra",
          description:
            "Reavaliação ligada ao assessment de origem (reassessmentOfId), com o código AS-xxx dela. É a evidência do critério de gate do Embed.",
          kind: "REPORT",
          producer: "CONSULTANT",
        },
      ],
      criteria: [
        {
          key: "governance-continuous",
          statement:
            "A governança é contínua: a política tem dono e data de revisão e o comitê registra decisões",
        },
        {
          key: "data-governance-infra-structured",
          statement:
            "Dados, Governança e Infra estão pelo menos Estruturado (60 ou mais), pela reavaliação do passo E3 — informe o código AS-xxx",
        },
        {
          key: "handover-delivered",
          statement: "Handover pack entregue e aceito pelo time",
        },
        {
          key: "observation-window",
          statement: "Processo sobrevive 30 dias sem envolvimento da Nebuloz",
          // SG-06: a janela é contada pelo sistema.
          evaluationType: "DERIVED",
        },
      ],
    },
  ],
};

export const FUNDACAO: TemplateSeed = {
  key: FUNDACAO_KEY,
  name: "Fundação de Prontidão de IA",
  versions: [FUNDACAO_V1],
};

// ── Cliente fictício Atlas (demonstração e E2E) ───────────────────────────────

/** Operação de overlay no formato de `lib/scaffold/overlay-merge.ts`. Só os
 *  campos que a demonstração usa. */
export type DemoOverlayOp = {
  op: "REPLACE" | "REMOVE";
  target: "step" | "deliverable";
  key: string;
  patch?: { statement?: string };
  /** Obrigatório em REMOVE de entregável: a instância nasce dispensada com ele. */
  reason?: string;
};

/**
 * Atlas é FICTÍCIO. Os scores vêm do briefing do protótipo (Dados 32 com
 * confiança 0,72, Processo 58 com 0,65, Pessoas 47 com 0,55, Governança 41 com
 * 0,61 e Infra 36 com 0,80) e dão Piloto sem chão com traço de Campeão isolado:
 * Pessoas tem confiança abaixo de 0,6, então o A2 vale e o eixo vai para o
 * workshop. Nada aqui é medição de cliente real.
 *
 * O overlay é o do cliente, não o do método: ajusta o enunciado do P2 ao stack
 * do Atlas, renomeia o catálogo do P1 e dispensa os papéis formais do P3.2 porque
 * o Atlas já os tem. A dispensa de entregável obrigatório é ato do consultor e
 * pede motivo (D-24 §7.7).
 */
export const ATLAS_DEMO = {
  name: "Atlas (demonstração)",
  readings: [
    { axis: "DATA", score: 32, confidence: 0.72 },
    { axis: "PROCESS", score: 58, confidence: 0.65 },
    { axis: "PEOPLE", score: 47, confidence: 0.55 },
    { axis: "GOVERNANCE", score: 41, confidence: 0.61 },
    { axis: "INFRASTRUCTURE", score: 36, confidence: 0.8 },
  ],
  overlay: {
    name: "Atlas — stack e papéis",
    ops: [
      {
        op: "REPLACE",
        target: "step",
        key: "P2",
        patch: {
          statement:
            "Subir o ambiente segregado no Databricks do Atlas, com logging, versionamento de modelo no MLflow e custo de inferência por caso",
        },
      },
      {
        op: "REPLACE",
        target: "deliverable",
        key: "P1.1",
        patch: {
          statement: "Catálogo inicial de dados para IA no DataHub do Atlas",
        },
      },
      {
        op: "REMOVE",
        target: "deliverable",
        key: "P3.2",
        reason:
          "Os papéis formais de dado já existem no Atlas, com o comitê de dados em operação",
      },
    ] satisfies DemoOverlayOp[],
  },
} as const;

/**
 * Aplica o overlay do Atlas aos passos e entregáveis lidos do banco. É a mesma
 * regra de `lib/scaffold/overlay-merge.ts` (REPLACE muda o texto, REMOVE de
 * entregável dispensa com o motivo), reescrita aqui porque este pacote não
 * importa de `apps/app`. O teste do app confere que as duas dão o mesmo.
 */
export function applyDemoOverlay<
  S extends { key: string; statement: string },
  D extends { code: string; title: string; required: boolean },
>(
  steps: readonly S[],
  deliverables: readonly D[],
  ops: readonly DemoOverlayOp[]
): {
  steps: S[];
  deliverables: (D & { dispensedReason: string | null })[];
} {
  const passos = steps.map((s) => {
    const op = ops.find(
      (o) => o.op === "REPLACE" && o.target === "step" && o.key === s.key
    );
    return op?.patch?.statement ? { ...s, statement: op.patch.statement } : s;
  });
  const entregaveis = deliverables.map((d) => {
    const trocar = ops.find(
      (o) =>
        o.op === "REPLACE" && o.target === "deliverable" && o.key === d.code
    );
    const remover = ops.find(
      (o) => o.op === "REMOVE" && o.target === "deliverable" && o.key === d.code
    );
    return {
      ...d,
      title: trocar?.patch?.statement ?? d.title,
      required: remover ? false : d.required,
      dispensedReason: remover?.reason?.trim() ?? null,
    };
  });
  return { steps: passos, deliverables: entregaveis };
}
