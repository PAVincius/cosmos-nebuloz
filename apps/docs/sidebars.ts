import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  cliente: [
    "index",
    {
      type: "category",
      label: "Primeiros passos",
      collapsed: false,
      link: { type: "doc", id: "getting-started/index" },
      items: ["getting-started/quickstart", "getting-started/primeiro-pi"],
    },
    {
      type: "category",
      label: "Conceitos centrais",
      collapsed: false,
      link: { type: "doc", id: "conceitos/index" },
      items: ["conceitos/permissoes"],
    },
    {
      type: "category",
      label: "Guias",
      collapsed: false,
      link: { type: "doc", id: "guias/index" },
      items: [
        "guias/portfolio-kanban-wsjf",
        "guias/pi-planning",
        "guias/board-do-time-e-metricas",
        "guias/integracoes",
      ],
    },
    {
      type: "category",
      label: "Referência",
      collapsed: false,
      link: { type: "doc", id: "referencia/index" },
      items: ["referencia/configuracoes", "referencia/glossario"],
    },
  ],
};

export default sidebars;
