import { getStrategyMapData } from "@/app/actions/strategy-map";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { appDesign } from "@/lib/app-design";
import { LayersIcon, TargetIcon, ZapIcon } from "lucide-react";
import { StrategyTree } from "./components/strategy-tree";

export const metadata = {
  title: "Strategy Map | COSMOS",
  description: "Mapa estratégico: Temas → OKRs → Épicos → PI → Times",
};

export default async function StrategyMapPage() {
  const data = await getStrategyMapData();

  const totalOKRs =
    data.themes.reduce((s, t) => s + t.okrs.length, 0) +
    data.unlinkedOKRs.length;
  const totalEpics = data.themes.reduce((s, t) => s + t.epics.length, 0);

  return (
    <div className={appDesign.shell}>
      <PageHeader
        breadcrumb={[{ label: "Portfolio", href: "/portfolio" }]}
        title="Strategy Map"
        subtitle="Conecte Temas Estratégicos, OKRs, Épicos e execução SAFe em uma visão hierárquica."
        stats={[
          { label: "Temas",  value: data.themes.length, icon: LayersIcon },
          { label: "OKRs",   value: totalOKRs,           icon: TargetIcon },
          { label: "Épicos", value: totalEpics,           icon: ZapIcon },
        ]}
      />
      <div className={appDesign.bodyScroll}>
        <StrategyTree data={data} />
      </div>
    </div>
  );
}
