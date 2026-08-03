"use client";

import dynamic from "next/dynamic";

/** Carrega a tela portada correspondente ao slug.
 *
 *  Os caminhos precisam ser literais: o bundler resolve `import()` em tempo de
 *  build e não consegue seguir string montada em runtime. Daí o mapa explícito
 *  em vez de `import("../../../components/cosmos/screens/" + slug)`.
 */
const TELAS_CARREGAVEIS: Record<string, ReturnType<typeof dynamic>> = {
  anomalies: dynamic(() => import("@/components/cosmos/screens/anomalies")),
  budgets: dynamic(() => import("@/components/cosmos/screens/budgets")),
  capacity: dynamic(() => import("@/components/cosmos/screens/capacity")),
  copilot: dynamic(() => import("@/components/cosmos/screens/copilot")),
  decisions: dynamic(() => import("@/components/cosmos/screens/decisions")),
  dependencies: dynamic(
    () => import("@/components/cosmos/screens/dependencies")
  ),
  executive: dynamic(() => import("@/components/cosmos/screens/executive")),
  flow: dynamic(() => import("@/components/cosmos/screens/flow")),
  governance: dynamic(() => import("@/components/cosmos/screens/governance")),
  integrations: dynamic(
    () => import("@/components/cosmos/screens/integrations")
  ),
  kanban: dynamic(() => import("@/components/cosmos/screens/kanban")),
  measure: dynamic(() => import("@/components/cosmos/screens/measure")),
  okrs: dynamic(() => import("@/components/cosmos/screens/okrs")),
  piplanning: dynamic(() => import("@/components/cosmos/screens/piplanning")),
  program: dynamic(() => import("@/components/cosmos/screens/program")),
  risks: dynamic(() => import("@/components/cosmos/screens/risks")),
  roadmap: dynamic(() => import("@/components/cosmos/screens/roadmap")),
  settings: dynamic(() => import("@/components/cosmos/screens/settings")),
  "solution-train": dynamic(
    () => import("@/components/cosmos/screens/solution-train")
  ),
  strategy: dynamic(() => import("@/components/cosmos/screens/strategy")),
  tags: dynamic(() => import("@/components/cosmos/screens/tags")),
  teams: dynamic(() => import("@/components/cosmos/screens/teams")),
  themes: dynamic(() => import("@/components/cosmos/screens/themes")),
  value: dynamic(() => import("@/components/cosmos/screens/value")),
  velocity: dynamic(() => import("@/components/cosmos/screens/velocity")),
  webhooks: dynamic(() => import("@/components/cosmos/screens/webhooks")),
  workflows: dynamic(() => import("@/components/cosmos/screens/workflows")),
};

type ScreenHostProps = {
  readonly slug: string;
};

export function ScreenHost({ slug }: ScreenHostProps) {
  const Tela = TELAS_CARREGAVEIS[slug];

  if (!Tela) {
    return (
      <p className="p-6 text-muted-foreground text-sm">
        Tela “{slug}” não está no mapa de carregamento.
      </p>
    );
  }

  return <Tela />;
}
