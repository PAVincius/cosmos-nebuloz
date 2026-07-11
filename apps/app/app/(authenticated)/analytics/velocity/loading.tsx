import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { appDesign } from "@/lib/app-design";

const KPI_COUNT = 4;
const BAR_COUNT = 8;

function KpiSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-card p-4">
      <Skeleton className="mb-3 h-3 w-24" />
      <Skeleton className="h-6 w-16" />
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

        <div className="overflow-hidden rounded-lg border border-hairline bg-card p-4">
          <Skeleton className="mb-4 h-3 w-40" />
          <div className="flex items-end gap-2.5" style={{ height: 180 }}>
            {Array.from({ length: BAR_COUNT }).map((_, i) => (
              <Skeleton
                className="flex-1 rounded-t-[3px]"
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                key={i}
                style={{ height: `${30 + ((i * 7) % 60)}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
