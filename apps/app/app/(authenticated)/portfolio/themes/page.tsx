import { getAllEpics, getStrategicThemes } from "@/app/actions/strategic-themes";
import { ThemesBoard } from "./components/themes-board";

export const metadata = {
  title: "Temas Estratégicos - COSMOS",
  description: "Gerencie temas estratégicos e vincule épicos do portfolio",
};

export default async function StrategicThemesPage() {
  const [themes, epics] = await Promise.all([getStrategicThemes(), getAllEpics()]);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Temas Estratégicos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Organize épicos por eixos estratégicos para alinhar o portfolio com a visão do produto.
          </p>
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        <ThemesBoard initialThemes={themes} initialEpics={epics} />
      </div>
    </div>
  );
}
