import dynamic from "next/dynamic";
import { getDependencies, getEpicsWithFeatures } from "@/app/actions/dependencies";

const DependencyDashboard = dynamic(
  () => import("./components/dependency-dashboard").then((m) => m.DependencyDashboard),
  {
    loading: () => (
      <div className="flex min-h-[280px] items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-muted-foreground text-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
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
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dependências</h1>
        <p className="text-muted-foreground text-sm">
          Rastreie dependências entre features e épicos. Linhas = épico dependente, colunas = épico do qual depende.
        </p>
      </div>
      <DependencyDashboard dependencies={dependencies} epics={epics} />
    </div>
  );
}
