import { Building2, TrendingUp } from "lucide-react";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { RelationChip } from "@/app/(authenticated)/components/relation-chip";
import { getHistoryOverview } from "@/app/actions/analytics/history";
import { appDesign } from "@/lib/app-design";
import { HistoryView } from "./components/history-view";

type HistoryPageProps = {
  searchParams: Promise<{ art?: string }>;
};

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const { art } = await searchParams;
  const overview = await getHistoryOverview(art);

  return (
    <div className={appDesign.shell}>
      <PageHeader
        accentRgb="167,139,250"
        actions={
          <>
            {overview.filterArt && (
              <RelationChip
                eyebrow="ART"
                href={`/arts/${overview.filterArt.id}`}
                icon={<Building2 />}
                label={overview.filterArt.name}
                tone="blue"
              />
            )}
            <RelationChip
              eyebrow="Analytics"
              href="/analytics/velocity"
              icon={<TrendingUp />}
              label="Velocity"
              tone="accent"
            />
          </>
        }
        breadcrumb={[{ label: "Analytics", href: "/analytics" }]}
        subtitle="Program Increments finalizados e ARTs arquivados. Linha do tempo por trimestre com desfecho de cada PI."
        title="Histórico de ARTs & PIs"
      />
      <div className={appDesign.bodyScroll}>
        <HistoryView overview={overview} />
      </div>
    </div>
  );
}
