// scaffold-templates.ts — o método da Nebuloz como dado.
//
// Portado de `scaffold-data.jsx` do projeto Claude Design
// 691f7fe5-e623-458e-aa9f-92b8c46dbbd9: os passos e critérios que o protótipo
// mostra na trilha TR-104 são o conteúdo canônico do arquétipo de triagem, e os
// outros dois arquétipos seguem a mesma estrutura de quatro fases.
//
// Templates são GLOBAIS: são o método da Nebuloz, não o do cliente. O que é do
// cliente é o overlay (US5), e ele é por tenant.
//
// Separado do script de seed pelo mesmo motivo de `regulacao-corpora.ts`: dado
// longo num arquivo, lógica de upsert no outro. Um teste que precise conferir o
// conteúdo do método importa daqui sem disparar conexão com o banco.

export type StepSeed = {
  key: string;
  statement: string;
  expectedArtefact: string;
  required?: boolean;
};

export type CriterionSeed = {
  key: string;
  statement: string;
  evaluationType?: "MANUAL" | "DERIVED";
};

export type PhaseSeed = {
  phase: "ASSESS" | "PILOT" | "SCALE" | "EMBED";
  steps: StepSeed[];
  criteria: CriterionSeed[];
};

export type VersionSeed = {
  label: string;
  authorLabel: string;
  note: string;
  phases: PhaseSeed[];
};

export type TemplateSeed = {
  key: string;
  name: string;
  archetype: "TRIAGE" | "DOC_REVIEW" | "REPORTING";
  versions: VersionSeed[];
};

/** Critérios que valem em todo arquétipo. As fases 1 e 4 são iguais em todos
 *  porque medir o hoje e entregar a posse não dependem do tipo de processo. */
const ASSESS_CRITERIA: CriterionSeed[] = [
  {
    key: "baseline-measured",
    statement: "Baseline medido com ao menos 4 semanas de dado",
    // DERIVED: o sistema sabe se existe caso de negócio com métricas medidas.
    evaluationType: "DERIVED",
  },
  {
    key: "baseline-signed",
    statement: "Dono do processo assinou o baseline",
    // DERIVED — SG-04. É a trava da Fase 1, e trava avaliada por humano é
    // trava que se marca sem olhar.
    evaluationType: "DERIVED",
  },
];

const ASSESS_STEPS: StepSeed[] = [
  {
    key: "map-actors",
    statement: "Mapear quem toca o processo hoje",
    expectedArtefact: "Mapa de atores",
  },
  {
    key: "measure-baseline",
    statement: "Medir volume, cycle time e taxa de erro",
    expectedArtefact: "Planilha de baseline",
  },
  {
    key: "sign-baseline",
    statement: "Assinar o baseline com o dono do processo",
    expectedArtefact: "Baseline assinado",
  },
];

const EMBED_STEPS: StepSeed[] = [
  {
    key: "retire-old",
    statement: "Aposentar o caminho antigo",
    expectedArtefact: "Desativação registrada",
  },
  {
    key: "write-onboarding",
    statement: "Escrever o processo novo no onboarding do time",
    expectedArtefact: "Runbook + onboarding",
  },
  {
    key: "handover",
    statement: "Gerar handover pack e transferir a posse",
    expectedArtefact: "handover-pack.zip",
  },
];

const EMBED_CRITERIA: CriterionSeed[] = [
  {
    key: "old-path-retired",
    statement: "Caminho antigo aposentado e desativação registrada",
  },
  {
    key: "handover-delivered",
    statement: "Handover pack entregue e aceito pelo time",
  },
  {
    key: "observation-window",
    statement: "Processo sobrevive 30 dias sem envolvimento da Nebuloz",
    // DERIVED — SG-06. A janela é contada pelo sistema; ninguém marca à mão
    // que trinta dias passaram.
    evaluationType: "DERIVED",
  },
];

const SCALE_CRITERIA_BASE: CriterionSeed[] = [
  {
    key: "charter-policy-acked",
    statement:
      "Política do Charter aplicável ao fluxo foi aceita pelo dono do processo",
    // DERIVED — SG-05, e condicional: só bloqueia quando o tenant tem o
    // Charter contratado. Ver `assertCharterPolicyAcked` em gates.ts.
    evaluationType: "DERIVED",
  },
  {
    key: "majority-volume",
    statement: "Maioria do volume do time roda no caminho novo",
  },
];

const SCALE_STEPS_BASE: StepSeed[] = [
  {
    key: "bind-charter-policy",
    statement: "Aplicar a política do Charter ao fluxo",
    expectedArtefact: "Política vinculada",
  },
  {
    key: "train-team",
    statement: "Treinar o time inteiro no caminho novo",
    expectedArtefact: "Registro de treinamento",
  },
  {
    key: "migrate-volume",
    statement: "Migrar o volume gradualmente (20 → 60 → 100%)",
    expectedArtefact: "Curva de migração",
  },
];

/** Passos do Pilot, comuns aos três arquétipos. O que muda entre eles é o
 *  critério de vitória, não o roteiro. */
const PILOT_STEPS: StepSeed[] = [
  {
    key: "define-metric",
    statement: "Definir a métrica de comparação e o limiar de vitória",
    expectedArtefact: "Critério de vitória escrito",
  },
  {
    key: "rollback-plan",
    statement: "Configurar e documentar o caminho de rollback",
    expectedArtefact: "rollback-plan.md",
  },
  {
    key: "run-pilot",
    statement: "Rodar o piloto em 20% do volume por 4 semanas",
    expectedArtefact: "Log do piloto",
  },
  {
    key: "compare-baseline",
    statement: "Comparar o resultado contra o baseline",
    expectedArtefact: "Comparativo",
  },
];

const PILOT_CRITERIA_V3: CriterionSeed[] = [
  {
    key: "beats-baseline",
    statement: "Piloto vence o baseline na métrica acordada",
  },
  { key: "no-new-risk", statement: "Nenhum risco novo introduzido" },
];

/** v4 endurece o critério de rollback: validar em staging deixou de bastar.
 *  É a mudança que gera o conflito com o overlay da Vanta em US5 — o overlay
 *  afrouxa exatamente este critério. */
const PILOT_CRITERIA_V4: CriterionSeed[] = [
  ...PILOT_CRITERIA_V3,
  {
    key: "rollback-tested-prod",
    statement: "Rollback testado em produção ao menos uma vez",
  },
];

export const TEMPLATES: TemplateSeed[] = [
  {
    key: "triage",
    name: "Triagem de suporte",
    archetype: "TRIAGE",
    versions: [
      {
        label: "v3",
        authorLabel: "método Nebuloz",
        note: "Passo de migração gradual 20/60/100",
        phases: [
          { phase: "ASSESS", steps: ASSESS_STEPS, criteria: ASSESS_CRITERIA },
          { phase: "PILOT", steps: PILOT_STEPS, criteria: PILOT_CRITERIA_V3 },
          {
            phase: "SCALE",
            steps: SCALE_STEPS_BASE,
            criteria: SCALE_CRITERIA_BASE,
          },
          { phase: "EMBED", steps: EMBED_STEPS, criteria: EMBED_CRITERIA },
        ],
      },
      {
        label: "v4",
        authorLabel: "Marina Duarte",
        note: "Rollback em produção virou critério de gate do Pilot",
        phases: [
          { phase: "ASSESS", steps: ASSESS_STEPS, criteria: ASSESS_CRITERIA },
          { phase: "PILOT", steps: PILOT_STEPS, criteria: PILOT_CRITERIA_V4 },
          {
            phase: "SCALE",
            steps: SCALE_STEPS_BASE,
            criteria: SCALE_CRITERIA_BASE,
          },
          { phase: "EMBED", steps: EMBED_STEPS, criteria: EMBED_CRITERIA },
        ],
      },
    ],
  },
  {
    key: "docreview",
    name: "Revisão de documentos",
    archetype: "DOC_REVIEW",
    versions: [
      {
        label: "v1",
        authorLabel: "método Nebuloz",
        note: "Versão inicial",
        phases: [
          { phase: "ASSESS", steps: ASSESS_STEPS, criteria: ASSESS_CRITERIA },
          { phase: "PILOT", steps: PILOT_STEPS, criteria: PILOT_CRITERIA_V3 },
          {
            phase: "SCALE",
            steps: SCALE_STEPS_BASE,
            criteria: SCALE_CRITERIA_BASE,
          },
          { phase: "EMBED", steps: EMBED_STEPS, criteria: EMBED_CRITERIA },
        ],
      },
      {
        label: "v2",
        authorLabel: "método Nebuloz",
        note: "Amostragem dupla no Pilot",
        phases: [
          { phase: "ASSESS", steps: ASSESS_STEPS, criteria: ASSESS_CRITERIA },
          {
            phase: "PILOT",
            steps: [
              ...PILOT_STEPS,
              {
                key: "double-sampling",
                statement:
                  "Revisar por amostragem dupla: humano e assistido no mesmo lote",
                expectedArtefact: "Planilha de concordância",
              },
            ],
            criteria: [
              ...PILOT_CRITERIA_V3,
              {
                key: "sampling-agreement",
                statement:
                  "Concordância entre revisão humana e assistida acima do limiar acordado",
              },
            ],
          },
          {
            phase: "SCALE",
            steps: SCALE_STEPS_BASE,
            criteria: SCALE_CRITERIA_BASE,
          },
          { phase: "EMBED", steps: EMBED_STEPS, criteria: EMBED_CRITERIA },
        ],
      },
    ],
  },
  {
    key: "reporting",
    name: "Relatórios",
    archetype: "REPORTING",
    versions: [
      {
        label: "v2",
        authorLabel: "método Nebuloz",
        note: "Baseline de horas por fechamento",
        phases: [
          { phase: "ASSESS", steps: ASSESS_STEPS, criteria: ASSESS_CRITERIA },
          { phase: "PILOT", steps: PILOT_STEPS, criteria: PILOT_CRITERIA_V3 },
          {
            phase: "SCALE",
            steps: SCALE_STEPS_BASE,
            criteria: SCALE_CRITERIA_BASE,
          },
          { phase: "EMBED", steps: EMBED_STEPS, criteria: EMBED_CRITERIA },
        ],
      },
      {
        label: "v3",
        authorLabel: "Tiago Ferraz (promovido do campo)",
        note: "Checklist de reconciliação antes do gate do Scale",
        phases: [
          { phase: "ASSESS", steps: ASSESS_STEPS, criteria: ASSESS_CRITERIA },
          { phase: "PILOT", steps: PILOT_STEPS, criteria: PILOT_CRITERIA_V3 },
          {
            phase: "SCALE",
            steps: [
              ...SCALE_STEPS_BASE,
              {
                key: "reconciliation-checklist",
                statement:
                  "Rodar o checklist de reconciliação contra o fechamento anterior",
                expectedArtefact: "Checklist de reconciliação",
              },
            ],
            criteria: [
              ...SCALE_CRITERIA_BASE,
              {
                key: "reconciliation-clean",
                statement: "Reconciliação fecha sem divergência não explicada",
              },
            ],
          },
          { phase: "EMBED", steps: EMBED_STEPS, criteria: EMBED_CRITERIA },
        ],
      },
    ],
  },
];
