/** Catálogo das telas portadas do protótipo de design.
 *
 *  Elas existiam em `components/cosmos/screens` sem nenhuma rota apontando para
 *  lá — 27 telas prontas e inalcançáveis pela navegação. Este catálogo é dado
 *  puro (sem "use client") para poder ser lido tanto pelo índice, que é Server
 *  Component, quanto pelo host que renderiza cada tela no cliente.
 *
 *  `origem` não é decoração. Tela `demo` é port literal do protótipo: os
 *  números que ela mostra são inventados. Sem essa marca visível, uma tela de
 *  métricas falsas é indistinguível de uma real — e alguém acaba decidindo
 *  com base nela.
 */
export type OrigemDoDado = "real" | "demo";

export type TelaPortada = {
  readonly slug: string;
  readonly label: string;
  readonly origem: OrigemDoDado;
  readonly grupo: string;
};

export const TELAS: readonly TelaPortada[] = [
  // Ligadas a dados de verdade
  {
    slug: "executive",
    label: "Painel executivo",
    origem: "real",
    grupo: "Portfólio",
  },
  { slug: "okrs", label: "OKRs", origem: "real", grupo: "Portfólio" },
  {
    slug: "governance",
    label: "Governança",
    origem: "real",
    grupo: "Portfólio",
  },
  { slug: "tags", label: "Tags", origem: "real", grupo: "Portfólio" },
  { slug: "copilot", label: "Copilot", origem: "real", grupo: "Inteligência" },

  // Port literal do protótipo — dados de demonstração
  {
    slug: "kanban",
    label: "Kanban do portfólio",
    origem: "demo",
    grupo: "Portfólio",
  },
  { slug: "roadmap", label: "Roadmap", origem: "demo", grupo: "Portfólio" },
  {
    slug: "themes",
    label: "Temas estratégicos",
    origem: "demo",
    grupo: "Portfólio",
  },
  {
    slug: "strategy",
    label: "Mapa da estratégia",
    origem: "demo",
    grupo: "Portfólio",
  },
  {
    slug: "value",
    label: "Fluxos de valor",
    origem: "demo",
    grupo: "Portfólio",
  },
  {
    slug: "budgets",
    label: "Lean budgets",
    origem: "demo",
    grupo: "Financeiro",
  },
  {
    slug: "anomalies",
    label: "Anomalias de custo",
    origem: "demo",
    grupo: "Financeiro",
  },
  {
    slug: "decisions",
    label: "Registro de decisões",
    origem: "demo",
    grupo: "Governança",
  },
  {
    slug: "piplanning",
    label: "PI Planning",
    origem: "demo",
    grupo: "Execução",
  },
  {
    slug: "program",
    label: "Program board",
    origem: "demo",
    grupo: "Execução",
  },
  { slug: "teams", label: "Times", origem: "demo", grupo: "Execução" },
  { slug: "capacity", label: "Capacidade", origem: "demo", grupo: "Execução" },
  {
    slug: "dependencies",
    label: "Dependências",
    origem: "demo",
    grupo: "Execução",
  },
  { slug: "risks", label: "Riscos (ROAM)", origem: "demo", grupo: "Execução" },
  {
    slug: "solution-train",
    label: "Solution train",
    origem: "demo",
    grupo: "Execução",
  },
  {
    slug: "flow",
    label: "Métricas de fluxo",
    origem: "demo",
    grupo: "Métricas",
  },
  { slug: "velocity", label: "Velocidade", origem: "demo", grupo: "Métricas" },
  {
    slug: "measure",
    label: "Measure & Grow",
    origem: "demo",
    grupo: "Métricas",
  },
  {
    slug: "integrations",
    label: "Integrações",
    origem: "demo",
    grupo: "Configuração",
  },
  {
    slug: "webhooks",
    label: "Webhooks",
    origem: "demo",
    grupo: "Configuração",
  },
  {
    slug: "workflows",
    label: "Workflows",
    origem: "demo",
    grupo: "Configuração",
  },
  {
    slug: "settings",
    label: "Configurações (protótipo)",
    origem: "demo",
    grupo: "Configuração",
  },
];

export function acharTela(slug: string): TelaPortada | undefined {
  return TELAS.find((t) => t.slug === slug);
}
