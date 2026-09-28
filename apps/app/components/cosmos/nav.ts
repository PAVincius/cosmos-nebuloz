import type { IconName } from "@repo/design-system/cosmos/icons";

// nav.ts — árvore de navegação do Cosmos, lida pelo shell (sidebar) e pela
// command palette. Fica fora do shell.tsx para a palette não puxar o shell,
// que importa server action (e com ela o banco).

type NavChild = { id: string; label: string };
export type NavItem = {
  id?: string;
  key?: string;
  label: string;
  icon?: IconName;
  expandable?: boolean;
  children?: NavChild[];
};

export const NAV: NavItem[] = [
  { id: "executive", label: "Board Snapshot", icon: "fileText" },
  { id: "dashboard", label: "Visão Geral", icon: "gauge" },
  {
    key: "portfolio",
    label: "Portfolio",
    icon: "grid",
    expandable: true,
    children: [
      { id: "kanban", label: "Kanban de Épicos" },
      { id: "wsjf", label: "WSJF Rankings" },
      { id: "themes", label: "Temas Estratégicos" },
      { id: "value", label: "Value Realization" },
      { id: "strategy", label: "Strategy Map" },
      { id: "okrs", label: "OKRs" },
      { id: "budgets", label: "Lean Budgets" },
      { id: "tags", label: "Tag Rules" },
      { id: "anomalies", label: "Anomalias" },
      { id: "roadmap", label: "Roadmap" },
      { id: "governance", label: "Governance Board" },
      { id: "decisions", label: "Decision Log" },
    ],
  },
  {
    key: "artboard",
    label: "ART Board",
    icon: "target",
    expandable: true,
    children: [
      // Primeiro da lista porque é o primeiro da cadeia: sem ART não há PI
      // Plan, e sem PI Plan aberto o Program Board abaixo fica vazio.
      { id: "arts", label: "ARTs" },
      { id: "program", label: "Program Board" },
      { id: "piplanning", label: "PI Planning" },
      { id: "dependencies", label: "Dependências" },
      { id: "risks", label: "Riscos" },
      { id: "capacity", label: "Capacity Planning" },
    ],
  },
  { id: "teams", label: "Times", icon: "users" },
  // Nível Team. Era o único nível do SAFe sem nenhuma tela no Cosmos: as
  // outras 38 param no ART, e o trabalho do dia acontece aqui.
  { id: "board", label: "Board do Time", icon: "kanban" },
  {
    key: "analytics",
    label: "Analytics",
    icon: "barChart",
    expandable: true,
    children: [
      { id: "flow", label: "Flow Metrics" },
      { id: "velocity", label: "Velocity" },
      { id: "measure", label: "Measure & Grow" },
    ],
  },
  { id: "workflows", label: "Workflows", icon: "flow" },
  { id: "solution", label: "Large Solution", icon: "anchor" },
  { id: "integrations", label: "Integrações", icon: "plug" },
  { id: "settings", label: "Settings", icon: "settings" },
];
