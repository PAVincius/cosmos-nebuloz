import { getARTs } from "@/app/actions/arts/get-arts";
import { listRoadmapItems } from "@/app/actions/roadmap";
import { getAllEpics } from "@/app/actions/strategic-themes";
import { appDesign } from "@/lib/app-design";
import { RoadmapTimeline } from "./components/roadmap-timeline";

export const metadata = {
  title: "Roadmap - COSMOS",
  description: "Visualização de roadmap portfolio com timeline por meses",
};

export default async function RoadmapPage() {
  const [itemsResult, rawArts, rawEpics] = await Promise.all([
    listRoadmapItems(),
    getARTs(),
    getAllEpics(),
  ]);

  if (!itemsResult.ok) {
    throw new Error(itemsResult.error);
  }

  const arts = rawArts.map((a) => ({ id: a.id, name: a.name }));
  const epics = rawEpics.map((e) => ({
    id: e.id,
    statusId: e.statusId,
    title: e.title,
  }));

  return (
    <div className={appDesign.shell}>
      <RoadmapTimeline
        arts={arts}
        epics={epics}
        initialItems={itemsResult.data}
      />
    </div>
  );
}
