import { getRoadmapItems } from "@/app/actions/roadmap";
import { getARTs } from "@/app/actions/arts/get-arts";
import { getAllEpics } from "@/app/actions/strategic-themes";
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
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Roadmap</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Linha do tempo do portfolio — visualize épicos e iniciativas por mês e ART.
          </p>
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-auto p-6">
        <RoadmapTimeline initialItems={items} arts={arts} epics={epics} />
      </div>
    </div>
  );
}
