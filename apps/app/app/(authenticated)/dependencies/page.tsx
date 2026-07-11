import { Badge } from "@repo/design-system/components/cosmos/badge";
import dynamic from "next/dynamic";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import type { DependencyWithFeatures } from "@/app/actions/dependencies/schema";
import {
  getDependencies,
  getEpicsWithFeatures,
} from "@/app/actions/dependencies";
import { appDesign } from "@/lib/app-design";

const DependencyDashboard = dynamic(
  () =>
    import("./components/dependency-dashboard").then(
      (m) => m.DependencyDashboard
    ),
  {
    loading: () => (
      <div className="flex min-h-[280px] items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-muted-foreground text-sm">
        <div
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
        />
        <span>A carregar mapa de dependências…</span>
      </div>
    ),
  }
);

export const metadata = {
  title: "Dependências | COSMOS",
  description: "Mapa de dependências entre features e épicos SAFe",
};

export default async function DependenciesPage() {
  let dependencies: DependencyWithFeatures[] = [];
  let epics: Awaited<ReturnType<typeof getEpicsWithFeatures>> = [];
  let loadError = false;

  try {
    [dependencies, epics] = await Promise.all([
      getDependencies(),
      getEpicsWithFeatures(),
    ]);
  } catch {
    loadError = true;
  }

  const blockedCount = dependencies.filter(
    (dependency) => dependency.status === "blocked"
  ).length;

  return (
    <div className={appDesign.shell}>
      <PageHeader
        accentRgb="251,113,133"
        badge={
          !loadError && blockedCount > 0 ? (
            <Badge dot tone="red">
              {blockedCount} bloqueio{blockedCount === 1 ? "" : "s"} crítico
              {blockedCount === 1 ? "" : "s"}
            </Badge>
          ) : undefined
        }
        subtitle="Bloqueios cruzados entre épicos. Linhas vermelhas indicam dependências não resolvidas que travam features downstream."
        title="Mapa de Dependências"
      />
      <div className={appDesign.bodyScroll}>
        <DependencyDashboard
          dependencies={dependencies}
          epics={epics}
          loadError={loadError}
        />
      </div>
    </div>
  );
}
