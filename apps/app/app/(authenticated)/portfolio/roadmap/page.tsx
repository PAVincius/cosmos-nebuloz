import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { getARTs } from "@/app/actions/arts/get-arts";
import { getRoadmapItems } from "@/app/actions/roadmap";
import { getAllEpics } from "@/app/actions/strategic-themes";
import { appDesign } from "@/lib/app-design";
import { RoadmapTimeline } from "./components/roadmap-timeline";

export const metadata = {
  title: "Roadmap - COSMOS",
  description: "Visualização de roadmap portfolio com timeline por meses",
};

export default async function RoadmapPage() {
  const [items, rawArts, rawEpics] = await Promise.all([
    getRoadmapItems(),
    getARTs(),
    getAllEpics(),
  ]);

  const arts = rawArts.map((a) => ({ id: a.id, name: a.name }));
  const epics = rawEpics.map((e) => ({ id: e.id, title: e.title }));

  return (
    <div className={appDesign.shell}>
      <PageHeader
        breadcrumb={[
          { label: "Portfolio", href: "/portfolio" },
          { label: "Roadmap" },
        ]}
        subtitle="Linha do tempo do portfolio — visualize épicos e iniciativas por mês e ART."
        title="Roadmap"
      />
      <div className={appDesign.bodyScroll}>
        <RoadmapTimeline arts={arts} epics={epics} initialItems={items} />
      </div>
    </div>
  );
}
