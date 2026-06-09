import dynamic from "next/dynamic";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
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
        <span>A carregar matriz de dependências…</span>
      </div>
    ),
  }
);

export const metadata = {
  title: "Dependências | COSMOS",
  description: "Matriz de dependências entre épicos e features SAFe",
};

export default async function DependenciesPage() {
  const [dependencies, epics] = await Promise.all([
    getDependencies(),
    getEpicsWithFeatures(),
  ]);

  return (
    <div className={appDesign.shell}>
      <PageHeader
        subtitle="Rastreie dependências entre features e épicos. Linhas = épico dependente, colunas = épico do qual depende."
        title="Dependências"
      />
      <div className={appDesign.bodyScroll}>
        <DependencyDashboard dependencies={dependencies} epics={epics} />
      </div>
    </div>
  );
}
