import { PageHeader } from "@/app/(authenticated)/components/page-header";
import {
  getAllEpics,
  getStrategicThemes,
} from "@/app/actions/strategic-themes";
import { appDesign } from "@/lib/app-design";
import { ThemesBoard } from "./components/themes-board";

export const metadata = {
  title: "Temas Estratégicos - COSMOS",
  description: "Gerencie temas estratégicos e vincule épicos do portfolio",
};

export default async function StrategicThemesPage() {
  const [themes, epics] = await Promise.all([
    getStrategicThemes(),
    getAllEpics(),
  ]);

  return (
    <div className={appDesign.shell}>
      <PageHeader
        breadcrumb={[
          { label: "Portfolio", href: "/portfolio" },
          { label: "Temas Estratégicos" },
        ]}
        subtitle="Organize épicos por eixos estratégicos para alinhar o portfolio com a visão do produto."
        title="Temas Estratégicos"
      />
      <div className={appDesign.bodyScroll}>
        <ThemesBoard initialEpics={epics} initialThemes={themes} />
      </div>
    </div>
  );
}
