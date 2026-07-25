import type { SAFeRole } from "./detect-role";

export type SuggestedChip = {
  label: string;
  prompt: string;
};

export const ROLE_CHIPS: Record<SAFeRole, SuggestedChip[]> = {
  RTE: [
    {
      label: "🔴 Riscos ROAM pendentes",
      prompt:
        "Quais riscos do PI atual ainda não foram ROAMed? Liste por time.",
    },
    {
      label: "📊 Anomalias de fluxo",
      prompt:
        "Tem alguma anomalia ativa no ART que pode impactar os objetivos da PI?",
    },
    {
      label: "⚠️ Dependências críticas",
      prompt: "Mostre as dependências cross-team mais críticas do PI atual.",
    },
    {
      label: "🎯 Previsibilidade da PI",
      prompt:
        "Qual a previsibilidade atual da PI comparando objetivos planejados vs entregues?",
    },
  ],
  LPM: [
    {
      label: "🏆 Epics com baixo INVEST",
      prompt:
        "Quais Epics do portfólio têm pontuação INVEST abaixo de 50? Sugira melhorias.",
    },
    {
      label: "💰 Budget vs real",
      prompt:
        "Como estão os gastos dos temas estratégicos comparando orçamento vs custo real?",
    },
    {
      label: "📋 Portfolio Kanban",
      prompt:
        "Quais Epics estão em ANALYZING e prontas para mover para PORTFOLIO_BACKLOG?",
    },
    {
      label: "⚖️ Prioridade WSJF",
      prompt:
        "Ordene as Epics do backlog por WSJF e justifique a prioridade das top 3.",
    },
  ],
  PO: [
    {
      label: "✍️ Refinar história",
      prompt:
        "Ajuda a refinar a história atual em Given/When/Then com critérios de aceite claros.",
    },
    {
      label: "✂️ Dividir história grande",
      prompt:
        "Esta história parece grande. Sugira como dividi-la em partes menores e testáveis.",
    },
    {
      label: "🎯 Alinhamento com Feature",
      prompt:
        "As histórias do sprint atual estão alinhadas com os objetivos da Feature?",
    },
    {
      label: "📏 Estimativa de esforço",
      prompt: "Ajuda a estimar o esforço desta história em story points.",
    },
  ],
  SM: [
    {
      label: "🚧 Impedimentos ativos",
      prompt:
        "Quais impedimentos estão bloqueando o time agora? Algum foi escalado pro RTE?",
    },
    {
      label: "❤️ Saúde do sprint",
      prompt:
        "Como está a saúde do sprint atual? WIP, histórias bloqueadas, burndown.",
    },
    {
      label: "🔄 Ações da retro",
      prompt:
        "As ações da última retrospectiva estão sendo executadas? O que está pendente?",
    },
    {
      label: "📅 Capacidade do próximo sprint",
      prompt: "Qual a capacidade estimada do time para o próximo sprint?",
    },
  ],
  DEV: [
    {
      label: "📖 Detalhes da história",
      prompt:
        "Explica os critérios de aceite da história atual e o que precisa ser feito.",
    },
    {
      label: "🔗 Dependências",
      prompt: "Esta história tem dependências com outros times ou sistemas?",
    },
    {
      label: "🐛 Defects relacionados",
      prompt: "Tem algum defect aberto relacionado a esta área do sistema?",
    },
    {
      label: "📐 Escopo técnico",
      prompt: "Quais são os riscos técnicos desta história e como mitigá-los?",
    },
  ],
};
