/**
 * Rótulos de cada tela do Cosmos: id → [título, seção].
 *
 * Mora fora de `shell.tsx` porque aquele arquivo é `"use client"`, e o
 * `generateMetadata` de `app/(cosmos)/cosmos/[[...seg]]/page.tsx` é server.
 * Importar um objeto através dessa fronteira devolve uma referência de client,
 * não o objeto: `TITLES[id]` saía `undefined` e TODA página do Cosmos caía no
 * fallback `[id, "COSMOS"]`. O efeito era a aba do navegador ler
 * "dashboard | COSMOS · COSMOS" — id cru, minúsculo, com COSMOS repetido — em
 * vez de "Visão Geral | Portfolio · COSMOS".
 *
 * Passava despercebido porque o mesmo mapa funciona dentro do shell, que é
 * client: o cabeçalho e o breadcrumb sempre mostraram o rótulo certo. Só a aba
 * estava errada, e o `<title>` é o que ninguém olha.
 *
 * Sem `"use client"` aqui de propósito. É dado puro, e é o que permite os dois
 * lados lerem o mesmo objeto.
 */
export const TITLES: Record<string, [string, string]> = {
  executive: ["Board Snapshot", "COSMOS"],
  dashboard: ["Visão Geral", "Portfolio"],
  kanban: ["Kanban de Épicos", "Portfolio"],
  wsjf: ["WSJF Rankings", "Portfolio"],
  themes: ["Temas Estratégicos", "Portfolio"],
  value: ["Value Realization", "Portfolio"],
  okrs: ["OKRs", "Portfolio"],
  budgets: ["Lean Budgets", "Portfolio"],
  roadmap: ["Roadmap", "Portfolio"],
  anomalies: ["Anomalias", "Portfolio"],
  arts: ["ARTs", "ART Board"],
  board: ["Board do Time", "Time"],
  program: ["Program Board", "ART Board"],
  piplanning: ["PI Planning", "ART Board"],
  dependencies: ["Dependências", "ART Board"],
  risks: ["Riscos", "ART Board"],
  capacity: ["Capacity Planning", "ART Board"],
  teams: ["Times", "COSMOS"],
  flow: ["Flow Metrics", "Analytics"],
  velocity: ["Velocity", "Analytics"],
  measure: ["Measure & Grow", "Analytics"],
  strategy: ["Strategy Map", "Portfolio"],
  tags: ["Tag Rules", "Portfolio"],
  governance: ["Governance Board", "Portfolio"],
  decisions: ["Decision Log", "Portfolio"],
  solution: ["Large Solution", "COSMOS"],
  workflows: ["Workflows", "COSMOS"],
  integrations: ["Integrações", "COSMOS"],
  webhooks: ["Webhooks", "COSMOS"],
  settings: ["Settings", "COSMOS"],
  copilot: ["Copilot", "COSMOS"],
};
