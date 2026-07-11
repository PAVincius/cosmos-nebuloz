import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { appDesign } from "@/lib/app-design";

const KPI_COUNT = 4;
const CARD_COUNT = 4;

function KpiSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-card p-4">
      <Skeleton className="mb-3 h-3 w-24" />
      <Skeleton className="h-6 w-16" />
    </div>
  );
}

function TimelineCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-card p-4">
      <Skeleton className="mb-3 h-4 w-32" />
      <div className="grid grid-cols-4 gap-2.5">
        {Array.from({ length: KPI_COUNT }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <Skeleton className="h-10" key={i} />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className={appDesign.shell}>
      <div className="flex h-full flex-col gap-6 p-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>

        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}
        >
          {Array.from({ length: KPI_COUNT }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <KpiSkeleton key={i} />
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {Array.from({ length: CARD_COUNT }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <TimelineCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
