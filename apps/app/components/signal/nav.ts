import type { IconName } from "@repo/design-system/cosmos/icons";

// nav.ts — árvore de navegação do Signal, lida pelo shell (sidebar) e pela
// paleta. Fica fora do shell.tsx para a paleta não puxar o shell, que importa
// server action (e com ela o banco).

export type NavItem = { id: string; icon: IconName; label: string };
type NavSection = { label: string; items: NavItem[] };

/** Ordem e agrupamento do handoff (signal-shell.jsx). Valor primeiro porque é
 *  a pergunta; Prova e Dado são o que sustenta a resposta. */
export const NAV: NavSection[] = [
  {
    label: "Valor",
    items: [
      { id: "overview", icon: "signal", label: "Visão geral" },
      { id: "initiatives", icon: "target", label: "Iniciativas" },
      { id: "alerts", icon: "alert", label: "Alertas" },
    ],
  },
  {
    label: "Prova",
    items: [
      { id: "evidence", icon: "fileText", label: "Evidências" },
      { id: "audit", icon: "history", label: "Trilha de auditoria" },
      { id: "reports", icon: "download", label: "Relatórios" },
    ],
  },
  {
    label: "Dado",
    items: [
      { id: "connections", icon: "plug", label: "Conexões" },
      { id: "mapping", icon: "ruler", label: "Mapeamento de métricas" },
      { id: "models", icon: "layers", label: "Modelos de medição" },
    ],
  },
  {
    label: "Sistema",
    items: [{ id: "settings", icon: "settings", label: "Configurações" }],
  },
];
