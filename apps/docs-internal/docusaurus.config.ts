import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
import { themes as prismThemes } from "prism-react-renderer";

const GITHUB_REPO = "https://github.com/PAVincius/cosmos-nebuloz";

/**
 * Docs internas (equipe Nebuloz), NÃO para cliente. A fonte é `docs/produto/`
 * na raiz do repo — PRD/SRD de Cosmos e Back-office, trilhas e pesquisa.
 *
 * Este app roda como um projeto Vercel separado, protegido por Vercel
 * Authentication (Deployment Protection). Sem isso configurado no projeto,
 * o conteúdo fica público mesmo com `noIndex: true` — noIndex só tira de
 * buscador, não é controle de acesso.
 */
const config: Config = {
  title: "Cosmos — Docs internas",
  tagline: "Documentação interna Nebuloz (Cosmos e Back-office)",
  favicon: "img/favicon.svg",

  // Ajuste para a URL real depois de criar o projeto na Vercel.
  url: "https://cosmos-nebuloz-docs-internal.vercel.app",
  baseUrl: "/",

  organizationName: "PAVincius",
  projectName: "cosmos-nebuloz",

  noIndex: true,

  // "warn": mesmo motivo do onBrokenMarkdownLinks acima — PRDs internos
  // linkam para fora de `docs/produto/` (specs/, docs/comercial/).
  onBrokenLinks: "warn",
  onBrokenAnchors: "warn",

  i18n: {
    defaultLocale: "pt-BR",
    locales: ["pt-BR"],
  },

  markdown: {
    format: "detect",
    hooks: {
      // "warn", não "throw": PRDs internos linkam arquivos fora de
      // `docs/produto/` (ex: specs/, docs/comercial/) que não existem
      // dentro do path deste plugin. Não é link quebrado de verdade.
      onBrokenMarkdownLinks: "warn",
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
          editUrl: `${GITHUB_REPO}/tree/main/docs/produto/`,
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
      title: "Cosmos — Interno",
      items: [
        {
          type: "docSidebar",
          sidebarId: "interno",
          position: "left",
          label: "Docs",
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
          title: "Repositório",
          items: [{ label: "GitHub", href: GITHUB_REPO }],
        },
      ],
      copyright: `Nebuloz · interno · ${new Date().getFullYear()}`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
