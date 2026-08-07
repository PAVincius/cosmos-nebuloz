import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  produto: [
    "index",
    {
      type: "category",
      label: "Cosmos",
      collapsed: false,
      items: [
        { type: "doc", id: "cosmos-prd", label: "PRD" },
        { type: "doc", id: "cosmos-srd", label: "SRD" },
      ],
    },
    {
      type: "category",
      label: "Back-office",
      collapsed: false,
      items: [
        { type: "doc", id: "backoffice-prd", label: "PRD" },
        { type: "doc", id: "backoffice-srd", label: "SRD" },
      ],
    },
  ],
};

export default sidebars;
