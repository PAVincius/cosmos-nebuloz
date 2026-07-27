// apps/app/app/(authenticated)/portfolio/horizons/[id]/page.tsx
// Port of prototype `#/horizon/[id]` (screenHorizon, screens-budget.js:180).

import { DollarSignIcon } from "lucide-react";
import { Suspense } from "react";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { RelationChip } from "@/app/(authenticated)/components/relation-chip";
import { appDesign } from "@/lib/app-design";
import { EditHorizonModal } from "./components/edit-horizon-modal";
import { HorizonDetail } from "./components/horizon-detail";
import { HorizonSkeleton } from "./components/horizon-skeleton";
import { getInvestmentHorizonDetail } from "./data";

export const metadata = {
  title: "Investment Horizon — COSMOS",
  description:
    "Detalhe do horizonte de investimento do Lean Budget · SAFe Portfolio.",
};

type HorizonDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function HorizonDetailPage({
  params,
}: HorizonDetailPageProps) {
  const { id } = await params;

  return (
    <div className={appDesign.shell}>
      <PageHeader
        actions={
          <>
            <RelationChip
              eyebrow="Lean Budget"
              href="/portfolio/budgets"
              icon={<DollarSignIcon />}
              label="Budget Flow"
              tone="amber"
            />
            <EditHorizonModal existingId={id} />
          </>
        }
        breadcrumb={[
          { label: "Portfolio", href: "/portfolio" },
          { label: "Lean Budget", href: "/portfolio/budgets" },
          { label: "Investment Horizons" },
        ]}
        subtitle="Aloca budget do portfolio entre run, grow e transform · SAFe LPM"
        title={`Investment Horizon · ${id}`}
      />
      <div className={appDesign.bodyScroll}>
        <Suspense fallback={<HorizonSkeleton />}>
          <HorizonLoader id={id} />
        </Suspense>
      </div>
    </div>
  );
}

async function HorizonLoader({ id }: { id: string }) {
  let horizon: Awaited<ReturnType<typeof getInvestmentHorizonDetail>> = null;
  let error: string | null = null;

  try {
    horizon = await getInvestmentHorizonDetail(id);
  } catch (err) {
    error =
      err instanceof Error ? err.message : "Falha ao carregar o horizonte.";
  }

  return <HorizonDetail error={error} horizon={horizon} id={id} />;
}
