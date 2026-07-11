// apps/app/app/(authenticated)/portfolio/value-streams/[id]/page.tsx
// Port of prototype `#/vs/[id]` (screenValueStream, screens-budget.js:4).

import { DollarSignIcon } from "lucide-react";
import { Suspense } from "react";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { RelationChip } from "@/app/(authenticated)/components/relation-chip";
import { appDesign } from "@/lib/app-design";
import { EditValueStreamModal } from "./components/edit-value-stream-modal";
import { ValueStreamDetailView } from "./components/value-stream-detail";
import { ValueStreamSkeleton } from "./components/value-stream-skeleton";
import { getValueStreamDetail } from "./data";

export const metadata = {
  title: "Value Stream — COSMOS",
  description:
    "Detalhe do value stream do Lean Budget · SAFe Portfolio Management.",
};

type ValueStreamDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ValueStreamDetailPage({
  params,
}: ValueStreamDetailPageProps) {
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
            <EditValueStreamModal existingId={id} />
          </>
        }
        breadcrumb={[
          { label: "Portfolio", href: "/portfolio" },
          { label: "Lean Budget", href: "/portfolio/budgets" },
          { label: "Value Streams" },
        ]}
        subtitle="Mission, budget, ARTs e épicos deste value stream · SAFe Lean Budget"
        title={`Value Stream · ${id}`}
      />
      <div className={appDesign.bodyScroll}>
        <Suspense fallback={<ValueStreamSkeleton />}>
          <ValueStreamLoader id={id} />
        </Suspense>
      </div>
    </div>
  );
}

async function ValueStreamLoader({ id }: { id: string }) {
  let valueStream: Awaited<ReturnType<typeof getValueStreamDetail>> = null;
  let error: string | null = null;

  try {
    valueStream = await getValueStreamDetail(id);
  } catch (err) {
    error =
      err instanceof Error ? err.message : "Falha ao carregar o value stream.";
  }

  return <ValueStreamDetailView error={error} id={id} valueStream={valueStream} />;
}
