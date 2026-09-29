// signal-measure-models.ts — os 5 modelos de medição do Signal como dado.
//
// Fonte: decisões provisórias do Norte, 2026-09-29, seção f, SG-PO-01 e SG-PO-04
// (docs/produto/decisoes-provisorias-2026-09-29.md). Provisórias até o CEO
// confirmar. Números marcados "(hipótese)" não têm fonte; o limiar real vem do
// caso de negócio assinado. As armadilhas são raciocinadas, não confirmadas por
// caso de cliente. As fontes são as típicas de cada forma, a confirmar.
//
// Separado do script de seed pelo mesmo motivo de `scaffold-templates.ts`: dado
// num arquivo, lógica de gravação no outro, e um teste que confira o conteúdo
// importa daqui sem abrir conexão com o banco.

export type WorkFormSeed =
  | "CONVERSATIONAL"
  | "ANALYSIS"
  | "DOC_REVIEW"
  | "TRIAGE"
  | "REPORTING";

export type MetricSeed = {
  role: "PRIMARY" | "GUARD" | "ADOPTION" | "VALUE";
  name: string;
  formula: string;
  direction: "UP" | "DOWN";
};

export type MeasureModelSeed = {
  workForm: WorkFormSeed;
  name: string;
  label: string;
  counterfactual: string;
  sampleWindowWeeks: number;
  sources: string[];
  traps: string[];
  note: string;
  metrics: MetricSeed[];
};

const NOTE =
  "Rascunho das decisões provisórias do Norte (2026-09-29, SG-PO-01/04). Limiares e armadilhas a confirmar com caso de cliente.";

export const MEASURE_MODELS: MeasureModelSeed[] = [
  {
    workForm: "CONVERSATIONAL",
    name: "Assistente conversacional",
    label: "v1",
    counterfactual: "10% das conversas sem assistente por 4 semanas.",
    sampleWindowWeeks: 4,
    sources: [
      "Log de conversas do canal",
      "Auditoria semanal amostrada",
      "Custo por atendimento humano (financeiro)",
    ],
    traps: [
      "Conversa abandonada contada como resolvida.",
      "Auditoria amostrada só em horário comercial.",
    ],
    note: NOTE,
    metrics: [
      {
        role: "PRIMARY",
        name: "Resolução sem transbordo",
        formula: "resolvidas sem transbordo ÷ conversas",
        direction: "UP",
      },
      {
        role: "GUARD",
        name: "Respostas incorretas",
        formula: "incorretas ÷ auditadas na auditoria semanal",
        direction: "DOWN",
      },
      {
        role: "ADOPTION",
        name: "Conversas no assistente",
        formula: "conversas no assistente ÷ contatos do canal",
        direction: "UP",
      },
      {
        role: "VALUE",
        name: "Retorno em R$",
        formula:
          "resolvidas sem humano × custo por atendimento humano − custo da operação",
        direction: "UP",
      },
    ],
  },
  {
    workForm: "ANALYSIS",
    name: "Análise e priorização",
    label: "v1",
    counterfactual:
      "10% dos casos em ordem antiga, sorteados (hipótese), por 4 semanas.",
    sampleWindowWeeks: 4,
    sources: [
      "Desfecho histórico dos casos",
      "Fila com o score",
      "Valor recuperado (financeiro)",
    ],
    traps: [
      "Acerto medido só nos casos que o score pôs no topo (viés de seleção).",
      "Valor recuperado que seria revertido de qualquer forma.",
    ],
    note: NOTE,
    metrics: [
      {
        role: "PRIMARY",
        name: "Valor recuperado no topo da fila",
        formula: "valor recuperado nos top-k ÷ valor recuperável",
        direction: "UP",
      },
      {
        role: "GUARD",
        name: "Erro do pior segmento",
        formula: "erro do pior segmento ÷ erro médio",
        direction: "DOWN",
      },
      {
        role: "ADOPTION",
        name: "Decisões com score visível",
        formula: "casos decididos com score visível ÷ casos decididos",
        direction: "UP",
      },
      {
        role: "VALUE",
        name: "Valor recuperado incremental",
        formula: "valor recuperado incremental contra o contrafactual",
        direction: "UP",
      },
    ],
  },
  {
    workForm: "DOC_REVIEW",
    name: "Revisão de documentos",
    label: "v1",
    counterfactual:
      "Amostragem dupla: humano e assistido revisam o mesmo lote.",
    sampleWindowWeeks: 4,
    sources: [
      "Log de revisão por documento",
      "Planilha de amostragem dupla",
      "Custo-hora (folha)",
    ],
    traps: [
      "Tempo medido sem o retrabalho posterior.",
      "Amostra de auditoria escolhida pelo próprio revisor.",
    ],
    note: NOTE,
    metrics: [
      {
        role: "PRIMARY",
        name: "Tempo médio por documento",
        formula: "tempo médio por documento",
        direction: "DOWN",
      },
      {
        role: "GUARD",
        name: "Erro em campo crítico",
        formula: "erros em campo crítico ÷ campos críticos auditados",
        direction: "DOWN",
      },
      {
        role: "ADOPTION",
        name: "Documentos com assistência",
        formula: "documentos com assistência ÷ documentos",
        direction: "UP",
      },
      {
        role: "VALUE",
        name: "Horas poupadas em R$",
        formula: "horas poupadas × custo-hora",
        direction: "UP",
      },
    ],
  },
  {
    workForm: "TRIAGE",
    name: "Triagem de demanda",
    label: "v1",
    counterfactual: "Holdout de 15% por ordem de chegada.",
    sampleWindowWeeks: 4,
    sources: [
      "Fila de pedidos com horário de cada destino",
      "Registro do holdout por ordem de chegada",
      "Custo-hora (folha)",
    ],
    traps: [
      "Holdout contaminado quando o atendente vê a sugestão.",
      "Sazonalidade de pedidos dentro da janela.",
    ],
    note: NOTE,
    metrics: [
      {
        role: "PRIMARY",
        name: "Tempo até o destino correto",
        formula: "mediana do tempo até o destino correto",
        direction: "DOWN",
      },
      {
        role: "GUARD",
        name: "Reencaminhamento",
        formula: "reencaminhados ÷ pedidos",
        direction: "DOWN",
      },
      {
        role: "GUARD",
        name: "Urgentes rebaixados",
        formula: "urgentes classificados como não urgentes (meta: 0)",
        direction: "DOWN",
      },
      {
        role: "ADOPTION",
        name: "Pedidos triados pelo sistema",
        formula: "pedidos triados pelo sistema ÷ pedidos",
        direction: "UP",
      },
      {
        role: "VALUE",
        name: "Horas poupadas em R$",
        formula: "horas poupadas × custo-hora",
        direction: "UP",
      },
    ],
  },
  {
    workForm: "REPORTING",
    name: "Relatórios recorrentes",
    label: "v1",
    counterfactual:
      "2 ciclos em paralelo com o processo antigo (hipótese). É o contrafactual mais fraco dos cinco: o modelo diz isso na tela.",
    sampleWindowWeeks: 4,
    sources: [
      "Registro de horas por ciclo",
      "Reconciliação por ciclo",
      "Custo-hora (folha)",
    ],
    traps: [
      "Horas autodeclaradas.",
      "Janela com menos relatórios que o ciclo normal.",
    ],
    note: NOTE,
    metrics: [
      {
        role: "PRIMARY",
        name: "Horas por ciclo",
        formula: "horas por ciclo",
        direction: "DOWN",
      },
      {
        role: "GUARD",
        name: "Divergências não explicadas",
        formula: "divergências não explicadas por ciclo",
        direction: "DOWN",
      },
      {
        role: "ADOPTION",
        name: "Relatórios pelo caminho novo",
        formula: "relatórios gerados pelo caminho novo ÷ relatórios do ciclo",
        direction: "UP",
      },
      {
        role: "VALUE",
        name: "Horas poupadas em R$",
        formula: "horas poupadas × custo-hora",
        direction: "UP",
      },
    ],
  },
];
