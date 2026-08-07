import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
import { themes as prismThemes } from "prism-react-renderer";

const GITHUB_REPO = "https://github.com/PAVincius/cosmos-nebuloz";

/**
 * O conteúdo NÃO mora aqui. A fonte única é `docs/produto/` na raiz do repo —
 * os mesmos arquivos que o time edita e revisa em PR. Este app só publica.
 */
const config: Config = {
  title: "Cosmos",
  tagline: "Documentação de produto da plataforma Nebuloz",
  favicon: "img/favicon.svg",

  url: "https://cosmos-nebuloz-docs.vercel.app",
  baseUrl: "/",

  organizationName: "PAVincius",
  projectName: "cosmos-nebuloz",

  onBrokenLinks: "throw",
  onBrokenAnchors: "warn",

  i18n: {
    defaultLocale: "pt-BR",
    locales: ["pt-BR"],
  },

  markdown: {
    // `.md` como CommonMark: os documentos de produto usam diagramas ASCII e
    // sinais de `<`/`{` que o MDX interpretaria como JSX.
    format: "detect",
    hooks: {
      onBrokenMarkdownLinks: "throw",
    },
  },

  presets: [
    [
      "classic",
      {
        docs: {
          path: "../../docs/produto",
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
          editUrl: `${GITHUB_REPO}/tree/main/`,
          showLastUpdateTime: true,
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "Cosmos",
      items: [
        {
          type: "docSidebar",
          sidebarId: "produto",
          position: "left",
          label: "Produto",
        },
        {
          href: GITHUB_REPO,
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Produto",
          items: [
            { label: "Cosmos — PRD", to: "/cosmos-prd" },
            { label: "Cosmos — SRD", to: "/cosmos-srd" },
            { label: "Back-office — PRD", to: "/backoffice-prd" },
            { label: "Back-office — SRD", to: "/backoffice-srd" },
          ],
        },
        {
          title: "Repositório",
          items: [{ label: "GitHub", href: GITHUB_REPO }],
        },
      ],
      copyright: `Nebuloz · ${new Date().getFullYear()}`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
