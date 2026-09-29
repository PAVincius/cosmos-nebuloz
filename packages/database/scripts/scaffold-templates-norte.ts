// scaffold-templates-norte.ts — as versões novas do catálogo, conforme as
// decisões provisórias do Norte de 2026-09-29 (docs/produto/decisoes-
// provisorias-2026-09-29.md, seções b e c): 5 formas do trabalho, 13 passos
// A1…E3 e 16 entregáveis por trilha (15 do esqueleto comum + 1 específico).
//
// Só dado. O código de passo e o de entregável ficam estáveis entre versões do
// mesmo template e nunca são reusados (ST-03): depois do primeiro publish em
// produção, mudar um código é mudar identificador.
//
// Números marcados "(hipótese)" no documento do Norte não têm fonte; o limiar
// real de cada trilha vem do caso de negócio assinado (A3.2) ou do critério de
// vitória (B1.1), e é isso que os enunciados abaixo mandam consultar.

import type {
  CriterionSeed,
  DeliverableSeed,
  PhaseSeed,
  StepSeed,
  VersionSeed,
} from "./scaffold-templates";

type Phase = PhaseSeed["phase"];

/** O que muda de uma forma para outra: os três entregáveis específicos do
 *  esqueleto, o 16º e os critérios de gate específicos. */
type FormSpec = {
  a21: Pick<DeliverableSeed, "title" | "description" | "kind" | "producer">;
  b12: Pick<DeliverableSeed, "title" | "description">;
  c31: Pick<DeliverableSeed, "title" | "description">;
  /** O 16º entregável. Fica sempre na PILOT (B1.3 ou B3.2). */
  extra: Omit<DeliverableSeed, "stepCode" | "requiresModule">;
  pilotCriteria: CriterionSeed[];
  scaleCriteria?: CriterionSeed[];
};

/** Passos A1…E3: a letra é o grupo, e não a fase (seção b). D e E fecham na
 *  EMBED. Passo de política é dispensável: sem Charter contratado o C1.1 nasce
 *  dispensado pelo sistema, e um passo obrigatório sem entregável não teria o
 *  que exigir. */
const STEPS: { phase: Phase; step: Omit<StepSeed, "expectedArtefact"> }[] = [
  { phase: "ASSESS", step: { key: "A1", statement: "Mapear o processo" } },
  { phase: "ASSESS", step: { key: "A2", statement: "Mapear a fonte" } },
  { phase: "ASSESS", step: { key: "A3", statement: "Medir e prometer" } },
  { phase: "PILOT", step: { key: "B1", statement: "Preparar o piloto" } },
  { phase: "PILOT", step: { key: "B2", statement: "Garantir reversão" } },
  { phase: "PILOT", step: { key: "B3", statement: "Rodar e comparar" } },
  {
    phase: "SCALE",
    step: { key: "C1", statement: "Aplicar política", required: false },
  },
  { phase: "SCALE", step: { key: "C2", statement: "Treinar o time" } },
  { phase: "SCALE", step: { key: "C3", statement: "Migrar volume" } },
  {
    phase: "EMBED",
    step: { key: "D1", statement: "Aposentar o caminho antigo" },
  },
  {
    phase: "EMBED",
    step: { key: "E1", statement: "Escrever o processo novo" },
  },
  { phase: "EMBED", step: { key: "E2", statement: "Transferir a posse" } },
  { phase: "EMBED", step: { key: "E3", statement: "Sustentar" } },
];

/** Esqueleto comum (tabela c.1). Os três `null` são o específico da forma. */
function skeleton(f: FormSpec): (DeliverableSeed & { phase: Phase })[] {
  const d = (
    phase: Phase,
    code: string,
    title: string,
    description: string,
    kind: DeliverableSeed["kind"],
    producer: DeliverableSeed["producer"],
    requiresModule?: DeliverableSeed["requiresModule"]
  ) => ({
    phase,
    stepCode: code.split(".")[0] as string,
    code,
    title,
    description,
    kind,
    producer,
    ...(requiresModule ? { requiresModule } : {}),
  });
  return [
    d(
      "ASSESS",
      "A1.1",
      "Mapa do processo atual e volume",
      "Quem toca o processo hoje, em que ordem e com que volume por período.",
      "SPREADSHEET",
      "OWNER"
    ),
    d(
      "ASSESS",
      "A2.1",
      f.a21.title,
      f.a21.description,
      f.a21.kind,
      f.a21.producer
    ),
    d(
      "ASSESS",
      "A3.1",
      "Baseline medido, com ao menos 4 semanas de dado",
      "Volume, cycle time e taxa de erro de hoje, medidos sobre dado real de no mínimo quatro semanas.",
      "SPREADSHEET",
      "TECHNICAL"
    ),
    d(
      "ASSESS",
      "A3.2",
      "Caso de negócio assinado",
      "A promessa que o Signal vai apurar: métricas, linha de base, meta e janela, assinada pelo dono do processo. O estado deriva da assinatura; ninguém o aprova à mão.",
      "SIGNATURE",
      "OWNER"
    ),
    d(
      "PILOT",
      "B1.1",
      "Critério de vitória e contrafactual escritos",
      "Métrica primária, métricas guarda, limiar de vitória, tolerância de piora e amostra mínima, mais como será o grupo sem a mudança.",
      "DOCUMENT",
      "CONSULTANT"
    ),
    d(
      "PILOT",
      "B1.2",
      f.b12.title,
      f.b12.description,
      "CONFIGURATION",
      "TECHNICAL"
    ),
    d(
      "PILOT",
      "B2.1",
      "Plano de rollback testado",
      "Como voltar ao caminho antigo, com o registro de ao menos uma execução do rollback em produção.",
      "DOCUMENT",
      "TECHNICAL"
    ),
    d(
      "PILOT",
      "B3.1",
      "Relatório do piloto contra o contrafactual",
      "O resultado do piloto contra o contrafactual do B1.1, com o número que sustenta o critério de gate.",
      "REPORT",
      "CONSULTANT"
    ),
    d(
      "SCALE",
      "C1.1",
      "Política do Charter vinculada ao fluxo",
      "A política do Charter aplicável ao fluxo, aceita pelo dono do processo. Só é obrigatório quando o Charter está contratado.",
      "SIGNATURE",
      "LEGAL",
      "CHARTER"
    ),
    d(
      "SCALE",
      "C2.1",
      "Registro de treinamento",
      "Quem foi treinado no caminho novo, quando e por quem.",
      "TRAINING",
      "OWNER"
    ),
    d(
      "SCALE",
      "C3.1",
      f.c31.title,
      f.c31.description,
      "SPREADSHEET",
      "TECHNICAL"
    ),
    d(
      "EMBED",
      "D1.1",
      "Registro de desativação",
      "O caminho antigo desligado: o que foi desativado, quando, e a contagem de transações depois.",
      "DOCUMENT",
      "TECHNICAL"
    ),
    d(
      "EMBED",
      "E1.1",
      "Runbook e onboarding do time",
      "O processo novo escrito para quem chega depois: passo a passo, exceções e a quem recorrer.",
      "DOCUMENT",
      "OWNER"
    ),
    d(
      "EMBED",
      "E2.1",
      "Handover pack",
      "O pacote de transferência da posse. O aceite do time é a aprovação dele pelo dono do processo.",
      "PACKAGE",
      "CONSULTANT"
    ),
    d(
      "EMBED",
      "E3.1",
      "Plano de sustentação: dono da métrica e cadência pós-entrega",
      "Quem cuida da métrica depois da entrega e com que cadência ela é revista. A lição de encerramento é do Signal.",
      "DOCUMENT",
      "OWNER"
    ),
    {
      ...f.extra,
      phase: "PILOT" as Phase,
      stepCode: f.extra.code.split(".")[0] as string,
    },
  ];
}

// ── Critérios comuns (tabela c.2) ────────────────────────────────────────────

const ASSESS_CRITERIA: CriterionSeed[] = [
  {
    key: "baseline-measured",
    statement: "Baseline medido com ao menos 4 semanas de dado",
    evaluationType: "DERIVED",
  },
  {
    key: "baseline-signed",
    statement: "Dono do processo assinou o baseline",
    evaluationType: "DERIVED",
  },
];

const PILOT_COMMON: CriterionSeed[] = [
  {
    key: "beats-baseline",
    statement:
      "Métrica primária do B1.1 melhora ao menos o limiar do B1.1 contra o contrafactual, na amostra mínima do B1.1 (número do B3.1 anexado)",
  },
  {
    key: "guard-held",
    statement:
      "Nenhuma métrica guarda do B1.1 piora além da tolerância escrita no B1.1",
  },
  {
    key: "rollback-tested-prod",
    statement:
      "Rollback executado em produção ao menos uma vez, com registro no B2.1",
  },
];

const SCALE_COMMON: CriterionSeed[] = [
  {
    key: "charter-policy-acked",
    statement:
      "Política do Charter aplicável ao fluxo aceita pelo dono do processo (só quando o Charter está contratado)",
    evaluationType: "DERIVED",
  },
  {
    key: "charter-controls-clear",
    statement:
      "Caso de uso ligado no Charter sem controle em Sem evidência, Ajuste pedido ou Vencida (só quando o Charter está contratado)",
    evaluationType: "DERIVED",
  },
  {
    key: "volume-migrated",
    statement:
      "Ao menos 80% do volume no caminho novo por 2 semanas seguidas, com a curva do C3.1",
  },
];

const EMBED_COMMON: CriterionSeed[] = [
  {
    key: "old-path-retired",
    statement:
      "Zero transações pelo caminho antigo nos 14 dias após a desativação, com o registro do D1.1",
  },
  {
    key: "handover-delivered",
    statement: "Handover pack (E2.1) aprovado pelo dono do processo",
    evaluationType: "DERIVED",
  },
  {
    key: "observation-window",
    statement: "Processo sobrevive 30 dias sem envolvimento da Nebuloz",
    evaluationType: "DERIVED",
  },
];

function build(label: string, note: string, f: FormSpec): VersionSeed {
  const items = skeleton(f);
  const phases: Phase[] = ["ASSESS", "PILOT", "SCALE", "EMBED"];
  const criteria: Record<Phase, CriterionSeed[]> = {
    ASSESS: ASSESS_CRITERIA,
    PILOT: [...PILOT_COMMON, ...f.pilotCriteria],
    SCALE: [...SCALE_COMMON, ...(f.scaleCriteria ?? [])],
    EMBED: EMBED_COMMON,
  };
  return {
    label,
    authorLabel: "método Nebuloz",
    note,
    phases: phases.map((phase) => {
      const steps: StepSeed[] = STEPS.filter((s) => s.phase === phase).map(
        ({ step }) => ({
          ...step,
          // O artefato esperado do passo é o que os entregáveis dele dizem.
          expectedArtefact: items
            .filter((d) => d.stepCode === step.key)
            .map((d) => d.title)
            .join(" · "),
        })
      );
      const deliverables = items
        .filter((d) => d.phase === phase)
        .map(({ phase: _p, ...d }) => d);
      return { phase, steps, criteria: criteria[phase], deliverables };
    }),
  };
}

const NOTE =
  "Entregáveis A1…E3, gates mensuráveis e cinco formas de trabalho (decisões provisórias do Norte, 2026-09-29)";

export const NORTE_VERSIONS = {
  conversational: build("v1", NOTE, {
    a21: {
      title: "Base de conhecimento oficial com dono por tema",
      description:
        "A fonte oficial de onde o assistente responde, com um dono nomeado por tema.",
      kind: "DOCUMENT",
      producer: "OWNER",
    },
    b12: {
      title:
        "Configuração do assistente: temas proibidos e escalonamento a humano",
      description:
        "Temas que o assistente não responde e a regra que passa a conversa para uma pessoa.",
    },
    c31: {
      title: "Curva de migração por canal",
      description:
        "Parcela do volume no assistente, por canal, ao longo da escala.",
    },
    extra: {
      code: "B1.3",
      title: "Lista de temas proibidos e RIPD",
      description:
        "Temas proibidos e o relatório de impacto à proteção de dados, obrigatório quando o dado for confidencial ou acima.",
      kind: "DOCUMENT",
      producer: "LEGAL",
    },
    pilotCriteria: [
      {
        key: "contrafactual-held",
        statement:
          "10% das conversas atendidas sem o assistente por 4 semanas (contrafactual)",
      },
      {
        key: "incorrect-rate",
        statement:
          "Respostas incorretas na auditoria semanal dentro do limite escrito no B1.1",
      },
    ],
  }),
  analysis: build("v1", NOTE, {
    a21: {
      title: "Dataset histórico com desfecho real",
      description:
        "Casos passados com o desfecho que de fato aconteceu, para calibrar e medir o score.",
      kind: "DATASET",
      producer: "TECHNICAL",
    },
    b12: {
      title: "Modelo de score com variáveis documentadas",
      description:
        "O score que ordena os casos e cada variável que entra nele.",
    },
    c31: {
      title: "Curva de migração por fila",
      description:
        "Parcela do volume ordenada pelo score, por fila, ao longo da escala.",
    },
    extra: {
      code: "B1.3",
      title: "Explicabilidade para quem decide",
      description:
        "Como quem decide entende por que o caso subiu na fila (LGPD art. 20).",
      kind: "DOCUMENT",
      producer: "LEGAL",
    },
    pilotCriteria: [
      {
        key: "top-k-precision",
        statement: "Precisão no topo da fila igual ou acima do limiar do B1.1",
      },
      {
        key: "segment-parity",
        statement: "Nenhum segmento com erro acima de 1,5× a média",
      },
    ],
  }),
  docreview: build("v3", NOTE, {
    a21: {
      title: "Amostra rotulada por tipologia",
      description:
        "Documentos reais, rotulados por tipo, para medir a extração.",
      kind: "DATASET",
      producer: "TECHNICAL",
    },
    b12: {
      title: "Configuração de extração",
      description: "Os campos extraídos por tipologia e as regras de extração.",
    },
    c31: {
      title: "Curva de migração por tipologia",
      description: "Parcela do volume na revisão assistida, por tipologia.",
    },
    extra: {
      code: "B3.2",
      title: "Planilha de concordância em amostragem dupla",
      description:
        "Humano e revisão assistida no mesmo lote, com a concordância entre os dois.",
      kind: "SPREADSHEET",
      producer: "CONSULTANT",
    },
    pilotCriteria: [
      {
        key: "sampling-agreement",
        statement:
          "Concordância entre revisão humana e assistida acima do limiar do B1.1",
      },
      {
        key: "critical-fields",
        statement: "Erro em campo crítico igual ou abaixo do baseline",
      },
    ],
  }),
  triage: build("v5", NOTE, {
    a21: {
      title: "Histórico de pedidos com destino e urgência finais",
      description:
        "Pedidos passados com o destino e a urgência que valeram no fim.",
      kind: "DATASET",
      producer: "TECHNICAL",
    },
    b12: {
      title: "Regras de triagem e holdout configurados",
      description:
        "As regras que decidem destino e urgência e o grupo de controle que segue sem elas.",
    },
    c31: {
      title: "Curva de migração por tipo de pedido",
      description: "Parcela do volume na triagem nova, por tipo de pedido.",
    },
    extra: {
      code: "B1.3",
      title: "Lista de casos que sempre vão para humano",
      description:
        "Os casos que a triagem nunca decide sozinha, com a razão de cada um.",
      kind: "DOCUMENT",
      producer: "OWNER",
    },
    pilotCriteria: [
      {
        key: "holdout-held",
        statement:
          "Holdout de 15% por ordem de chegada mantido durante o piloto",
      },
      {
        key: "no-urgent-downgrade",
        statement:
          "Zero pedidos urgentes classificados como não urgentes na amostra auditada",
      },
    ],
  }),
  reporting: build("v4", NOTE, {
    a21: {
      title: "Fontes de dado com dono por campo",
      description:
        "De onde vem cada campo do relatório e quem responde por ele.",
      kind: "DOCUMENT",
      producer: "TECHNICAL",
    },
    b12: {
      title: "Configuração da geração",
      description:
        "Como o relatório é gerado a cada ciclo, com as fontes e o formato.",
    },
    c31: {
      title: "Reconciliação por ciclo",
      description:
        "O relatório novo contra o fechamento anterior, ciclo a ciclo.",
    },
    extra: {
      code: "B1.3",
      title: "Checklist de revisão antes de sair",
      description:
        "O que uma pessoa confere antes de o relatório sair da empresa.",
      kind: "DOCUMENT",
      producer: "CONSULTANT",
    },
    pilotCriteria: [
      {
        key: "parallel-cycles",
        statement: "Dois ciclos rodados em paralelo com o processo antigo",
      },
    ],
    scaleCriteria: [
      {
        key: "reconciliation-clean",
        statement:
          "Reconciliação por ciclo fecha sem divergência não explicada",
      },
    ],
  }),
} satisfies Record<string, VersionSeed>;
